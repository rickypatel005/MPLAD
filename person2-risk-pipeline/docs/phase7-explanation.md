# Phase 7: Explanation Layer

`ExplanationEngine` consumes the already-computed Phase 3/4 signals and the Phase 6 assessment. It does not recalculate risk scores or infer causes from model outputs.

## Sources

- `RULE`: triggered deterministic rule reason and severity.
- `STATISTICAL`: cost, timeline, payment-progress, utilization, or statistical anomaly reason based on calculated signal output.
- `ANOMALY`: Isolation Forest flag. Its reason is deliberately non-causal: the record has an unusual combination of engineered features compared with reference projects.
- `MODEL`: reserved for a future trained supervised model. No `MODEL` reason is generated while prediction is unavailable.

## Ranking

Candidates are ordered by severity (`HIGH`, `MEDIUM`, `LOW`) and then by the originating signal score. Duplicate source/reason pairs are removed and output is capped at five reasons by default.

The Phase 6 `information_status` and `information_confidence` are preserved separately. A high risk assessment can therefore remain `PARTIAL` rather than being represented as complete evidence.

Explanation output also preserves the distinction between `highest_finding_severity` and `overall_risk_level`; the former describes the strongest individual reason, while the latter describes the weighted project assessment.

## SHAP

`ShapExplanationAdapter` is a future adapter for a trained tree-based supervised model. Without a model it returns:

```json
{"status": "unavailable", "reason": "No trained supervised model exists"}
```

It does not install or train a model and does not invent feature contributions. Person 3 is not integrated.
