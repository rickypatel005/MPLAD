# Person 2 Risk + ML Pipeline

A contract-first skeleton for project risk and anomaly detection. It currently runs on deterministic synthetic records and is designed to accept a real database adapter later.

## Pipeline

`source -> validation -> features -> rules -> statistical anomaly -> isolation forest -> prediction -> aggregation -> explanation`

ML model training is intentionally separate from inference. No accuracy or real-world behavior is claimed in this phase.

## Folder structure

```text
config/                         JSON runtime configuration
data/raw/                       Immutable source snapshots (future)
data/interim/                   Intermediate datasets (future)
data/processed/                 Training-ready datasets (future)
docs/                           Architecture and contract notes
models/risk_model/v0.1.0/       Versioned model artifacts (empty placeholder)
risk_pipeline/
	api/                          Optional FastAPI adapter
	data/                         Data source adapters
	models/                       Model package namespace
	aggregation.py                Risk signal combination
	anomaly.py                    Statistical and Isolation Forest seams
	contracts.py                  Typed records and module protocols
	explanation.py                Human-readable explanations
	features.py                   Feature engineering
	pipeline.py                   Runtime orchestration only
	prediction.py                 Pluggable inference predictor
	rules.py                      Deterministic business rules
	validation.py                 Input validation
training/                       Offline training jobs and evaluation
tests/                          Focused contract and behavior tests
```

## Interfaces

The module boundaries are Python `Protocol` interfaces in `risk_pipeline/contracts.py`:

| Boundary | Input | Output |
|---|---|---|
| Data provider | provider configuration | `Sequence[ProjectRecord]` |
| Validation | person records | validated records or `ValueError` |
| Features | validated records | `Sequence[FeatureVector]` |
| Rules | record + feature vector | rule findings |
| Anomaly detectors | feature batch | aligned anomaly findings |
| Prediction | feature vector | versioned `Prediction` |
| Aggregation | record + all signals | `RiskResult` |
| Explanation | `RiskResult` | explanation text |

`SyntheticDataProvider` implements the provider boundary today. `DatabaseProvider` is the replacement seam for a real database. `PlaceholderPredictor` and the two placeholder detectors make deferred ML explicit and keep training separate from inference.

To inspect synthetic projects directly:

```powershell
python -c "from risk_pipeline.data.synthetic import SyntheticDataProvider; print(SyntheticDataProvider(6, 7).get_projects())"
```

## Run

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
python -m risk_pipeline.cli
python -m unittest discover -s tests -v
```

Optional API dependencies are isolated:

```powershell
pip install -e ".[api]"
uvicorn risk_pipeline.api.app:app --reload
```

Feature-engineering demonstration:

```powershell
python -m pipeline.feature_demo
```

Train and persist the Phase 4 Isolation Forest:

```powershell
python -m training.train_isolation_forest
python -m pipeline.isolation_forest_demo
```

Inference loads `models/isolation_forest/v1/model.pkl`, `preprocessing.pkl`, `feature_schema.json`, and `metadata.json`; it never retrains. The normalized anomaly score is a screening score, not a probability.

Fit peer statistics on the training partition only, then reuse the fitted transformer for validation, testing, and inference:

```python
transformer.fit(training_projects)
training_features = transformer.transform(training_projects)
validation_features = transformer.transform(validation_projects)
```

Phase 5 supervised prediction is target-gated because the synthetic dataset has no legitimate observed outcome label. The runtime returns `label="unavailable"` and `probability=None`; it does not fabricate predictions. Future labelled training uses `python -m training.train_prediction_model` after a real labelled dataset adapter is provided. XGBoost support is optional: `pip install -e ".[xgboost]"`.

Phase 6 risk-engine demonstration:

```powershell
python -m pipeline.risk_demo
```

The Phase 7 pipeline output includes ranked, source-labelled reasons. SHAP remains explicitly unavailable until a legitimate supervised model exists.

Complete Phase 8 demonstration with stage trace:

```powershell
d:/SIH-MODELS/.venv/Scripts/python.exe -m pipeline.phase8_demo
```

Configuration can be selected with `RISK_PIPELINE_CONFIG` or `--config`.
