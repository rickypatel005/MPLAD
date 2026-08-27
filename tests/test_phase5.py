import unittest
from dataclasses import replace
from pathlib import Path

from pipeline.prediction_model import PredictionUnavailableModel
from risk_pipeline.contracts import PredictionModel
from risk_pipeline.data.synthetic import SyntheticDataProvider
from training.train_prediction_model import LabelledProject, validate_target


class Phase5SupervisedPredictionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.project = SyntheticDataProvider(1, 7).get_projects()[0]

    def test_prediction_model_interface_and_unavailable_state(self) -> None:
        model = PredictionUnavailableModel()
        self.assertIsInstance(model, PredictionModel)
        prediction = model.predict(type("Features", (), {"project_id": "project-0000", "values": {}})())
        self.assertIsNone(prediction.probability)
        self.assertEqual(prediction.label, "unavailable")
        self.assertEqual(prediction.model_version, "untrained")

    def test_target_validation_requires_observed_binary_outcome(self) -> None:
        with self.assertRaises(ValueError):
            validate_target(())
        with self.assertRaises(ValueError):
            validate_target((LabelledProject(self.project, 2),))
        with self.assertRaises(ValueError):
            validate_target((LabelledProject(self.project, 1),))
        second = replace(self.project, project_id="project-0001")
        validate_target((LabelledProject(self.project, 0), LabelledProject(second, 1)))

    def test_training_entrypoint_does_not_claim_unlabelled_training(self) -> None:
        from training.train_prediction_model import train
        with self.assertRaises(ValueError):
            train(())

    def test_prediction_artifact_directory_is_explicitly_empty(self) -> None:
        self.assertTrue(Path("models/prediction/README.md").exists())
        self.assertFalse(Path("models/prediction/v1/model.pkl").exists())


if __name__ == "__main__":
    unittest.main()
