from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from pipeline.feature_engineering import FeatureEngineering
from pipeline.isolation_forest import IsolationForestDetector, IsolationForestParameters
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.validation import BasicValidator


def train(output_dir: str | Path = "models/isolation_forest/v1", project_count: int = 60, seed: int = 7, parameters: IsolationForestParameters | None = None) -> dict[str, object]:
    raw_projects = SyntheticDataProvider(project_count=project_count, seed=seed).get_projects()
    projects = tuple(BasicValidator().validate(raw_projects))
    split = max(2, int(len(projects) * 0.8))
    reference_date = datetime(2026, 6, 1, tzinfo=timezone.utc)
    feature_engineer = FeatureEngineering(reference_date=reference_date)
    training_features = feature_engineer.fit_transform(projects[:split])
    inference_features = feature_engineer.transform(projects[split:])
    parameters = parameters or IsolationForestParameters()
    detector = IsolationForestDetector.fit(training_features, parameters, "v1")
    detector.save(output_dir, parameters, f"synthetic-seed-{seed}-count-{project_count}")
    all_signals = detector.detect(tuple(training_features) + tuple(inference_features))
    flagged = sum(signal.is_anomaly for signal in all_signals)
    summary = {
        "dataset": "SYNTHETIC",
        "projects": len(projects),
        "training_projects": split,
        "evaluation_projects": len(projects) - split,
        "flagged": flagged,
        "flagged_percentage": round(flagged / len(projects) * 100, 2),
        "artifact_dir": str(Path(output_dir)),
        "model_version": detector.model_version,
        "score_min": min(signal.score for signal in all_signals),
        "score_max": max(signal.score for signal in all_signals),
    }
    print(json.dumps(summary, indent=2))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and persist the synthetic-data Isolation Forest")
    parser.add_argument("--output-dir", default="models/isolation_forest/v1")
    parser.add_argument("--project-count", type=int, default=60)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--contamination", type=float, default=0.10)
    parser.add_argument("--max-samples", default="auto")
    parser.add_argument("--max-features", type=float, default=1.0)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()
    parameters = IsolationForestParameters(args.n_estimators, args.contamination, args.max_samples, args.max_features, args.random_state)
    train(args.output_dir, args.project_count, args.seed, parameters)


if __name__ == "__main__":
    main()
