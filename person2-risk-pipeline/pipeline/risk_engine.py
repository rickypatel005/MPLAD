from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence

from pipeline.cost_anomaly import CostAnomalySignal
from pipeline.payment_progress import PaymentProgressSignal
from pipeline.timeline_risk import TimelineRiskSignal
from pipeline.utilization import UtilizationSignal
from risk_pipeline.contracts import AnomalyFinding, Prediction, ProjectRecord, RiskResult, RuleFinding


@dataclass(frozen=True)
class RiskEngineConfig:
    financial_weight: float = 0.30
    timeline_weight: float = 0.20
    compliance_weight: float = 0.20
    anomaly_weight: float = 0.20
    prediction_weight: float = 0.10
    medium_threshold: float = 0.33
    high_threshold: float = 0.66
    missing_confidence_penalty: float = 0.15


@dataclass(frozen=True)
class RiskAssessment:
    project_id: str
    financial_score: float | None
    timeline_score: float | None
    compliance_score: float | None
    anomaly_score: float | None
    prediction_score: float | None
    overall_score: float
    risk_level: str
    overall_risk_level: str
    highest_finding_severity: str | None
    critical_finding_count: int
    information_status: str
    information_confidence: float
    prediction_status: str
    model_version: str
    isolation_forest_model_version: str | None
    prediction: Prediction
    reasons: tuple[dict[str, str], ...]

    @property
    def explanation(self) -> str:
        return "; ".join(reason["reason"] for reason in self.reasons) or "No triggered risk signal"


