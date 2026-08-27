import unittest
from datetime import datetime, timezone

from pipeline.cost_anomaly import CostAnomalyDetector
from pipeline.explanation import ExplanationEngine
from pipeline.feature_engineering import FeatureEngineering
from pipeline.payment_progress import PaymentProgressAnalyzer
from pipeline.risk_engine import RiskEngine
from pipeline.timeline_risk import TimelineRiskAnalyzer
from pipeline.utilization import UtilizationAnalyzer
from risk_pipeline.contracts import AnomalyFinding, Prediction
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.validation import BasicValidator
from pipeline.rules import ConfigurableRuleEngine


class ExplanationPhase7Test(unittest.TestCase):
    def setUp(self) -> None:
        self.projects = tuple(BasicValidator().validate(SyntheticDataProvider(18, 7).get_projects()))
        transformer = FeatureEngineering(reference_date=datetime(2026, 6, 1, tzinfo=timezone.utc))
        self.features = tuple(transformer.fit_transform(self.projects))
        self.by_id = {feature.project_id: feature for feature in self.features}
        self.rules = ConfigurableRuleEngine()
        self.risk = RiskEngine()
        self.explainer = ExplanationEngine(max_reasons=3)
        self.prediction = Prediction(self.projects[0].project_id, None, "unavailable", "supervised-prediction", "untrained")

    def _explain(self, index: int):
        project = self.projects[index]
        feature = self.by_id[project.project_id]
        rules = self.rules.evaluate(project, feature)
        cost = CostAnomalyDetector().fit(self.projects).evaluate(project, feature)
        timeline = TimelineRiskAnalyzer().evaluate(project, feature)
        payment = PaymentProgressAnalyzer().evaluate(project, feature)
        utilization = UtilizationAnalyzer().evaluate(project, feature)
        statistical = AnomalyFinding("statistical", False, 0, "No statistical anomaly")
        isolation = AnomalyFinding("isolation-forest", index == 4, 0.9 if index == 4 else 0, "Isolation Forest flagged this record")
        assessment = self.risk.aggregate(project, rules, cost, timeline, payment, utilization, statistical, isolation, self.prediction)
        return self.explainer.explain(assessment, rules, cost, timeline, payment, utilization, statistical, isolation)

    def test_high_risk_multiple_reasons_are_ranked_and_source_labelled(self) -> None:
        explanation = self._explain(4)
        self.assertLessEqual(len(explanation.reasons), 3)
        self.assertEqual(explanation.reasons[0].severity, "HIGH")
        self.assertTrue(all(reason.source in {"RULE", "STATISTICAL", "ANOMALY", "MODEL"} for reason in explanation.reasons))

    def test_medium_and_low_projects_have_actual_explanations(self) -> None:
        medium = self._explain(3)
        low = self._explain(0)
        self.assertTrue(medium.reasons)
        self.assertTrue(low.reasons)
        self.assertTrue(all(item.reason for item in medium.reasons + low.reasons))

    def test_shap_and_prediction_are_explicitly_unavailable(self) -> None:
        explanation = self._explain(0)
        self.assertEqual(explanation.shap.status, "unavailable")
        self.assertEqual(explanation.shap.reason, "No trained supervised model exists")

    def test_no_signal_produces_no_fabricated_reason(self) -> None:
        project = self.projects[0]
        feature = self.by_id[project.project_id]
        assessment = self.risk.aggregate(project, (), None, None, None, None, None, None, self.prediction)
        explanation = self.explainer.explain(assessment, (), None, None, None, None, None, None)
        self.assertEqual(explanation.reasons, ())
        self.assertEqual(explanation.shap.status, "unavailable")


if __name__ == "__main__":
    unittest.main()
