from __future__ import annotations

from risk_pipeline.contracts import FeatureVector, Prediction, PredictionModel


class PredictionUnavailableModel(PredictionModel):
    """Honest inference result until a validated labelled model artifact exists."""

    model_name = "supervised-prediction"
    model_version = "untrained"

    def predict(self, features: FeatureVector) -> Prediction:
        return Prediction(
            project_id=features.project_id,
            probability=None,
            label="unavailable",
            model_name=self.model_name,
            model_version=self.model_version,
        )
