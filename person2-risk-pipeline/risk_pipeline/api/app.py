from __future__ import annotations

import re
from typing import Any

try:
    from fastapi import FastAPI, HTTPException
except ImportError as exc:
    raise RuntimeError("Install optional API dependencies with pip install -e .[api]") from exc

from risk_pipeline.api.service import ProjectNotFoundError, PipelineService, serialize_public
from risk_pipeline.config import load_settings
from risk_pipeline.factory import build_pipeline

app = FastAPI(title="Person Risk Pipeline", version="0.1.0")
_PROJECT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


def service() -> PipelineService:
    return PipelineService(load_settings())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/models")
def model_health() -> dict[str, Any]:
    return service().model_status()


@app.get("/projects/{project_id}/risk")
def project_risk(project_id: str) -> dict[str, Any]:
    if not _PROJECT_ID.fullmatch(project_id):
        raise HTTPException(status_code=422, detail="Invalid project ID")
    try:
        return service().risk_for_project(project_id)
    except ProjectNotFoundError:
        raise HTTPException(status_code=404, detail="Project not found") from None
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Required risk model is unavailable") from None
    except ValueError:
        raise HTTPException(status_code=422, detail="Project data failed validation") from None
    except (KeyError, TypeError):
        raise HTTPException(status_code=503, detail="Risk pipeline configuration is unavailable") from None


@app.post("/risk/run")
def run_risk() -> dict[str, Any]:
    try:
        results = build_pipeline(load_settings()).run()
        return {"count": len(results), "results": [serialize_public(result) for result in results]}
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Required risk model is unavailable") from None
    except ValueError:
        raise HTTPException(status_code=422, detail="Project data failed validation") from None
