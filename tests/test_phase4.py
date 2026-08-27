import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from pipeline.feature_engineering import FeatureEngineering
from pipeline.isolation_forest import FEATURE_SCHEMA, IsolationForestDetector, IsolationForestParameters
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.validation import BasicValidator


class IsolationForestPhase4Test(unittest.TestCase):
    def setUp(self) -> None:
        records = tuple(BasicValidator().validate(SyntheticDataProvider(24, 7).get_projects()))
        transformer = FeatureEngineering(reference_date=datetime(2026, 6, 1, tzinfo=timezone.utc))
        self.features = tuple(transformer.fit_transform(records))

    def test_training_creates_all_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            detector = IsolationForestDetector.fit(self.features, IsolationForestParameters(n_estimators=25), "test-v1")
            detector.save(directory, IsolationForestParameters(n_estimators=25), "synthetic-test")
            paths = {path.name for path in Path(directory).iterdir()}
            self.assertEqual(paths, {"model.pkl", "preprocessing.pkl", "feature_schema.json", "metadata.json"})
            metadata = json.loads((Path(directory) / "metadata.json").read_text(encoding="utf-8"))
            self.assertEqual(metadata["model_version"], "test-v1")
            self.assertEqual(metadata["feature_names"], list(FEATURE_SCHEMA))

    def test_loading_schema_preprocessing_and_model_supports_inference(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            parameters = IsolationForestParameters(n_estimators=25)
            IsolationForestDetector.fit(self.features, parameters, "test-v1").save(directory, parameters, "synthetic-test")
            loaded = IsolationForestDetector.load(directory)
            results = loaded.detect(self.features[:3])
            self.assertEqual(loaded.model_version, "test-v1")
            self.assertEqual(len(results), 3)
            self.assertTrue(all(result.raw_score is not None for result in results))
            self.assertTrue(all(result.model_version == "test-v1" for result in results))

    def test_inference_does_not_retrain_loaded_model(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            parameters = IsolationForestParameters(n_estimators=25)
            IsolationForestDetector.fit(self.features, parameters, "test-v1").save(directory, parameters, "synthetic-test")
            loaded = IsolationForestDetector.load(directory)
            fitted_estimators = tuple(loaded.model.estimators_)
            loaded.detect(self.features)
            self.assertEqual(tuple(loaded.model.estimators_), fitted_estimators)

    def test_missing_nan_and_infinite_values_are_handled(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            parameters = IsolationForestParameters(n_estimators=25)
            detector = IsolationForestDetector.fit(self.features, parameters, "test-v1")
            detector.save(directory, parameters, "synthetic-test")
            loaded = IsolationForestDetector.load(directory)
            values = dict(self.features[0].values)
            values.pop("payment_ratio", None)
            values["utilization_ratio"] = float("nan")
            values["cost_ratio"] = float("inf")
            result = loaded.detect((type(self.features[0])(self.features[0].project_id, values),))[0]
            self.assertGreaterEqual(result.score, 0.0)
            self.assertLessEqual(result.score, 1.0)

    def test_score_normalization_direction_and_bounds(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            parameters = IsolationForestParameters(n_estimators=25)
            detector = IsolationForestDetector.fit(self.features, parameters, "test-v1")
            detector.save(directory, parameters, "synthetic-test")
            self.assertEqual(detector._normalize(detector.score_low), 0.0)
            self.assertEqual(detector._normalize(detector.score_high), 1.0)
            self.assertGreater(detector._normalize(detector.score_high), detector._normalize(detector.score_low))

    def test_fixed_seed_is_deterministic(self) -> None:
        parameters = IsolationForestParameters(n_estimators=25, random_state=99)
        first = IsolationForestDetector.fit(self.features, parameters, "test-v1")
        second = IsolationForestDetector.fit(self.features, parameters, "test-v1")
        first_scores = [result.raw_score for result in first.detect(self.features)]
        second_scores = [result.raw_score for result in second.detect(self.features)]
        self.assertEqual(first_scores, second_scores)

    def test_production_factory_no_longer_references_placeholder(self) -> None:
        factory_source = Path("risk_pipeline/factory.py").read_text(encoding="utf-8")
        self.assertNotIn("PlaceholderIsolationForest", factory_source)
        self.assertIn("IsolationForestDetector.load", factory_source)


if __name__ == "__main__":
    unittest.main()
