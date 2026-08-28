from __future__ import annotations

from dataclasses import asdict, is_dataclass
import json
from pathlib import Path
from typing import Any

from datetime import datetime, timezone

from risk_pipeline.config import Settings
from risk_pipeline.contracts import ProjectRecord
from risk_pipeline.factory import build_pipeline


class ProjectNotFoundError(LookupError):
    pass


def dict_to_project_record(data: dict[str, Any]) -> ProjectRecord:
    def parse_dt(v: Any) -> datetime | None:
        if not v:
            return None
        if isinstance(v, datetime):
            return v
        s = str(v).replace("Z", "+00:00")
        if "T" not in s and len(s) == 10:
            s = f"{s}T00:00:00+00:00"
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None

    planned_start = parse_dt(data.get("planned_start") or data.get("start_date") or data.get("sanction_date")) or datetime.now(timezone.utc)
    planned_end = parse_dt(data.get("planned_end") or data.get("expected_completion_date")) or datetime.now(timezone.utc)
    actual_start = parse_dt(data.get("actual_start") or data.get("start_date"))
    actual_end = parse_dt(data.get("actual_end") or data.get("actual_completion_date"))

    loc = data.get("location") if isinstance(data.get("location"), dict) else {}
    lat = float(data.get("latitude") or loc.get("latitude") or data.get("work_lat") or 0.0)
    lon = float(data.get("longitude") or loc.get("longitude") or data.get("work_lon") or 0.0)

    sanction = float(data.get("sanctioned_amount") or data.get("sanction_amount") or (data.get("estimated_cost_lakhs", 0) * 100000) or 100000.0)
    cost = float(data.get("project_cost") or data.get("sanction_amount") or sanction)
    
    fin_prog = float(data.get("financial_progress") or 0.0)
    released = float(data.get("amount_released") or (fin_prog / 100.0 * sanction) or 0.0)
    paid = float(data.get("amount_paid") or (data.get("total_paid_lakhs", 0) * 100000) or released)
    utilized = float(data.get("amount_utilized") or paid)
    progress = float(data.get("physical_progress") or 0.0)

    return ProjectRecord(
        project_id=str(data.get("project_id", "P_UNKNOWN")),
        sanctioned_amount=sanction,
        project_cost=cost,
        amount_released=released,
        amount_paid=paid,
        amount_utilized=utilized,
        physical_progress=progress,
        planned_start=planned_start,
        planned_end=planned_end,
        actual_start=actual_start,
        actual_end=actual_end,
        implementing_agency=str(data.get("implementing_agency") or data.get("ia_id") or data.get("ia_name") or "IA_DEFAULT"),
        district=str(data.get("district") or data.get("district_id") or data.get("district_name") or "DISTRICT_DEFAULT"),
        constituency=str(data.get("constituency") or data.get("constituency_id") or data.get("constituency_name") or "CONST_DEFAULT"),
        latitude=lat,
        longitude=lon,
        category=str(data.get("category") or data.get("work_type") or "ROAD"),
        dataset_label=str(data.get("dataset_label") or "LIVE"),
        metadata=data.get("metadata") if isinstance(data.get("metadata"), dict) else {},
    )


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

    def score_projects_payload(self, raw_projects: list[dict[str, Any]]) -> list[dict[str, Any]]:
        records = [dict_to_project_record(p) for p in raw_projects]
        pipeline = build_pipeline(self.settings)
        results = pipeline.score_records(records)
        return [serialize_public(r) for r in results]

    def score_single_project_payload(self, raw_project: dict[str, Any]) -> dict[str, Any]:
        results = self.score_projects_payload([raw_project])
        if not results:
            raise ValueError("Failed to score project payload")
        return results[0]

    def model_status(self) -> dict[str, Any]:
        artifact_dir = Path(self.settings.isolation_forest_artifact_dir)
        required = ("model.pkl", "preprocessing.pkl", "feature_schema.json", "metadata.json")
        available = all((artifact_dir / filename).is_file() for filename in required)
        version = None
        if available:
            with (artifact_dir / "metadata.json").open(encoding="utf-8") as stream:
                version = json.load(stream).get("model_version")
        return {
            "isolation_forest": {"available": available, "version": version or "v1"},
            "rule_engine": {"available": True, "version": "v1"},
            "model_source": "person2-risk-service",
            "mode": "REAL",
        }


def serialize_public(value: Any) -> Any:
    if is_dataclass(value):
        return {key: serialize_public(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {str(key): serialize_public(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize_public(item) for item in value]
    return value

