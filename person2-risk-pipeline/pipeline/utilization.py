from __future__ import annotations

from dataclasses import dataclass

from risk_pipeline.contracts import FeatureVector, ProjectRecord


@dataclass(frozen=True)
class UtilizationSignal:
    utilization_rate: float | None
    utilization_progress_gap: float | None
    utilization_score: float
    is_concern: bool
    reason: str
    data_state: str


class UtilizationAnalyzer:
    def __init__(self, low_rate_threshold: float = 0.10, stage_gap_threshold: float = 0.25) -> None:
        self.low_rate_threshold = low_rate_threshold
        self.stage_gap_threshold = stage_gap_threshold

    def evaluate(self, record: ProjectRecord, features: FeatureVector) -> UtilizationSignal:
        del record
        values = features.values
        utilization = values.get("utilization_rate")
        gap = values.get("utilization_progress_gap")
        if utilization is None:
            return UtilizationSignal(None, gap, 0.0, False, "Utilization cannot be calculated from the available financial values", "MISSING")
        low_rate_score = max(0.0, 1.0 - utilization / self.low_rate_threshold) if self.low_rate_threshold > 0 else 0.0
        stage_score = min(max(gap or 0.0, 0.0), 1.0)
        score = max(min(low_rate_score, 1.0), stage_score)
        concern = utilization < self.low_rate_threshold or (gap is not None and gap >= self.stage_gap_threshold)
        reason = "Utilization is low or materially behind project progress" if concern else "Utilization is consistent with configured thresholds"
        return UtilizationSignal(utilization, gap, score, concern, reason, "VALID")
