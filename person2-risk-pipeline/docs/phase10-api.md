# Phase 10: API Integration

## Framework

The API uses FastAPI with Uvicorn. It delegates project risk computation to `PipelineService`, which constructs the existing configured pipeline and selects the requested result. The API does not duplicate feature engineering, rules, anomaly detection, risk aggregation, or explanation logic.

## Endpoints

### `GET /health`

Returns:

```json
{"status": "ok"}
```

### `GET /health/models`

Returns model availability without exposing filesystem paths:

```json
{"isolation_forest": {"available": true, "version": "v1"}}
```

### `GET /projects/{project_id}/risk`

The project ID must match `[A-Za-z0-9][A-Za-z0-9_-]{0,63}`. The request runs the existing synthetic-provider pipeline and returns one serialized `RiskAssessment`.

The response includes project ID, category scores, overall score/risk levels, finding severity metadata, information status/confidence, prediction status, model versions, prediction state, and source-labelled reasons.

Current supervised state:

```json
{
  "prediction_status": "unavailable",
  "prediction": {
    "label": "unavailable",
    "probability": null,
    "model_version": "untrained"
  }
}
```

### `POST /risk/run`

Retained as a bulk operational endpoint. Its response now recursively serializes dataclasses to JSON rather than exposing Python representations.

## Errors

- `404`: project ID is valid but not present in the configured provider.
- `422`: invalid project ID or validation failure.
- `503`: required Isolation Forest artifact or pipeline configuration unavailable.

Responses contain public messages only. Stack traces, filesystem paths, and internal exception text are not returned.

## Configuration

The Isolation Forest artifact directory is configured under `models.isolation_forest_artifact_dir` in `config/default.json`. Risk weights and thresholds remain managed by the existing configuration system.

## Run

Install API dependencies and start the server:

```powershell
pip install -e ".[api]"
uvicorn risk_pipeline.api.app:app --reload
```

Example request:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/projects/project-0000/risk
```

The response is a synthetic development result, not real-world performance. Person 3, frontend functionality, new ML models, and XGBoost training are not part of this phase.
