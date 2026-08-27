from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Sequence

import joblib
import numpy as np

from risk_pipeline.contracts import FeatureVector, Prediction, PredictionModel


PREDICTION_FEATURE_SCHEMA = (
    "cost_ratio",
    "release_ratio",
    "payment_ratio",
    "utilization_ratio",
    "payment_progress_gap",
    "utilization_progress_gap",
    "physical_progress",
    "remaining_budget_ratio",
)


class XGBoostPredictionModel(PredictionModel):
    """Load-only XGBoost classification adapter for a future labelled dataset."""

    model_name = "xgboost-supervised-prediction"

    def __init__(self, model, preprocessor, feature_schema: Sequence[str], model_version: str, target: str) -> None:
        self.model = model
        self.preprocessor = preprocessor
        self.feature_schema = tuple(feature_schema)
        self.model_version = model_version
        self.target = target

    @classmethod
    def load(cls, artifact_dir: str | Path) -> "XGBoostPredictionModel":
        directory = Path(artifact_dir)
        with (directory / "metadata.json").open(encoding="utf-8") as stream:
            metadata = json.load(stream)
        with (directory / "feature_schema.json").open(encoding="utf-8") as stream:
            schema = tuple(json.load(stream))
        return cls(
            model=joblib.load(directory / "model.pkl"),
            preprocessor=joblib.load(directory / "preprocessing.pkl"),
            feature_schema=schema,
            model_version=metadata["model_version"],
            target=metadata["target"],
        )

    def predict(self, features: FeatureVector) -> Prediction:
        matrix = np.asarray([[self._finite_or_nan(features.values.get(name)) for name in self.feature_schema]], dtype=float)
        transformed = self.preprocessor.transform(matrix)
        prediction = int(self.model.predict(transformed)[0])
        probability = float(self.model.predict_proba(transformed)[0, 1])
        return Prediction(
            project_id=features.project_id,
            probability=probability,
            label=str(prediction),
            model_name=self.model_name,
            model_version=self.model_version,
        )

    @staticmethod
    def _finite_or_nan(value: float | None) -> float:
        if value is None or not math.isfinite(float(value)):
            return np.nan
        return float(value)


def build_xgboost_classifier(parameters: dict[str, object]):
    """Create an XGBoost classifier without importing the optional dependency at package import time."""
    try:
        from xgboost import XGBClassifier
    except ImportError as exc:
        raise RuntimeError("Install optional XGBoost support before training a supervised model") from exc
    return XGBClassifier(objective="binary:logistic", eval_metric="logloss", **parameters)
