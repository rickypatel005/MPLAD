from __future__ import annotations

from dataclasses import dataclass

from risk_pipeline.contracts import FeatureVector, ProjectRecord


@dataclass(frozen=True)
class TimelineRiskSignal:
    planned_duration_days: float | None
    actual_duration_days: float | None
    delay_days: float | None
    delay_ratio: float | None
    timeline_score: float
    reason: str
    data_state: str


class TimelineRiskAnalyzer:
    def evaluate(self, record: ProjectRecord, features: FeatureVector) -> TimelineRiskSignal:
        values = features.values
        planned = values.get("planned_duration_days")
        actual = values.get("actual_duration_days")
        delay = values.get("delay_days")
        ratio = values.get("delay_ratio")
        if planned is None:
            return TimelineRiskSignal(None, actual, delay, ratio, 0.0, "Planned dates are unavailable", "MISSING")
        if delay is None:
            return TimelineRiskSignal(planned, actual, None, None, 0.0, "Actual completion date is unavailable; no delay is inferred", "ONGOING_OR_MISSING")
        score = min(max(ratio or 0.0, 0.0), 1.0)
        state = "DELAYED" if delay > 0 else "ON_TIME"
        return TimelineRiskSignal(planned, actual, delay, ratio, score, f"Project is {delay:.1f} days beyond planned completion" if delay > 0 else "Project completed by planned completion", state)
