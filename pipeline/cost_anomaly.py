from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Sequence

from risk_pipeline.contracts import FeatureVector, ProjectRecord


@dataclass(frozen=True)
class CostAnomalySignal:
    benchmark: float | None
    deviation: float | None
    anomaly_score: float
    is_anomalous: bool
    reason: str


class CostAnomalyDetector:
    """Robust peer benchmark fitted on reference data, without normality assumptions."""

    def __init__(self, multiplier: float = 1.5) -> None:
        self.multiplier = multiplier
        self._peer_statistics: dict[str, tuple[float, float]] = {}

    def fit(self, records: Sequence[ProjectRecord]) -> "CostAnomalyDetector":
        grouped: dict[str, list[float]] = {}
        for record in records:
            grouped.setdefault(record.district, []).append(record.project_cost)
        self._peer_statistics = {}
        for peer, costs in grouped.items():
            ordered = sorted(costs)
            benchmark = median(ordered)
            q1 = self._percentile(ordered, 0.25)
            q3 = self._percentile(ordered, 0.75)
            self._peer_statistics[peer] = benchmark, max(q3 - q1, 0.0)
        return self

    def evaluate(self, record: ProjectRecord, features: FeatureVector) -> CostAnomalySignal:
        project_cost = features.values.get("project_cost")
        if project_cost is None:
            return CostAnomalySignal(None, None, 0.0, False, "Project cost feature is unavailable")
        if record.district not in self._peer_statistics:
            return CostAnomalySignal(None, None, 0.0, False, "No fitted peer benchmark is available")
        benchmark, iqr = self._peer_statistics[record.district]
        deviation = project_cost - benchmark
        scale = iqr if iqr > 0 else max(abs(benchmark) * 0.1, 1.0)
        robust_distance = abs(deviation) / scale
        score = min(robust_distance / (self.multiplier * 2), 1.0)
        anomalous = robust_distance >= self.multiplier
        direction = "above" if deviation >= 0 else "below"
        return CostAnomalySignal(benchmark, deviation, score, anomalous, f"Cost is {direction} the fitted peer median by {abs(deviation):.2f}")

    @staticmethod
    def _percentile(values: list[float], fraction: float) -> float:
        if len(values) == 1:
            return values[0]
        position = (len(values) - 1) * fraction
        lower = int(position)
        upper = min(lower + 1, len(values) - 1)
        return values[lower] + (values[upper] - values[lower]) * (position - lower)
