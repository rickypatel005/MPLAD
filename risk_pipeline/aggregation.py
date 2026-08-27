from __future__ import annotations

from typing import Sequence

from risk_pipeline.contracts import AnomalyFinding, Prediction, ProjectRecord, RiskAggregator, RiskResult, RuleFinding


class WeightedRiskAggregator(RiskAggregator):
    def __init__(self, high_risk_threshold: float = 0.75) -> None:
        self.high_risk_threshold = high_risk_threshold

    def aggregate(self, record: ProjectRecord, rules: Sequence[RuleFinding], anomalies: Sequence[AnomalyFinding], prediction: Prediction) -> RiskResult:
        rule_score = max((finding.score for finding in rules), default=0.0)
        anomaly_score = max((finding.score for finding in anomalies), default=0.0)
        prediction_score = prediction.probability or 0.0
        risk_score = round(max(rule_score, anomaly_score, prediction_score), 4)
        level = "high" if risk_score >= self.high_risk_threshold else "normal"
        return RiskResult(record.project_id, risk_score, level, tuple(rules), tuple(anomalies), prediction, "")
