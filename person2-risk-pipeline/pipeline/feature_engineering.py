from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import median
from typing import Sequence

from risk_pipeline.contracts import FeatureEngineer, FeatureVector, ProjectRecord


@dataclass(frozen=True)
class FeatureEngineering(FeatureEngineer):
    """Reusable, leakage-aware feature transformer for validated project records.

    Call ``fit`` only with the training partition before calling ``transform``.
    The default reference date is intentionally explicit for reproducible inference.
    """

    reference_date: datetime | None = None
    _peer_medians: dict[str, float] | None = None

    def fit(self, records: Sequence[ProjectRecord]) -> "FeatureEngineering":
        if not records:
            raise ValueError("Cannot fit feature engineering on an empty training set")
        peer_values: dict[str, list[float]] = {}
        for record in records:
            peer_values.setdefault(record.district, []).append(record.project_cost)
        object.__setattr__(self, "_peer_medians", {peer: median(costs) for peer, costs in peer_values.items() if costs})
        return self

    def transform(self, records: Sequence[ProjectRecord]) -> Sequence[FeatureVector]:
        return tuple(self._transform_record(record) for record in records)

    def fit_transform(self, records: Sequence[ProjectRecord]) -> Sequence[FeatureVector]:
        return self.fit(records).transform(records)

    def _transform_record(self, record: ProjectRecord) -> FeatureVector:
        values: dict[str, float] = {}
        def add_missing(name: str) -> None:
            values[f"missing_{name}"] = 1.0

        if record.project_cost is None:
            add_missing("project_cost")
        else:
            values["project_cost"] = float(record.project_cost)

        def add_ratio(name: str, numerator: float | None, denominator: float | None) -> float | None:
            if numerator is None or denominator is None or denominator == 0:
                add_missing(name)
                return None
            values[name] = numerator / denominator
            return values[name]

        add_ratio("cost_ratio", record.project_cost, record.sanctioned_amount)
        release_ratio = add_ratio("release_ratio", record.amount_released, record.project_cost)
        payment_ratio = add_ratio("payment_ratio", record.amount_paid, record.amount_released)
        utilization_ratio = add_ratio("utilization_ratio", record.amount_utilized, record.amount_paid)
        if utilization_ratio is not None:
            values["utilization_rate"] = utilization_ratio
        progress_fraction = record.physical_progress / 100 if record.physical_progress is not None else None
        if progress_fraction is None:
            add_missing("physical_progress")
        else:
            values["physical_progress"] = progress_fraction
        if payment_ratio is not None and progress_fraction is not None:
            values["payment_progress_gap"] = payment_ratio - progress_fraction
        else:
            add_missing("payment_progress_gap")
        if utilization_ratio is not None and progress_fraction is not None:
            values["utilization_progress_gap"] = utilization_ratio - progress_fraction
        else:
            add_missing("utilization_progress_gap")

        planned_duration = self._days_between(record.planned_start, record.planned_end)
        if planned_duration is not None:
            values["planned_duration_days"] = planned_duration
        else:
            add_missing("planned_duration_days")

        actual_duration = self._days_between(record.actual_start, record.actual_end)
        if actual_duration is not None:
            values["actual_duration_days"] = actual_duration
        else:
            add_missing("actual_duration_days")

        delay_days = self._days_between(record.planned_end, record.actual_end)
        if delay_days is not None:
            values["delay_days"] = max(delay_days, 0.0)
        else:
            add_missing("delay_days")
        if delay_days is not None and planned_duration not in (None, 0):
            values["delay_ratio"] = max(delay_days, 0.0) / planned_duration
        else:
            add_missing("delay_ratio")

        remaining_budget = record.sanctioned_amount - record.amount_utilized
        values["remaining_budget"] = remaining_budget
        add_ratio("remaining_budget_ratio", remaining_budget, record.sanctioned_amount)

        reference_date = self.reference_date or datetime.now(timezone.utc)
        remaining_duration = self._days_between(reference_date, record.planned_end)
        if remaining_duration is not None:
            values["remaining_duration"] = remaining_duration
        else:
            add_missing("remaining_duration")

        elapsed_days = actual_duration or self._days_between(record.planned_start, reference_date)
        if elapsed_days is not None and elapsed_days > 0:
            values["progress_per_day"] = record.physical_progress / elapsed_days
        else:
            add_missing("progress_per_day")
        add_ratio("cost_per_progress_unit", record.project_cost, record.physical_progress)

        if self._peer_medians is not None:
            peer_median = self._peer_medians.get(record.district)
            add_ratio("peer_cost_ratio", record.project_cost, peer_median)
        else:
            add_missing("peer_cost_ratio")

        return FeatureVector(project_id=record.project_id, values=values)

    @staticmethod
    def _days_between(start: datetime | None, end: datetime | None) -> float | None:
        if start is None or end is None:
            return None
        return (end - start).total_seconds() / 86400


# Compatibility name for existing Phase 1 imports.
BasicFeatureEngineer = FeatureEngineering
