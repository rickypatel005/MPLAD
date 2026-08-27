import unittest
from dataclasses import replace
from datetime import datetime, timezone

from pipeline.cost_anomaly import CostAnomalySignal
from pipeline.payment_progress import PaymentProgressSignal
from pipeline.risk_engine import RiskEngine, RiskEngineConfig
from pipeline.timeline_risk import TimelineRiskSignal
from pipeline.utilization import UtilizationSignal
from risk_pipeline.contracts import AnomalyFinding, Prediction, RuleFinding
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.validation import BasicValidator


class RiskEngineTest(unittest.TestCase):
    def setUp(self) -> None:
        self.project = tuple(BasicValidator().validate(SyntheticDataProvider(6, 7).get_projects()))[0]
        self.prediction = Prediction(self.project.project_id, None, "unavailable", "supervised-prediction", "untrained")
        self.low_signals = dict(
            cost_anomaly=CostAnomalySignal(10, 0, 0, False, "No cost concern"),
            timeline=TimelineRiskSignal(100, 100, 0, 0, 0, "On time", "ON_TIME"),
            payment_progress=PaymentProgressSignal(0.5, 0.5, 0, 0, False, "Aligned", "VALID"),
            utilization=UtilizationSignal(0.5, 0, 0, False, "Utilization is consistent", "VALID"),
            statistical_anomaly=AnomalyFinding("statistical", False, 0, "Normal"),
            isolation_forest=AnomalyFinding("isolation-forest", False, 0, "Normal"),
        )

    def test_low_risk_with_unavailable_prediction_is_not_artificially_reduced(self) -> None:
        result = RiskEngine().aggregate(self.project, (), prediction=self.prediction, **self.low_signals)
        self.assertEqual(result.risk_level, "LOW")
        self.assertIsNone(result.prediction_score)
        self.assertEqual(result.prediction_status, "unavailable")
        self.assertEqual(result.information_status, "PARTIAL")
        self.assertGreater(result.information_confidence, 0)

    def test_finding_severity_is_distinct_from_overall_risk_level(self) -> None:
        rules = (RuleFinding("completion_delay", True, "HIGH", 1.0, "Actual completion exceeds planned completion"),)
        result = RiskEngine().aggregate(self.project, rules, prediction=self.prediction, **self.low_signals)
        self.assertEqual(result.highest_finding_severity, "HIGH")
        self.assertEqual(result.critical_finding_count, 1)
        self.assertEqual(result.overall_risk_level, "LOW")
        self.assertEqual(result.risk_level, result.overall_risk_level)

    def test_high_risk_multiple_signals_and_reasons(self) -> None:
        rules = (RuleFinding("invalid_financial_relationship", True, "HIGH", 1.0, "Invalid financial ordering"),)
        result = RiskEngine().aggregate(
            self.project,
            rules,
            cost_anomaly=CostAnomalySignal(10, 100, 1, True, "Cost is above peer median"),
            timeline=TimelineRiskSignal(100, 140, 40, 0.4, 0.4, "Delayed by 40 days", "DELAYED"),
            payment_progress=PaymentProgressSignal(0.9, 0.3, 0.6, 0.6, True, "Payment exceeds progress", "VALID"),
            utilization=UtilizationSignal(0.1, 0.4, 0.4, True, "Low utilization", "VALID"),
            statistical_anomaly=AnomalyFinding("statistical", True, 0.8, "Statistical anomaly"),
            isolation_forest=AnomalyFinding("isolation-forest", True, 0.9, "Isolation Forest anomaly"),
            prediction=self.prediction,
        )
        self.assertEqual(result.risk_level, "HIGH")
        self.assertEqual(result.overall_score, 0.733333)
        self.assertGreaterEqual(len(result.reasons), 4)
        self.assertTrue(any(reason["source"] == "rule" for reason in result.reasons))

    def test_medium_risk_uses_configured_thresholds(self) -> None:
        result = RiskEngine().aggregate(
            self.project,
            (),
            cost_anomaly=CostAnomalySignal(10, 0, 0, False, "No cost concern"),
            timeline=TimelineRiskSignal(100, 160, 60, 0.6, 0.6, "Delayed by 60 days", "DELAYED"),
            payment_progress=PaymentProgressSignal(0.9, 0.3, 0.6, 0.6, True, "Payment exceeds progress", "VALID"),
            utilization=UtilizationSignal(0.2, 0.6, 0.6, True, "Low utilization", "VALID"),
            statistical_anomaly=AnomalyFinding("statistical", False, 0, "Normal"),
            isolation_forest=AnomalyFinding("isolation-forest", False, 0, "Normal"),
            prediction=self.prediction,
        )
        self.assertEqual(result.risk_level, "MEDIUM")

    def test_missing_signals_are_distinguished_from_zero(self) -> None:
        result = RiskEngine().aggregate(self.project, (), prediction=self.prediction, cost_anomaly=None, timeline=None, payment_progress=None, utilization=None, statistical_anomaly=None, isolation_forest=None)
        self.assertEqual(result.information_status, "INSUFFICIENT")
        self.assertIsNone(result.financial_score)
        self.assertIsNone(result.timeline_score)
        self.assertIsNone(result.anomaly_score)
        self.assertEqual(result.overall_score, 0.0)

    def test_weights_and_thresholds_are_configurable(self) -> None:
        config = RiskEngineConfig(financial_weight=1, timeline_weight=0, compliance_weight=0, anomaly_weight=0, prediction_weight=0, medium_threshold=0.2, high_threshold=0.8)
        result = RiskEngine(config).aggregate(self.project, (), prediction=self.prediction, **self.low_signals)
        self.assertEqual(result.overall_score, 0.0)
        self.assertEqual(result.risk_level, "LOW")
        with self.assertRaises(ValueError):
            RiskEngine(RiskEngineConfig(medium_threshold=0.9, high_threshold=0.8))

    def test_correlated_rule_and_signal_do_not_double_count_within_category(self) -> None:
        mismatch_rule = (RuleFinding("payment_progress_mismatch", True, "HIGH", 0.8, "Payment exceeds progress"),)
        result = RiskEngine().aggregate(self.project, mismatch_rule, prediction=self.prediction, **self.low_signals)
        self.assertEqual(result.financial_score, 0.0)
        self.assertEqual(result.compliance_score, 0.0)


if __name__ == "__main__":
    unittest.main()