class RiskEngine:
    """Combine existing structured signals without recalculating their features."""

    def __init__(self, config: RiskEngineConfig | None = None) -> None:
        self.config = config or RiskEngineConfig()
        self._validate_config()

    def aggregate(
        self,
        record: ProjectRecord,
        rules: Sequence[RuleFinding],
        cost_anomaly: CostAnomalySignal | None,
        timeline: TimelineRiskSignal | None,
        payment_progress: PaymentProgressSignal | None,
        utilization: UtilizationSignal | None,
        statistical_anomaly: AnomalyFinding | None,
        isolation_forest: AnomalyFinding | None,
        prediction: Prediction,
        future_signals: Mapping[str, float | None] | None = None,
    ) -> RiskAssessment:
        del future_signals  # Reserved optional extension point; Person 3 is not integrated.
        financial_parts = [
            payment_progress.mismatch_score if payment_progress and payment_progress.data_state == "VALID" else None,
            utilization.utilization_score if utilization and utilization.data_state == "VALID" else None,
        ]
        financial_score = self._maximum(financial_parts)
        timeline_score = timeline.timeline_score if timeline and timeline.data_state != "MISSING" else None
        compliance_parts = [
            rule.score for rule in rules
            if rule.triggered and rule.rule_id not in {"payment_progress_mismatch", "completion_delay", "suspicious_utilization"}
        ]
        compliance_score = self._maximum(compliance_parts) if rules else None
        if rules and compliance_score is None:
            compliance_score = 0.0
        anomaly_score = self._maximum([
            cost_anomaly.anomaly_score if cost_anomaly and cost_anomaly.benchmark is not None else None,
            statistical_anomaly.score if statistical_anomaly else None,
            isolation_forest.score if isolation_forest else None,
        ])
        prediction_score = prediction.probability
        scores = {
            "financial_score": financial_score,
            "timeline_score": timeline_score,
            "compliance_score": compliance_score,
            "anomaly_score": anomaly_score,
            "prediction_score": prediction_score,
        }
        weights = {
            "financial_score": self.config.financial_weight,
            "timeline_score": self.config.timeline_weight,
            "compliance_score": self.config.compliance_weight,
            "anomaly_score": self.config.anomaly_weight,
            "prediction_score": self.config.prediction_weight,
        }
        available = {name: value for name, value in scores.items() if value is not None}
        available_weight = sum(weights[name] for name in available)
        overall_score = sum(value * weights[name] for name, value in available.items()) / available_weight if available_weight else 0.0
        missing_count = len(scores) - len(available)
        confidence = max(0.0, min(1.0, 1.0 - missing_count * self.config.missing_confidence_penalty))
        status = "COMPLETE" if missing_count == 0 else "PARTIAL" if available else "INSUFFICIENT"
        model_version = prediction.model_version
        isolation_forest_model_version = isolation_forest.model_version if isolation_forest else None
        reasons = self._reasons(rules, cost_anomaly, timeline, payment_progress, utilization, statistical_anomaly, isolation_forest)
        highest_severity = max((reason["severity"] for reason in reasons), key=lambda severity: {"LOW": 1, "MEDIUM": 2, "HIGH": 3}.get(severity, 0), default=None)
        critical_count = sum(reason["severity"] == "HIGH" for reason in reasons)
        overall_risk_level = self._risk_level(overall_score)
        return RiskAssessment(
            project_id=record.project_id,
            financial_score=financial_score,
            timeline_score=timeline_score,
            compliance_score=compliance_score,
            anomaly_score=anomaly_score,
            prediction_score=prediction_score,
            overall_score=round(overall_score, 6),
            risk_level=overall_risk_level,
            overall_risk_level=overall_risk_level,
            highest_finding_severity=highest_severity,
            critical_finding_count=critical_count,
            information_status=status,
            information_confidence=round(confidence, 6),
            prediction_status="available" if prediction.probability is not None else "unavailable",
            model_version=model_version,
            isolation_forest_model_version=isolation_forest_model_version,
            prediction=prediction,
            reasons=reasons,
        )

    def _reasons(self, rules: Sequence[RuleFinding], cost_anomaly: CostAnomalySignal | None, timeline: TimelineRiskSignal | None, payment: PaymentProgressSignal | None, utilization: UtilizationSignal | None, statistical: AnomalyFinding | None, isolation: AnomalyFinding | None) -> tuple[dict[str, str], ...]:
        reasons: list[dict[str, str]] = []
        for rule in rules:
            if rule.triggered:
                reasons.append({"source": "rule", "severity": rule.severity, "reason": rule.reason})
        if cost_anomaly and cost_anomaly.is_anomalous:
            reasons.append({"source": "cost_anomaly", "severity": "HIGH", "reason": cost_anomaly.reason})
        if timeline and timeline.timeline_score > 0 and not any(reason["reason"] == "Actual completion exceeds planned completion" for reason in reasons):
            reasons.append({"source": "timeline", "severity": "HIGH", "reason": timeline.reason})
        if payment and payment.is_mismatch and not any(reason["reason"] == "Payment substantially exceeds physical progress" for reason in reasons):
            reasons.append({"source": "payment_progress", "severity": "HIGH", "reason": payment.reason})
        if utilization and utilization.is_concern and not any(reason["reason"] == "Utilization is unusually low for the observed project progress" for reason in reasons):
            reasons.append({"source": "utilization", "severity": "MEDIUM", "reason": utilization.reason})
        for signal in (statistical, isolation):
            if signal and signal.is_anomaly:
                reasons.append({"source": signal.detector_id, "severity": "HIGH", "reason": signal.message})
        return tuple(reasons)

    def _risk_level(self, score: float) -> str:
        if score >= self.config.high_threshold:
            return "HIGH"
        if score >= self.config.medium_threshold:
            return "MEDIUM"
        return "LOW"

    @staticmethod
    def _maximum(values: Sequence[float | None]) -> float | None:
        available = [min(max(value, 0.0), 1.0) for value in values if value is not None]
        return max(available) if available else None

    def _validate_config(self) -> None:
        weights = (self.config.financial_weight, self.config.timeline_weight, self.config.compliance_weight, self.config.anomaly_weight, self.config.prediction_weight)
        if any(weight < 0 for weight in weights) or sum(weights) <= 0:
            raise ValueError("Risk aggregation weights must be non-negative and have a positive sum")
        if not 0 <= self.config.medium_threshold <= self.config.high_threshold <= 1:
            raise ValueError("Risk thresholds must satisfy 0 <= medium <= high <= 1")
