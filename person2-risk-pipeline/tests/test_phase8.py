import unittest
from dataclasses import replace
from pathlib import Path

from pipeline.isolation_forest import IsolationForestDetector
from risk_pipeline.config import Settings
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.factory import build_pipeline
from risk_pipeline.validation import BasicValidator


class Phase8IntegrationTest(unittest.TestCase):
    def test_feature_engineering_runs_once_per_pipeline(self) -> None:
        pipeline = build_pipeline(Settings.from_mapping({"source": {"record_count": 10, "seed": 7}}))
        original = pipeline.feature_engineer

        class CountingFeatureEngineer:
            def __init__(self) -> None:
                self.calls = 0

            def transform(self, records):
                self.calls += 1
                return original.transform(records)

        counting = CountingFeatureEngineer()
        pipeline.feature_engineer = counting
        pipeline.run()
        self.assertEqual(counting.calls, 1)

    def test_complete_pipeline_returns_stable_final_contract(self) -> None:
        settings = Settings.from_mapping({"source": {"record_count": 10, "seed": 7}})
        results = build_pipeline(settings).run()
        self.assertEqual(len(results), 10)
        result = results[0]
        required = {"project_id", "overall_score", "risk_level", "overall_risk_level", "financial_score", "timeline_score", "compliance_score", "anomaly_score", "prediction_score", "highest_finding_severity", "critical_finding_count", "information_status", "information_confidence", "prediction_status", "model_version", "isolation_forest_model_version", "reasons"}
        self.assertTrue(required.issubset(result.__dict__))
        self.assertEqual(result.overall_risk_level, result.risk_level)
        self.assertEqual(result.prediction_status, "unavailable")
        self.assertIsNone(result.prediction_score)
        self.assertTrue(all({"source", "severity", "reason"}.issubset(reason) for reason in result.reasons))

    def test_synthetic_categories_reach_final_assessment(self) -> None:
        results = build_pipeline(Settings.from_mapping({"source": {"record_count": 12, "seed": 7}})).run()
        self.assertEqual({"LOW", "MEDIUM"}, {result.overall_risk_level for result in results})
        self.assertTrue(any(result.highest_finding_severity == "HIGH" for result in results))
        self.assertTrue(any(result.anomaly_score is not None and result.anomaly_score > 0 for result in results))

    def test_missing_actual_dates_remain_partial_without_crash(self) -> None:
        project = SyntheticDataProvider(1, 7).get_projects()[0]
        validated = BasicValidator().validate((replace(project, actual_start=None, actual_end=None),))
        self.assertEqual(len(validated), 1)
        self.assertIsNone(validated[0].actual_end)

    def test_missing_financial_value_is_rejected_safely(self) -> None:
        project = SyntheticDataProvider(1, 7).get_projects()[0]
        with self.assertRaises(ValueError):
            BasicValidator().validate((replace(project, amount_paid=None),))

    def test_invalid_project_is_rejected_before_scoring(self) -> None:
        project = SyntheticDataProvider(1, 7).get_projects()[0]
        with self.assertRaises(ValueError):
            BasicValidator().validate((replace(project, longitude=181),))

    def test_isolation_forest_artifacts_load_and_version_propagates(self) -> None:
        artifact_dir = Path("models/isolation_forest/v1")
        self.assertTrue((artifact_dir / "model.pkl").exists())
        self.assertTrue((artifact_dir / "preprocessing.pkl").exists())
        self.assertTrue((artifact_dir / "feature_schema.json").exists())
        self.assertTrue((artifact_dir / "metadata.json").exists())
        detector = IsolationForestDetector.load(artifact_dir)
        results = build_pipeline(Settings.from_mapping({"source": {"record_count": 2, "seed": 7}})).run()
        isolation_versions = {result.isolation_forest_model_version for result in results}
        self.assertEqual(isolation_versions, {detector.model_version})

    def test_project_lookup_failure_is_explicit(self) -> None:
        provider = SyntheticDataProvider(2, 7)
        self.assertIsNone(provider.get_project("does-not-exist"))


if __name__ == "__main__":
    unittest.main()
