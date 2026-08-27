from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Settings:
    pipeline_name: str
    pipeline_version: str
    source_kind: str
    record_count: int
    seed: int
    rule_risk_threshold: float
    anomaly_risk_threshold: float
    high_risk_threshold: float
    log_level: str
    financial_weight: float = 0.30
    timeline_weight: float = 0.20
    compliance_weight: float = 0.20
    anomaly_weight: float = 0.20
    prediction_weight: float = 0.10
    medium_risk_threshold: float = 0.33
    isolation_forest_artifact_dir: str = "models/isolation_forest/v1"

    @classmethod
    def from_mapping(cls, raw: dict[str, Any]) -> "Settings":
        pipeline = raw.get("pipeline", {})
        source = raw.get("source", {})
        thresholds = raw.get("thresholds", {})
        logging = raw.get("logging", {})
        aggregation = raw.get("aggregation", {})
        return cls(
            pipeline_name=str(pipeline.get("name", "person-risk")),
            pipeline_version=str(pipeline.get("version", "0.1.0")),
            source_kind=str(source.get("kind", "synthetic")),
            record_count=int(source.get("record_count", 25)),
            seed=int(source.get("seed", 7)),
            rule_risk_threshold=float(thresholds.get("rule_risk", 0.5)),
            anomaly_risk_threshold=float(thresholds.get("anomaly_risk", 0.7)),
            high_risk_threshold=float(thresholds.get("high_risk", 0.75)),
            log_level=str(logging.get("level", "INFO")),
            financial_weight=float(aggregation.get("financial_weight", 0.30)),
            timeline_weight=float(aggregation.get("timeline_weight", 0.20)),
            compliance_weight=float(aggregation.get("compliance_weight", 0.20)),
            anomaly_weight=float(aggregation.get("anomaly_weight", 0.20)),
            prediction_weight=float(aggregation.get("prediction_weight", 0.10)),
            medium_risk_threshold=float(aggregation.get("medium_threshold", 0.33)),
            isolation_forest_artifact_dir=str(raw.get("models", {}).get("isolation_forest_artifact_dir", "models/isolation_forest/v1")),
        )


def load_settings(path: str | Path | None = None) -> Settings:
    config_path = Path(path or os.getenv("RISK_PIPELINE_CONFIG", "config/default.json"))
    with config_path.open(encoding="utf-8") as stream:
        return Settings.from_mapping(json.load(stream))
