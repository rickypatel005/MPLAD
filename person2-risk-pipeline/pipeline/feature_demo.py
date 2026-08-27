from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone

from pipeline.feature_engineering import FeatureEngineering
from risk_pipeline.data.synthetic import SyntheticDataProvider
from risk_pipeline.validation import BasicValidator


def main() -> None:
    raw = SyntheticDataProvider(project_count=1, seed=7).get_projects()
    validated = BasicValidator().validate(raw)
    transformer = FeatureEngineering(reference_date=datetime(2026, 6, 1, tzinfo=timezone.utc))
    engineered = transformer.fit_transform(validated)
    print("RAW PROJECT")
    print(json.dumps(asdict(raw[0]), default=str, indent=2))
    print("VALIDATED PROJECT")
    print(json.dumps(asdict(validated[0]), default=str, indent=2))
    print("ENGINEERED FEATURES")
    print(json.dumps({"project_id": engineered[0].project_id, **engineered[0].values}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
