# Feature Schema

All numeric features are returned in `FeatureVector.values`. `project_id` is retained only as metadata and is never included in `values`.

| Feature | Source columns | Formula / logic | Type | Expected range | Inference-safe | Leakage |
|---|---|---|---|---|---|---|
| `cost_ratio` | `project_cost`, `sanctioned_amount` | cost / sanctioned | float | 0..1 for validated data | Yes | No |
| `project_cost` | `project_cost` | validated project cost retained for cost benchmarking | float | >=0 | Yes | No |
| `release_ratio` | `amount_released`, `project_cost` | released / cost | float | 0..1 | Yes | No |
| `payment_ratio` | `amount_paid`, `amount_released` | paid / released | float | 0..1 | Yes | No |
| `utilization_ratio` | `amount_utilized`, `amount_paid` | utilized / paid | float | 0..1 | Yes | No |
| `utilization_rate` | `amount_utilized`, `amount_paid` | compatibility alias for utilization ratio | float | 0..1 | Yes | No |
| `payment_progress_gap` | `payment_ratio`, `physical_progress` | payment ratio - progress fraction | -1..1 | Yes | No |
| `utilization_progress_gap` | `utilization_ratio`, `physical_progress` | utilization ratio - progress fraction | -1..1 | Yes | No |
| `planned_duration_days` | planned dates | planned end - planned start | float | >0 | Yes | No |
| `actual_duration_days` | actual dates | actual end - actual start | float | >=0 | Only when complete | Missing when unavailable |
| `delay_days` | planned/actual completion | actual end - planned end, or 0 while incomplete | float | Any | Yes | Actual completion is post-outcome; omit/disable for early prediction |
| `delay_ratio` | delay, planned duration | delay / planned duration | float | Any | Yes | Same actual-date caveat |
| `remaining_budget` | sanctioned, utilized | sanctioned - utilized | float | >=0 | Yes | No |
| `remaining_budget_ratio` | remaining budget, sanctioned | remaining / sanctioned | float | 0..1 | Yes | No |
| `remaining_duration` | planned end, actual/current date | planned end - reference date | float | Any | Yes | Reference date is configurable |
| `progress_per_day` | physical progress, duration | progress percentage / elapsed days | float | >=0 | Yes | Actual duration caveat |
| `cost_per_progress_unit` | project cost, physical progress | cost / progress percentage | float | >=0 | Yes | No |
| `peer_cost_ratio` | project cost, fitted peer median | cost / training peer median | float | >=0 | Yes after `fit()` | Training-only median |
| `missing_<field>` | source field | 1 when missing, otherwise 0 | float | 0..1 | Yes | No |

Division by zero produces an omitted ratio and a corresponding missingness indicator, rather than a fabricated zero or denominator of one. Missing actual dates omit dependent features and emit indicators. `remaining_duration` uses the transformer `reference_date`, which must be supplied by the caller for reproducible inference.

Categorical columns and identifiers are intentionally not encoded in this stage. They remain available on `ProjectRecord` for later approved handling.
