# Phase 5: Supervised Prediction

## Target audit

No legitimate supervised target exists in the current `ProjectRecord`. The `category` field is a synthetic scenario label created by the generator, not an observed outcome. It is not used as a target or feature. The current records do not contain an observed `project_delay`, `high_risk`, or other outcome label.

Consequently, no supervised model is trained, no prediction artifact is created, and no accuracy or other performance metric is reported.

## Interfaces

- `PredictionModel` is the prediction boundary.
- `PredictionUnavailableModel` returns `probability=None`, `label="unavailable"`, and `model_version="untrained"` for Phase 1 compatibility.
- `XGBoostPredictionModel` is a load-only adapter for a future persisted binary classifier.
- `training/train_prediction_model.py` accepts `LabelledProject` examples and rejects missing, non-binary, or single-class targets before training.

## Future target requirements

A real dataset must provide a project-level observed outcome such as `project_delay` measured after a defined cutoff. Each label needs a clear observation window, timestamp, provenance, and positive/negative definition. Training features must be restricted to values available at the prediction cutoff; actual completion, final expenditure, post-cutoff payments, and labels must not enter the feature matrix.

## Future features

The XGBoost adapter expects the existing Phase 2 feature schema:

`cost_ratio`, `release_ratio`, `payment_ratio`, `utilization_ratio`, `payment_progress_gap`, `utilization_progress_gap`, `physical_progress`, `remaining_budget_ratio`.

Identifiers and categorical IDs are excluded. Preprocessing must be fitted on training data and persisted alongside the model. Peer statistics must likewise be fitted on training data only.

## Future evaluation

For a real labelled dataset, use a time-aware train/validation/test split where project history is temporal. Compare a DummyClassifier, Logistic Regression, Random Forest, and XGBoost on the training/validation process, then evaluate the selected model once on untouched test data. Report precision, recall, F1, ROC-AUC, PR-AUC, and a confusion matrix for classification. Assess calibration before exposing outputs as probabilities. No such comparison is possible without labels.

## Artifact contract

`models/prediction/<version>/` should contain `model.pkl`, `preprocessing.pkl`, `feature_schema.json`, and `metadata.json`. Metadata must include model name/version, target, features, dataset version, preprocessing version, hyperparameters, split/evaluation details, and metrics. This directory intentionally contains no artifact in Phase 5 because training data is absent.

Synthetic supervised demonstration is intentionally not created: manually assigning labels from the same input fields would be circular and would not constitute evidence of real predictive performance.
