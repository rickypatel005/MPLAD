# Phase 3: Rules and Statistical Anomaly Signals

All scores use `0` for low concern and `1` for high concern. They are heuristic risk scores, not calibrated probabilities.

## Rule definitions

Configured defaults are documented in `RuleConfig`:

- `payment_progress_mismatch`: medium at a payment-progress gap of 0.20, high at 0.40; score is `clamp(gap / 0.40, 0, 1)`.
- `paid_exceeds_released`: high and score 1 when the financial ordering is violated.
- `utilized_exceeds_paid`: high and score 1 when the financial ordering is violated.
- `completion_delay`: medium at delay ratio 0.10, high at 0.25; score is `clamp(delay_ratio / 0.25, 0, 1)`.
- `invalid_financial_relationship`: high and score 1 for invalid amount ordering.
- `suspicious_utilization`: compares engineered utilization with progress; thresholds are 0.10 and 0.20 by default.
- `missing_critical_information`: medium when critical engineered or location/agency fields are missing.

Every rule returns `rule_id`, `triggered`, `severity`, `score`, and `reason`.

## Statistical cost anomaly

`CostAnomalyDetector.fit` groups reference projects by district and stores median and IQR. It does not assume a normal distribution. Evaluation uses:

`robust_distance = abs(project_cost - peer_median) / max(IQR, 0.1 * abs(peer_median), 1)`

`anomaly_score = clamp(robust_distance / 3, 0, 1)`

The default anomaly threshold is robust distance 1.5. Statistics must be fitted on training/reference data and reused for inference.

## Other signals

- Timeline score is `clamp(max(delay_ratio, 0), 0, 1)`; missing actual completion returns `ONGOING_OR_MISSING` and score 0.
- Payment-progress mismatch score is `clamp(max(payment_progress_gap, 0), 0, 1)`.
- Utilization concern score is the maximum of the low-utilization deficit and positive utilization-progress gap, each bounded to 1.

Phase 3 deliberately stops at structured signals. It does not aggregate signals into a final project risk score or train a model.

The Phase 4 Isolation Forest deliberately excludes completion-derived features such as `delay_days`, `actual_duration_days`, and `remaining_duration`; these may be unavailable or post-outcome at inference time.
