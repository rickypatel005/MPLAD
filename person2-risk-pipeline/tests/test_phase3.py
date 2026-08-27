import unittest
from dataclasses import replace
from datetime import datetime, timezone

from pipeline.cost_anomaly import CostAnomalyDetector
from pipeline.feature_engineering import FeatureEngineering
from pipeline.payment_progress import PaymentProgressAnalyzer
from pipeline.rules import ConfigurableRuleEngine, RuleConfig
from pipeline.timeline_risk import TimelineRiskAnalyzer
from pipeline.utilization import UtilizationAnalyzer
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.validation import BasicValidator


class Phase3SignalTest(unittest.TestCase):
    def setUp(self) -> None:
        self.projects = SyntheticDataProvider(18, 7).get_projects()
        self.projects = tuple(BasicValidator().validate(self.projects))
        transformer = FeatureEngineering(reference_date=datetime(2026, 6, 1, tzinfo=timezone.utc))
        self.features = tuple(transformer.fit_transform(self.projects))
        self.by_id = {feature.project_id: feature for feature in self.features}

    def test_synthetic_patterns_produce_expected_signals(self) -> None:
        rules = ConfigurableRuleEngine(RuleConfig(payment_progress_gap_medium=0.20))
        delayed = self.projects[1]
        mismatch = self.projects[3]
        low_utilization = self.projects[4]
        delayed_signal = TimelineRiskAnalyzer().evaluate(delayed, self.by_id[delayed.project_id])
        mismatch_signal = PaymentProgressAnalyzer().evaluate(mismatch, self.by_id[mismatch.project_id])
        utilization_signal = UtilizationAnalyzer().evaluate(low_utilization, self.by_id[low_utilization.project_id])
        self.assertEqual(delayed_signal.data_state, "DELAYED")
        self.assertTrue(mismatch_signal.is_mismatch)
        self.assertTrue(utilization_signal.is_concern)
        self.assertTrue(any(finding.triggered for finding in rules.evaluate(mismatch, self.by_id[mismatch.project_id])))

    def test_missing_dates_and_zero_values_are_explicit(self) -> None:
        project = self.projects[0]
        ongoing = replace(project, actual_start=None, actual_end=None)
        values = FeatureEngineering(reference_date=datetime(2026, 6, 1, tzinfo=timezone.utc)).transform((ongoing,))[0]
        timeline = TimelineRiskAnalyzer().evaluate(ongoing, values)
        self.assertEqual(timeline.data_state, "ONGOING_OR_MISSING")
        zero = replace(project, sanctioned_amount=0, project_cost=0, amount_released=0, amount_paid=0, amount_utilized=0, physical_progress=0)
        zero_values = FeatureEngineering(reference_date=datetime(2026, 6, 1, tzinfo=timezone.utc)).transform((zero,))[0]
        payment = PaymentProgressAnalyzer().evaluate(zero, zero_values)
        utilization = UtilizationAnalyzer().evaluate(zero, zero_values)
        self.assertEqual(payment.data_state, "MISSING")
        self.assertEqual(utilization.data_state, "MISSING")

    def test_invalid_finance_and_missing_information_are_high_or_medium(self) -> None:
        project = self.projects[0]
        invalid = replace(project, amount_paid=project.amount_released + 1, implementing_agency="")
        values = self.by_id[project.project_id]
        findings = ConfigurableRuleEngine().evaluate(invalid, values)
        by_rule = {finding.rule_id: finding for finding in findings}
        self.assertEqual(by_rule["paid_exceeds_released"].severity, "HIGH")
        self.assertEqual(by_rule["missing_critical_information"].severity, "MEDIUM")
        self.assertGreaterEqual(by_rule["invalid_financial_relationship"].score, 0.0)

    def test_cost_detector_is_fitted_and_reusable(self) -> None:
        detector = CostAnomalyDetector()
        detector.fit(self.projects[:12])
        signal = detector.evaluate(self.projects[2], self.by_id[self.projects[2].project_id])
        self.assertIsNotNone(signal.benchmark)
        self.assertGreaterEqual(signal.anomaly_score, 0.0)
        self.assertLessEqual(signal.anomaly_score, 1.0)
        unseen_peer = replace(self.projects[0], district="unseen")
        missing = detector.evaluate(unseen_peer, self.by_id[self.projects[0].project_id])
        self.assertEqual(missing.data_state if hasattr(missing, "data_state") else missing.benchmark, None)

    def test_extreme_values_keep_scores_normalized(self) -> None:
        project = replace(self.projects[0], project_cost=10**15, sanctioned_amount=10**15)
        detector = CostAnomalyDetector().fit((project,))
        signal = detector.evaluate(project, self.by_id[project.project_id])
        self.assertGreaterEqual(signal.anomaly_score, 0.0)
        self.assertLessEqual(signal.anomaly_score, 1.0)


if __name__ == "__main__":
    unittest.main()
