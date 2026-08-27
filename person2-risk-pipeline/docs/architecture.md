# Architecture

## Runtime flow

`DataProvider.get_projects` returns `ProjectRecord` values. `Validator.validate` checks and returns accepted records. `FeatureEngineer.transform` produces `FeatureVector` values. `RuleEngine.evaluate` returns deterministic `RuleFinding` values per project. Both anomaly detectors inspect the feature batch and return aligned `AnomalyFinding` values. `Predictor.predict` returns a versioned `Prediction` per project. `RiskAggregator.aggregate` combines those signals into `RiskResult`. `Explainer.explain` supplies the human-readable reason.

The orchestration layer depends on protocols in `risk_pipeline/contracts.py`, not concrete implementations. A database source, a trained model predictor, or Person 3 signal adapter can therefore be injected through the factory without rewriting orchestration.

## Contract expectations

- `ProjectRecord` is the canonical validated record boundary; database adapters map into it.
- `FeatureVector.values` contains numeric, model-ready features. Feature names and preprocessing metadata must be versioned with a trained model later.
- Detector outputs are aligned to input order in this phase. A production implementation should include IDs in any batch result contract.
- `Prediction.probability` is nullable until a trained artifact is loaded; `unknown` is the only valid phase-1 model label.
- `RiskResult` is the output boundary for an API or downstream consumer.
- Person 3 integration should add optional signal fields or a separate signal protocol at the feature/rules boundary, without changing source or orchestration semantics.

## Deferred responsibilities

Authentication, persistence, model training, drift monitoring, calibration, real database queries, and Person 3 integration are intentionally out of scope for phase 1.
