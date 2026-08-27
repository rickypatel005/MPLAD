from __future__ import annotations

from dataclasses import asdict, is_dataclass
import json
from pathlib import Path
from typing import Any

from risk_pipeline.config import Settings
from risk_pipeline.factory import build_pipeline


class ProjectNotFoundError(LookupError):
    pass


class PipelineService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def risk_for_project(self, project_id: str) -> dict[str, Any]:
        pipeline = build_pipeline(self.settings)
        results = pipeline.run()
        for result in results:
            if result.project_id == project_id:
                return serialize_public(result)
        raise ProjectNotFoundError(project_id)

    def model_status(self) -> dict[str, Any]:
        artifact_dir = Path(self.settings.isolation_forest_artifact_dir)
        required = ("model.pkl", "preprocessing.pkl", "feature_schema.json", "metadata.json")
        available = all((artifact_dir / filename).is_file() for filename in required)
        version = None
        if available:
            with (artifact_dir / "metadata.json").open(encoding="utf-8") as stream:
                version = json.load(stream).get("model_version")
        return {"isolation_forest": {"available": available, "version": version}}


def serialize_public(value: Any) -> Any:
    if is_dataclass(value):
        return {key: serialize_public(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {str(key): serialize_public(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize_public(item) for item in value]
    return value
