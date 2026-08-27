from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from pipeline.cost_anomaly import CostAnomalySignal
from pipeline.payment_progress import PaymentProgressSignal
from pipeline.risk_engine import RiskAssessment
from pipeline.shap_explainability import ShapExplanation, ShapExplanationAdapter
from pipeline.timeline_risk import TimelineRiskSignal
from pipeline.utilization import UtilizationSignal
from risk_pipeline.contracts import AnomalyFinding, RuleFinding


@dataclass(frozen=True)
class ExplanationItem:
    source: str
    severity: str
    reason: str


@dataclass(frozen=True)
class ExplanationResult:
    project_id: str
    risk_level: str
    overall_score: float
    overall_risk_level: str
    highest_finding_severity: str | None
    critical_finding_count: int
    information_status: str
    information_confidence: float
    reasons: tuple[ExplanationItem, ...]
    shap: ShapExplanation


class ExplanationEngine:
    """Rank actual Phase 3/4 signals into concise, source-labelled explanations."""

    _severity_rank = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}

    def __init__(self, max_reasons: int = 5, shap_adapter: ShapExplanationAdapter | None = None) -> None:
        self.max_reasons = max_reasons
        self.shap_adapter = shap_adapter or ShapExplanationAdapter()

    def explain(self, assessment: RiskAssessment, rules: Sequence[RuleFinding], cost_anomaly: CostAnomalySignal | None, timeline: TimelineRiskSignal | None, payment_progress: PaymentProgressSignal | None, utilization: UtilizationSignal | None, statistical_anomaly: AnomalyFinding | None, isolation_forest: AnomalyFinding | None) -> ExplanationResult:
        candidates: list[tuple[int, float, ExplanationItem]] = []
        triggered_rule_ids = {rule.rule_id for rule in rules if rule.triggered}
        for rule in rules:
            if rule.triggered:
                self._add(candidates, rule.severity, rule.score, ExplanationItem("RULE", rule.severity, rule.reason))
        if cost_anomaly and cost_anomaly.is_anomalous:
            self._add(candidates, "HIGH", cost_anomaly.anomaly_score, ExplanationItem("STATISTICAL", "HIGH", cost_anomaly.reason))
        if timeline and timeline.timeline_score > 0 and "completion_delay" not in triggered_rule_ids:
            self._add(candidates, "HIGH", timeline.timeline_score, ExplanationItem("STATISTICAL", "HIGH", timeline.reason))
        if payment_progress and payment_progress.is_mismatch and "payment_progress_mismatch" not in triggered_rule_ids:
            self._add(candidates, "HIGH", payment_progress.mismatch_score, ExplanationItem("STATISTICAL", "HIGH", payment_progress.reason))
        if utilization and utilization.is_concern and "suspicious_utilization" not in triggered_rule_ids:
            self._add(candidates, "MEDIUM", utilization.utilization_score, ExplanationItem("STATISTICAL", "MEDIUM", utilization.reason))
        if statistical_anomaly and statistical_anomaly.is_anomaly:
            self._add(candidates, "HIGH", statistical_anomaly.score, ExplanationItem("STATISTICAL", "HIGH", statistical_anomaly.message))
        if isolation_forest and isolation_forest.is_anomaly:
            self._add(candidates, "HIGH", isolation_forest.score, ExplanationItem("ANOMALY", "HIGH", "The project exhibits an unusual combination of engineered features compared with reference projects"))
        candidates.sort(key=lambda candidate: (candidate[0], candidate[1]), reverse=True)
        unique: list[ExplanationItem] = []
        seen: set[tuple[str, str]] = set()
        for _, _, item in candidates:
            key = (item.source, item.reason)
            if key not in seen:
                unique.append(item)
                seen.add(key)
            if len(unique) >= self.max_reasons:
                break
        highest_severity = max((item.severity for item in unique), key=lambda severity: self._severity_rank.get(severity, 0), default=None)
        critical_count = sum(item.severity == "HIGH" for item in unique)
        return ExplanationResult(assessment.project_id, assessment.risk_level, assessment.overall_score, assessment.risk_level, highest_severity, critical_count, assessment.information_status, assessment.information_confidence, tuple(unique), self.shap_adapter.explain())

    def _add(self, candidates: list[tuple[int, float, ExplanationItem]], severity: str, score: float, item: ExplanationItem) -> None:
        candidates.append((self._severity_rank.get(severity, 0), score, item))


# Compatibility export for the old Phase 1 explanation import.
BasicExplainer = ExplanationEngine
