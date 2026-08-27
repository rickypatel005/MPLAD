from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from risk_pipeline.contracts import FeatureVector, ProjectRecord, RuleFinding, RuleEngine


@dataclass(frozen=True)
class RuleConfig:
    payment_progress_gap_medium: float = 0.20
    payment_progress_gap_high: float = 0.40
    utilization_progress_gap_medium: float = 0.25
    utilization_progress_gap_high: float = 0.50
    delay_ratio_medium: float = 0.10
    delay_ratio_high: float = 0.25
    suspicious_utilization_rate: float = 0.10


class ConfigurableRuleEngine(RuleEngine):
    """Central deterministic rules; thresholds are configuration, not scattered constants."""

    def __init__(self, config: RuleConfig | None = None) -> None:
        self.config = config or RuleConfig()

    def evaluate(self, record: ProjectRecord, features: FeatureVector) -> Sequence[RuleFinding]:
        values = features.values
        findings = [
            self._threshold_rule(
                "payment_progress_mismatch",
                values.get("payment_progress_gap"),
                self.config.payment_progress_gap_medium,
                self.config.payment_progress_gap_high,
                "Payment substantially exceeds physical progress",
            ),
            self._raw_relationship_rule(
                "paid_exceeds_released",
                record.amount_paid > record.amount_released,
                "Amount paid exceeds amount released",
            ),
            self._raw_relationship_rule(
                "utilized_exceeds_paid",
                record.amount_utilized > record.amount_paid,
                "Amount utilized exceeds amount paid",
            ),
            self._threshold_rule(
                "completion_delay",
                values.get("delay_ratio"),
                self.config.delay_ratio_medium,
                self.config.delay_ratio_high,
                "Actual completion exceeds planned completion",
            ),
            self._financial_relationship_rule(record),
            self._threshold_rule(
                "suspicious_utilization",
                self._suspicious_utilization_score(values),
                self.config.suspicious_utilization_rate,
                self.config.suspicious_utilization_rate * 2,
                "Utilization is unusually low for the observed project progress",
            ),
            self._missing_information_rule(values, record),
        ]
        return tuple(findings)

    @staticmethod
    def _threshold_rule(rule_id: str, value: float | None, medium: float, high: float, reason: str) -> RuleFinding:
        if value is None:
            return RuleFinding(rule_id, False, "LOW", 0.0, f"Insufficient data: {reason}")
        score = min(max(value / high, 0.0), 1.0) if high > 0 else 0.0
        severity = "HIGH" if value >= high else "MEDIUM" if value >= medium else "LOW"
        return RuleFinding(rule_id, value >= medium, severity, score, reason)

    @staticmethod
    def _raw_relationship_rule(rule_id: str, triggered: bool, reason: str) -> RuleFinding:
        return RuleFinding(rule_id, triggered, "HIGH" if triggered else "LOW", 1.0 if triggered else 0.0, reason)

    @staticmethod
    def _financial_relationship_rule(record: ProjectRecord) -> RuleFinding:
        valid = 0 <= record.project_cost <= record.sanctioned_amount and 0 <= record.amount_utilized <= record.amount_paid <= record.amount_released <= record.project_cost
        return RuleFinding("invalid_financial_relationship", not valid, "HIGH" if not valid else "LOW", 1.0 if not valid else 0.0, "Financial amounts violate sanctioned/cost/release/payment/utilization ordering")

    def _suspicious_utilization_score(self, values: dict[str, float]) -> float | None:
        utilization = values.get("utilization_rate")
        progress = values.get("physical_progress")
        if utilization is None or progress is None:
            return None
        return max(progress - utilization, 0.0)

    @staticmethod
    def _missing_information_rule(values: dict[str, float], record: ProjectRecord) -> RuleFinding:
        derived_optional = {"peer_cost_ratio", "actual_duration_days", "delay_days", "delay_ratio", "progress_per_day", "remaining_duration"}
        missing = [name.removeprefix("missing_") for name, value in values.items() if name.startswith("missing_") and value == 1.0 and name.removeprefix("missing_") not in derived_optional]
        missing.extend(name for name, value in (("implementing_agency", record.implementing_agency), ("district", record.district), ("constituency", record.constituency)) if not value)
        return RuleFinding("missing_critical_information", bool(missing), "MEDIUM" if missing else "LOW", min(len(missing) / 3, 1.0), "Missing critical information: " + ", ".join(missing) if missing else "No critical information is missing")


# Retain the Phase 1 name while changing its implementation to the centralized engine.
BasicRuleEngine = ConfigurableRuleEngine
