from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from risk_pipeline.contracts import AnomalyDetector, AnomalyFinding, FeatureVector


FEATURE_SCHEMA = (
    "cost_ratio",
    "release_ratio",
    "payment_ratio",
    "utilization_ratio",
    "payment_progress_gap",
    "utilization_progress_gap",
    "physical_progress",
    "remaining_budget_ratio",
)


@dataclass(frozen=True)
class IsolationForestParameters:
    n_estimators: int = 200
    contamination: float = 0.10
    max_samples: str | int = "auto"
    max_features: float = 1.0
    random_state: int = 42


class IsolationForestDetector(AnomalyDetector):
    """Load-only inference wrapper for a persisted Isolation Forest artifact."""

    detector_id = "isolation-forest"

    def __init__(self, model, preprocessor, feature_schema: Sequence[str], model_version: str, score_low: float, score_high: float) -> None:
        self.model = model
        self.preprocessor = preprocessor
        self.feature_schema = tuple(feature_schema)
        self.model_version = model_version
        self.score_low = score_low
        self.score_high = score_high

    @classmethod
    def fit(cls, features: Sequence[FeatureVector], parameters: IsolationForestParameters, model_version: str) -> "IsolationForestDetector":
        matrix = cls._matrix(features, FEATURE_SCHEMA)
        preprocessor = _build_preprocessor()
        transformed = preprocessor.fit_transform(matrix)
        model = IsolationForest(
            n_estimators=parameters.n_estimators,
            contamination=parameters.contamination,
            max_samples=parameters.max_samples,
            max_features=parameters.max_features,
            random_state=parameters.random_state,
        )
        model.fit(transformed)
        raw_scores = -model.decision_function(transformed)
        low, high = np.percentile(raw_scores, [5, 95])
        if math.isclose(float(low), float(high)):
            high = float(low) + 1.0
        return cls(model, preprocessor, FEATURE_SCHEMA, model_version, float(low), float(high))

    def detect(self, features: Sequence[FeatureVector]) -> Sequence[AnomalyFinding]:
        if not features:
            return ()
        transformed = self.preprocessor.transform(self._matrix(features, self.feature_schema))
        raw_scores = -self.model.decision_function(transformed)
        labels = self.model.predict(transformed)
        return tuple(
            AnomalyFinding(
                detector_id=self.detector_id,
                is_anomaly=bool(label == -1),
                score=self._normalize(float(raw_score)),
                message="Isolation Forest flagged this record" if label == -1 else "Isolation Forest did not flag this record",
                raw_score=float(raw_score),
                model_version=self.model_version,
            )
            for raw_score, label in zip(raw_scores, labels)
        )

    def save(self, artifact_dir: str | Path, parameters: IsolationForestParameters, dataset_version: str) -> None:
        directory = Path(artifact_dir)
        directory.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, directory / "model.pkl")
        joblib.dump(self.preprocessor, directory / "preprocessing.pkl")
        (directory / "feature_schema.json").write_text(json.dumps(list(self.feature_schema), indent=2), encoding="utf-8")
        metadata = {
            "model_name": self.detector_id,
            "model_version": self.model_version,
            "training_date": datetime.now(timezone.utc).isoformat(),
            "feature_names": list(self.feature_schema),
            "preprocessing_version": "simple-imputer-median-plus-standard-scaler-v1",
            "isolation_forest_parameters": parameters.__dict__,
            "dataset_version": dataset_version,
            "random_seed": parameters.random_state,
            "score_normalization": {"raw_score": "-decision_function", "low": self.score_low, "high": self.score_high, "formula": "clamp((raw-low)/(high-low), 0, 1)"},
        }
        (directory / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, artifact_dir: str | Path) -> "IsolationForestDetector":
        directory = Path(artifact_dir)
        with (directory / "feature_schema.json").open(encoding="utf-8") as stream:
            schema = tuple(json.load(stream))
        with (directory / "metadata.json").open(encoding="utf-8") as stream:
            metadata = json.load(stream)
        normalization = metadata["score_normalization"]
        return cls(
            model=joblib.load(directory / "model.pkl"),
            preprocessor=joblib.load(directory / "preprocessing.pkl"),
            feature_schema=schema,
            model_version=metadata["model_version"],
            score_low=float(normalization["low"]),
            score_high=float(normalization["high"]),
        )

    def _normalize(self, raw_score: float) -> float:
        return min(max((raw_score - self.score_low) / (self.score_high - self.score_low), 0.0), 1.0)

    @staticmethod
    def _matrix(features: Sequence[FeatureVector], schema: Sequence[str]) -> np.ndarray:
        rows = []
        for feature in features:
            rows.append([_finite_or_nan(feature.values.get(name)) for name in schema])
        return np.asarray(rows, dtype=float)


def _finite_or_nan(value: float | None) -> float:
    if value is None or not math.isfinite(float(value)):
        return np.nan
    return float(value)


def _build_preprocessor() -> Pipeline:
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
