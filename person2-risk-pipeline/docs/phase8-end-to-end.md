# Phase 8: End-to-End Pipeline

## Runtime flow

`SyntheticDataProvider -> BasicValidator -> FeatureEngineering -> ConfigurableRuleEngine -> PlaceholderStatisticalDetector -> IsolationForestDetector -> PredictionUnavailableModel -> RiskEngine -> ExplanationEngine -> RiskAssessment`

The provider remains a `DataProvider`, so a future `DatabaseProvider` can be injected without changing orchestration. All source records are validated before cost reference fitting, feature generation, or downstream analysis.

## Single-pass execution

`RiskPipeline.run()` validates once, fits the cost reference once on validated records, transforms features once, runs the statistical and Isolation Forest detectors once per batch, then evaluates each rule/signal once per project. The same signal objects are passed to `RiskEngine` and `ExplanationEngine`; explanations do not recompute them.

`run(trace=True)` emits stage-level diagnostics through the existing logger. The CLI exposes this as `python -m risk_pipeline.cli --trace`.

## Final output contract

Each result is a `RiskAssessment` containing:

- `project_id`
- `overall_score`, `risk_level`, `overall_risk_level`
- `financial_score`, `timeline_score`, `compliance_score`, `anomaly_score`, `prediction_score`
- `highest_finding_severity`, `critical_finding_count`
- `information_status`, `information_confidence`
- `prediction_status`, `model_version`, `isolation_forest_model_version`, and the prediction object
- source-labelled `reasons` with `source`, `severity`, and `reason`

Scores and thresholds are unchanged from Phase 6. Prediction remains unavailable because no legitimate labelled target exists.

## Model loading

`IsolationForestDetector` loads `models/isolation_forest/v1/model.pkl`, `preprocessing.pkl`, `feature_schema.json`, and `metadata.json`. The factory never trains the model. Missing or malformed artifacts fail loudly at startup rather than silently producing a risk result.

## Error handling

Validation rejects empty input, missing required values, invalid financial relationships, invalid dates, invalid percentages, duplicate IDs, and invalid coordinates. Missing optional actual dates produce a partial-information state and no invented delay. Missing model artifacts or metadata errors are not swallowed.

## Demonstration

Run:

```powershell
d:/SIH-MODELS/.venv/Scripts/python.exe -m pipeline.phase8_demo
```

The demonstration processes the configured synthetic dataset and prints ten actual final assessments. It is labelled as synthetic development validation and is not real-world performance or accuracy.

## Limitations

The statistical detector is still the Phase 3 placeholder. Supervised prediction is explicitly unavailable. Person 3 signals, APIs, calibration, drift monitoring, and production database adapters are out of scope.
