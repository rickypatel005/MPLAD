from __future__ import annotations

from risk_pipeline.contracts import FeatureVector, Prediction, Predictor


class PlaceholderPredictor(Predictor):
    model_name = "no-model"
    model_version = "untrained"

    def predict(self, features: FeatureVector) -> Prediction:
        return Prediction(features.project_id, None, "unknown", self.model_name, self.model_version)
