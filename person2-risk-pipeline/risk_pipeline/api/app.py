from __future__ import annotations

import re
from typing import Any

try:
    from fastapi import FastAPI, HTTPException, Body
    from fastapi.middleware.cors import CORSMiddleware
except ImportError as exc:
    raise RuntimeError("Install optional API dependencies with pip install -e .[api]") from exc

from risk_pipeline.api.service import ProjectNotFoundError, PipelineService, serialize_public
from risk_pipeline.config import load_settings
from risk_pipeline.factory import build_pipeline

app = FastAPI(title="Person 2 Risk & ML Pipeline", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PROJECT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


def service() -> PipelineService:
    return PipelineService(load_settings())


@app.get("/")
def read_root() -> dict[str, Any]:
    return {"message": "Person 2 Risk and ML Pipeline Service is running", "service": "person2-risk-pipeline", "status": "ok"}


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


@app.post("/projects/score")
def score_project(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Scores a single real project payload using the Isolation Forest & Rule pipeline."""
    try:
        return service().score_single_project_payload(payload)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Required risk model artifact is unavailable") from None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Project payload failed validation: {exc}") from None
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk scoring pipeline error: {exc}") from None


@app.post("/projects/score-batch")
def score_projects_batch(payload: list[dict[str, Any]] = Body(...)) -> dict[str, Any]:
    """Scores a batch of real project payloads using the Isolation Forest & Rule pipeline."""
    try:
        results = service().score_projects_payload(payload)
        return {"count": len(results), "results": results}
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Required risk model artifact is unavailable") from None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Projects batch failed validation: {exc}") from None
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Batch scoring pipeline error: {exc}") from None


@app.post("/risk/run")
def run_risk() -> dict[str, Any]:
    try:
        results = build_pipeline(load_settings()).run()
        return {"count": len(results), "results": [serialize_public(result) for result in results]}
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Required risk model is unavailable") from None
    except ValueError:
        raise HTTPException(status_code=422, detail="Project data failed validation") from None

