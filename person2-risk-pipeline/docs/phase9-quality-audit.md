# Phase 9: Model Quality, Validation, and Generalization Audit

This audit was executed on 60 validated synthetic projects with the persisted Isolation Forest schema. It is a technical stability and data-quality audit only. No supervised labels, XGBoost training, accuracy, or real-world performance claims were used.

## Feature statistics

| Feature | Mean | Median | Std | Min | Max | NaN | Inf | Constant | Near-constant |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| cost_ratio | 0.834130 | 0.894639 | 0.141588 | 0.550100 | 0.983199 | 0 | 0 | No | No |
| release_ratio | 0.641591 | 0.628583 | 0.181172 | 0.307937 | 0.900000 | 0 | 0 | No | No |
| payment_ratio | 0.860262 | 0.908366 | 0.114221 | 0.606902 | 0.977379 | 0 | 0 | No | No |
| utilization_ratio | 0.533043 | 0.623871 | 0.271790 | 0.073613 | 0.990884 | 0 | 0 | No | No |
| payment_progress_gap | 0.478859 | 0.507185 | 0.310229 | -0.180686 | 0.871561 | 0 | 0 | No | No |
| utilization_progress_gap | 0.151640 | 0.122671 | 0.344892 | -0.733430 | 0.707784 | 0 | 0 | No | No |
| physical_progress | 0.381403 | 0.315000 | 0.255762 | 0.060400 | 0.896100 | 0 | 0 | No | No |
| remaining_budget_ratio | 0.767152 | 0.806930 | 0.134138 | 0.397842 | 0.978081 | 0 | 0 | No | No |

Near-constant was evaluated as sample standard deviation <= 0.001. No feature met that condition. The only absolute correlation >= 0.90 was `payment_progress_gap` versus `physical_progress`: -0.936481. This is mathematically expected because the gap contains physical progress; it is a redundancy to monitor, not automatically removed.

Other notable correlations: `remaining_budget_ratio` versus `utilization_ratio` -0.805013 and `utilization_progress_gap` versus `utilization_ratio` 0.679585. Ratios are finite on this validated dataset; zero-denominator behavior is tested separately through imputation/missingness handling.

## Leakage audit

| Feature | Source and transformation | Inference safety | Leakage finding |
|---|---|---|---|
| cost_ratio | project_cost / sanctioned_amount | Safe if available at cutoff | No target or identifier |
| release_ratio | amount_released / project_cost | Safe only when released/cost are current at cutoff | No target; time-cutoff required |
| payment_ratio | amount_paid / amount_released | Safe only for current observed payments | No target; time-cutoff required |
| utilization_ratio | amount_utilized / amount_paid | Safe only for current observed utilization | No target; time-cutoff required |
| payment_progress_gap | payment_ratio - progress fraction | Safe for current snapshot | No target; correlated with progress |
| utilization_progress_gap | utilization_ratio - progress fraction | Safe for current snapshot | No target; correlated with progress |
| physical_progress | physical_progress / 100 | Safe only as-of cutoff | No target |
| remaining_budget_ratio | (sanctioned - utilized) / sanctioned | Safe only as-of cutoff | No target |

`project_id`, category, district, agency, constituency, and other categorical identifiers are not in `FEATURE_SCHEMA`. The synthetic category is not an ML feature. There is no supervised target in this dataset. The persisted Phase 4 preprocessor is fit on training data and reused; peer statistics are fit on the reference/training partition in the audit. Test-set statistics are not used. Temporal safety remains a deployment requirement: no post-cutoff payments, completion, or final outcomes may enter a current-snapshot feature.

## Isolation Forest stability

Four runs used `n_estimators=200`, `contamination=0.10`, `max_samples=auto`, `max_features=1.0` and seeds 42, 7, 123, 999. Each flagged 6/60 records. Pairwise raw-score correlations were:

- 42 vs 7: 0.971256, flagged overlap 3, Jaccard 0.333333
- 42 vs 123: 0.976867, overlap 5, Jaccard 0.714286
- 42 vs 999: 0.983240, overlap 4, Jaccard 0.500000
- 7 vs 123: 0.970847, overlap 3, Jaccard 0.333333
- 7 vs 999: 0.977390, overlap 5, Jaccard 0.714286
- 123 vs 999: 0.977980, overlap 4, Jaccard 0.500000

Rankings were stable in their core: `project-0052`, `project-0030`, and `project-0006` were top anomalies across all four seeds. The flagged set is moderately sensitive to seed, so individual borderline flags should not be treated as definitive.

## Parameter sensitivity

| Configuration | Flagged | Median normalized score |
|---|---:|---:|
| contamination 0.05 | 3 | 0.554105 |
| contamination 0.20 | 12 | 0.554105 |
| n_estimators 50 | 6 | 0.529084 |
| n_estimators 400 | 6 | 0.563552 |
| max_samples 0.7 | 6 | 0.527443 |
| max_features 0.5 | 6 | 0.548874 |

Contamination changes the operating-point flag count as expected. The other tested variations preserved a 6-record flag count but changed boundary membership. No parameter was selected to maximize synthetic detections.

