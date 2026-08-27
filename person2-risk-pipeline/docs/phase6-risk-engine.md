# Phase 6: Risk Engine

`RiskEngine` consumes structured outputs from the Phase 3 and Phase 4 components. It does not recalculate financial ratios, dates, anomaly scores, or prediction values.

## Category scores

- `financial_score`: maximum of valid payment-progress mismatch and utilization concern scores. Cost anomaly is intentionally excluded here and belongs to anomaly score.
- `timeline_score`: existing timeline analyzer score.
- `compliance_score`: maximum score of triggered non-overlapping compliance rules (`invalid_financial_relationship`, relationship violations, and missing critical information). A rules evaluation with no compliance trigger is valid `0.0`.
- `anomaly_score`: maximum of cost anomaly, statistical anomaly, and Isolation Forest scores.
- `prediction_score`: supervised prediction probability when available; otherwise `None`.

Every supplied component score is clamped to 0..1. Scores are concern scores, not calibrated probabilities.

## Aggregation

Default configuration is in `config/default.json`:

```text
financial  0.30
 timeline  0.20
compliance 0.20
 anomaly    0.20
prediction  0.10
```

The weighted mean is calculated only over available category scores:

`overall = sum(weight_i * score_i) / sum(weight_i for available i)`

An unavailable prediction is excluded from both numerator and denominator; it cannot artificially reduce risk. `information_status` and `information_confidence` separately identify incomplete evidence.

Risk levels use configurable thresholds: LOW below 0.33, MEDIUM from 0.33 through 0.659999, and HIGH at or above 0.66. These are operating thresholds, not statistically validated cutoffs.

Finding severity is intentionally separate from aggregate risk level. A single `HIGH` finding can coexist with a `LOW` `overall_risk_level` when its category score is diluted by the configured weighted mean and other available categories. Results expose `highest_finding_severity` and `critical_finding_count` so consumers do not mistake a local finding severity for the project-level classification. `risk_level` remains as a backward-compatible alias of `overall_risk_level`.

## Double-counting protection

Payment-progress rules and analyzer output are represented in financial concern, not separately added as independent weighted terms. Timeline delay rules and timeline score follow the same principle. Cost anomaly is assigned to anomaly concern only. Within each category, the maximum signal is used rather than summing correlated evidence.

## Missing data and future signals

Missing timeline/payment/utilization/statistical outputs remain unavailable rather than becoming zero. Optional `future_signals` accepts a mapping for future integrations but is ignored in Phase 6; no Person 3 values are created or consumed.
