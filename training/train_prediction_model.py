from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

import joblib
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from pipeline.delay_prediction import PREDICTION_FEATURE_SCHEMA, build_xgboost_classifier
from pipeline.feature_engineering import FeatureEngineering
from risk_pipeline.contracts import ProjectRecord


@dataclass(frozen=True)
class LabelledProject:
    project: ProjectRecord
    target: int


def validate_target(examples: Sequence[LabelledProject], target_name: str = "project_delay") -> None:
    """Reject absent, non-binary, or non-outcome labels before any model training."""
    if not examples:
        raise ValueError(f"No labelled examples supplied for target {target_name!r}")
    targets = [example.target for example in examples]
    if any(target not in (0, 1) for target in targets):
        raise ValueError("project_delay must be a binary observed outcome: 0 or 1")
    if len(set(targets)) < 2:
        raise ValueError("Training target must contain both classes")


def train(examples: Sequence[LabelledProject], output_dir: str | Path = "models/prediction/v1") -> dict[str, object]:
    """Train and persist XGBoost when a future real labelled dataset is supplied."""
    validate_target(examples)
    ordered = sorted(examples, key=lambda example: example.project.planned_start)
    train_end = max(2, int(len(ordered) * 0.6))
    validation_end = max(train_end + 1, int(len(ordered) * 0.8))
    if validation_end >= len(ordered):
        raise ValueError("At least five labelled examples are required for train/validation/test splits")
    training, validation, test = ordered[:train_end], ordered[train_end:validation_end], ordered[validation_end:]
    feature_engineer = FeatureEngineering(reference_date=training[-1].project.planned_start)
    training_features = feature_engineer.fit_transform(tuple(example.project for example in training))
    validation_features = feature_engineer.transform(tuple(example.project for example in validation))
    test_features = feature_engineer.transform(tuple(example.project for example in test))
    preprocessor = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())])
    training_matrix = _matrix(training_features)
    validation_matrix = _matrix(validation_features)
    test_matrix = _matrix(test_features)
    x_train = preprocessor.fit_transform(training_matrix)
    x_validation = preprocessor.transform(validation_matrix)
    x_test = preprocessor.transform(test_matrix)
    parameters = {"max_depth": 3, "min_child_weight": 1, "learning_rate": 0.05, "subsample": 0.8, "colsample_bytree": 0.8, "reg_alpha": 0.1, "reg_lambda": 1.0, "gamma": 0.0, "n_estimators": 300, "random_state": 42}
    model = build_xgboost_classifier(parameters)
    model.fit(x_train, _targets(training), eval_set=[(x_validation, _targets(validation))], verbose=False)
    metrics = {"validation": _metrics(model, x_validation, _targets(validation)), "test": _metrics(model, x_test, _targets(test))}
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, directory / "model.pkl")
    joblib.dump(preprocessor, directory / "preprocessing.pkl")
    (directory / "feature_schema.json").write_text(json.dumps(list(PREDICTION_FEATURE_SCHEMA), indent=2), encoding="utf-8")
    (directory / "metadata.json").write_text(json.dumps({"model_name": "xgboost-supervised-prediction", "model_version": "v1", "target": "project_delay", "feature_names": list(PREDICTION_FEATURE_SCHEMA), "training_dataset_version": "real-labelled-dataset-required", "preprocessing_version": "simple-imputer-median-plus-standard-scaler-v1", "hyperparameters": parameters, "metrics": metrics, "training_date": datetime.now(timezone.utc).isoformat(), "calibration": "not calibrated"}, indent=2), encoding="utf-8")
    return metrics


def _matrix(features) -> np.ndarray:
    return np.asarray([[feature.values.get(name, np.nan) for name in PREDICTION_FEATURE_SCHEMA] for feature in features], dtype=float)


def _targets(examples: Sequence[LabelledProject]) -> np.ndarray:
    return np.asarray([example.target for example in examples], dtype=int)


def _metrics(model, features: np.ndarray, targets: np.ndarray) -> dict[str, object]:
    probabilities = model.predict_proba(features)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    return {"precision": precision_score(targets, predictions, zero_division=0), "recall": recall_score(targets, predictions, zero_division=0), "f1": f1_score(targets, predictions, zero_division=0), "roc_auc": roc_auc_score(targets, probabilities) if len(set(targets)) == 2 else None, "pr_auc": average_precision_score(targets, probabilities) if len(set(targets)) == 2 else None, "confusion_matrix": confusion_matrix(targets, predictions).tolist()}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train supervised prediction model from real labelled projects")
    parser.parse_args()
    raise RuntimeError("No real labelled dataset is configured; supervised model training is unavailable")


if __name__ == "__main__":
    main()
