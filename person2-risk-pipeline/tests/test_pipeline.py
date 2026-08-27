import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from risk_pipeline.config import Settings
from risk_pipeline.contracts import DataProvider
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.factory import build_pipeline
from risk_pipeline.validation import BasicValidator
from pipeline.feature_engineering import FeatureEngineering


class PipelineSmokeTest(unittest.TestCase):
    def test_synthetic_pipeline_runs_with_explicit_unknown_model(self) -> None:
        settings = Settings.from_mapping({"source": {"record_count": 3, "seed": 1}})
        results = build_pipeline(settings).run()
        self.assertEqual(len(results), 3)
        self.assertEqual(results[0].prediction.model_version, "untrained")
        self.assertTrue(results[0].explanation)


class SyntheticDataProviderTest(unittest.TestCase):
    def test_provider_contract_lookup_count_and_reproducibility(self) -> None:
        first = SyntheticDataProvider(project_count=12, seed=42)
        second = SyntheticDataProvider(project_count=12, seed=42)
        self.assertIsInstance(first, DataProvider)
        self.assertEqual(first.get_project_count(), 12)
        self.assertEqual(first.get_projects(), second.get_projects())
        self.assertEqual(first.get_project("project-0003"), first.get_projects()[3])
        self.assertIsNone(first.get_project("missing"))
        self.assertEqual({project.dataset_label for project in first.get_projects()}, {"SYNTHETIC"})
        self.assertEqual({project.category for project in first.get_projects()}, set(SyntheticDataProvider.CATEGORIES))

    def test_generated_records_pass_project_validation(self) -> None:
        projects = SyntheticDataProvider(project_count=18, seed=9).get_projects()
        self.assertEqual(len(BasicValidator().validate(projects)), 18)

    def test_validator_rejects_duplicate_ids_and_bad_values(self) -> None:
        project = SyntheticDataProvider(project_count=1, seed=1).get_projects()[0]
        validator = BasicValidator()
        with self.assertRaises(ValueError):
            validator.validate((project, project))
        with self.assertRaises(ValueError):
            validator.validate((replace(project, physical_progress=101),))
        with self.assertRaises(ValueError):
            validator.validate((replace(project, amount_utilized=project.amount_paid + 1),))
        with self.assertRaises(ValueError):
            validator.validate((replace(project, latitude=91),))
        with self.assertRaises(ValueError):
            validator.validate((replace(project, planned_end=project.planned_start),))
        with self.assertRaises(ValueError):
            validator.validate((replace(project, district=""),))


class FeatureEngineeringTest(unittest.TestCase):
    def setUp(self) -> None:
        self.project = SyntheticDataProvider(project_count=6, seed=7).get_projects()[0]
        self.reference_date = datetime(2026, 6, 1, tzinfo=timezone.utc)

    def test_normal_project_features_and_train_fitted_peer_ratio(self) -> None:
        transformer = FeatureEngineering(reference_date=self.reference_date)
        features = transformer.fit_transform((self.project,))
        values = features[0].values
        self.assertAlmostEqual(values["payment_ratio"], self.project.amount_paid / self.project.amount_released)
        self.assertAlmostEqual(values["cost_ratio"], self.project.project_cost / self.project.sanctioned_amount)
        self.assertEqual(values["peer_cost_ratio"], 1.0)
        self.assertNotIn("project_id", values)

    def test_zero_denominators_are_explicitly_missing(self) -> None:
        zero = replace(self.project, sanctioned_amount=0, project_cost=0, amount_released=0, amount_paid=0, amount_utilized=0)
        values = FeatureEngineering(reference_date=self.reference_date).transform((zero,))[0].values
        self.assertNotIn("cost_ratio", values)
        self.assertEqual(values["missing_cost_ratio"], 1.0)
        self.assertEqual(values["missing_payment_ratio"], 1.0)
        self.assertEqual(values["missing_peer_cost_ratio"], 1.0)

    def test_zero_progress_and_missing_values_are_not_silently_zeroed(self) -> None:
        zero_progress = replace(self.project, physical_progress=0)
        values = FeatureEngineering(reference_date=self.reference_date).transform((zero_progress,))[0].values
        self.assertNotIn("cost_per_progress_unit", values)
        self.assertEqual(values["missing_cost_per_progress_unit"], 1.0)
        missing_dates = replace(self.project, actual_start=None, actual_end=None)
        values = FeatureEngineering(reference_date=self.reference_date).transform((missing_dates,))[0].values
        self.assertNotIn("actual_duration_days", values)
        self.assertEqual(values["missing_actual_duration_days"], 1.0)

    def test_delayed_and_completed_projects(self) -> None:
        delayed_end = self.project.planned_end + timedelta(days=20)
        delayed = replace(self.project, actual_end=delayed_end)
        values = FeatureEngineering(reference_date=self.reference_date).transform((delayed,))[0].values
        self.assertEqual(values["delay_days"], 20)
        self.assertGreater(values["delay_ratio"], 0)
        completed = replace(self.project, actual_end=self.project.planned_end)
        values = FeatureEngineering(reference_date=self.reference_date).transform((completed,))[0].values
        self.assertEqual(values["delay_days"], 0)

    def test_invalid_date_is_rejected_before_feature_engineering(self) -> None:
        invalid = replace(self.project, actual_start=self.project.planned_end, actual_end=self.project.planned_start)
        with self.assertRaises(ValueError):
            BasicValidator().validate((invalid,))

    def test_extreme_financial_values_remain_finite(self) -> None:
        extreme = replace(self.project, sanctioned_amount=10**15, project_cost=10**15, amount_released=10**15, amount_paid=10**15, amount_utilized=10**15)
        values = FeatureEngineering(reference_date=self.reference_date).transform((extreme,))[0].values
        self.assertTrue(all(abs(value) < float("inf") for value in values.values()))


if __name__ == "__main__":
    unittest.main()