## Synthetic data quality

All 60 records passed validation and financial ordering. Category summaries:

| Scenario | Count | Mean cost ratio | Mean payment-progress gap | Mean utilization rate | Financial ordering |
|---|---:|---:|---:|---:|---|
| normal | 10 | 0.747210 | 0.135950 | 0.739154 | Valid |
| delayed | 10 | 0.772029 | 0.512012 | 0.735067 | Valid |
| high-cost | 10 | 0.966141 | 0.372778 | 0.708680 | Valid |
| payment-progress-mismatch | 10 | 0.755763 | 0.774419 | 0.643927 | Valid |
| low-utilization | 10 | 0.793637 | 0.227996 | 0.171429 | Valid |
| multivariate-unusual | 10 | 0.970000 | 0.850000 | 0.200000 | Valid |

The generator creates meaningful relationships, but scenario patterns are intentionally separable and the `normal` bucket can contain random schedule delays (5/10 in this audit). These are synthetic testing limitations, not evidence of real prevalence or accuracy. `category_used_as_ml_feature=false` was measured directly from the persisted schema.

## Risk score distribution

Full 60-project pipeline output:

| Score | Min | Max | Mean | Median | P25 | P75 | P90 | P95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| financial_score | 0.000000 | 0.871561 | 0.497712 | 0.529623 | 0.250472 | 0.795325 | 0.850000 | 0.850000 |
| timeline_score | 0.000000 | 1.000000 | 0.362558 | 0.159394 | 0.000000 | 0.794981 | 1.000000 | 1.000000 |
| anomaly_score | 0.013374 | 1.000000 | 0.591638 | 0.651979 | 0.416485 | 0.785226 | 0.982077 | 1.000000 |
| overall_score | 0.158946 | 0.576446 | 0.377948 | 0.384513 | 0.290691 | 0.472526 | 0.517678 | 0.526304 |

Risk levels: LOW 22, MEDIUM 38, HIGH 0. No threshold was changed to alter this distribution. Overall scores are not excessively constant, although anomaly scores are concentrated toward the upper half because the normalized bounds and synthetic scenario structure produce that behavior.

## Weights and thresholds

Configured weights are 0.30 financial, 0.20 timeline, 0.20 compliance, 0.20 anomaly, and 0.10 prediction; sum = 1.00. With prediction unavailable, the available-weight denominator is 0.90, so the remaining categories are renormalized. A measured first-project example produced default overall score 0.317186, financial-only 0.507543, and anomaly-only 0.666023; `prediction_score` remained `None` in all cases.

Production-configured boundary results:

- 0.329999 -> LOW
- 0.33 -> MEDIUM
- 0.749999 -> MEDIUM
- 0.75 -> HIGH

## Robustness matrix

| Case | Result |
|---|---|
| normal | Succeeded; LOW; prediction unavailable |
| delayed | Succeeded; MEDIUM; prediction unavailable |
| high-cost | Succeeded; LOW; prediction unavailable |
| payment-progress mismatch | Succeeded; MEDIUM; prediction unavailable |
| low utilization | Succeeded; MEDIUM; prediction unavailable |
| multivariate unusual | Succeeded; MEDIUM; prediction unavailable |
| missing optional dates | Succeeded; LOW; PARTIAL information |
| zero amounts | Succeeded; MEDIUM; PARTIAL information |
| zero progress | Succeeded; MEDIUM; PARTIAL information |
| extreme values | Succeeded; MEDIUM; PARTIAL information |
| invalid coordinates | Rejected with `ValueError` before scoring |
| missing project lookup | Explicit `None` from provider |

## Overfitting and underfitting

Isolation Forest has no ground-truth target here. Seed and parameter stability can show ranking/flag sensitivity, not classification generalization, overfitting, or accuracy. The observed score correlations are evidence of ranking stability with moderate flag-boundary sensitivity. Conventional supervised overfitting/underfitting cannot be evaluated because no legitimate target exists. No train/validation/test supervised metrics were manufactured.

## Real-data readiness checklist

- Map real project records into `ProjectRecord` with provenance and schema version.
- Define missing-value, financial, date, coordinate, and duplicate-record policies.
- Define stable peer groups and fit peer statistics only on training/reference data.
- Confirm every feature is available at the prediction cutoff.
- Obtain historical outcomes with timestamps and provenance.
- Define a legitimate target and observation window.
- Measure target prevalence and class imbalance.
- Use time-aware train/validation/test splits where appropriate.
- Fit preprocessing only on training data and persist it with the model.
- Compare DummyClassifier, Logistic Regression, Random Forest, and XGBoost when labels exist.
- Report precision, recall, F1, ROC-AUC, PR-AUC, confusion matrix, and calibration.
- Validate on untouched test data and inspect drift/segment stability.
- Retrain only through a versioned, reviewed training job.
- Store model, schema, preprocessing, metrics, and dataset metadata.

## Audit boundary

No production code, thresholds, weights, model artifacts, or feature schema were changed during this audit. The only additions are this evidence document and the audit execution output was transient.
