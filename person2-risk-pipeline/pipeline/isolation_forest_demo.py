from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone

from pipeline.feature_engineering import FeatureEngineering
from pipeline.isolation_forest import IsolationForestDetector
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.validation import BasicValidator


def main() -> None:
    projects = tuple(BasicValidator().validate(SyntheticDataProvider(60, 7).get_projects()))
    feature_engineer = FeatureEngineering(reference_date=datetime(2026, 6, 1, tzinfo=timezone.utc))
    features = tuple(feature_engineer.fit_transform(projects))
    detector = IsolationForestDetector.load("models/isolation_forest/v1")
    signals = detector.detect(features)
    rows = []
    for project, feature, signal in zip(projects, features, signals):
        rows.append({
            "project_id": project.project_id,
            "features": {name: feature.values.get(name) for name in detector.feature_schema},
            "raw_isolation_forest_output": signal.raw_score,
            "normalized_anomaly_score": signal.score,
            "is_anomaly": signal.is_anomaly,
            "model_version": signal.model_version,
        })
    ordered = sorted(rows, key=lambda row: row["normalized_anomaly_score"])
    print(json.dumps({"normal_examples": ordered[:5], "anomalous_examples": ordered[-5:]}, indent=2))


if __name__ == "__main__":
    main()
