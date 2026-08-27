from __future__ import annotations

from dataclasses import dataclass

from risk_pipeline.contracts import FeatureVector, ProjectRecord


@dataclass(frozen=True)
class PaymentProgressSignal:
    payment_ratio: float | None
    physical_progress: float | None
    payment_progress_gap: float | None
    mismatch_score: float
    is_mismatch: bool
    reason: str
    data_state: str


class PaymentProgressAnalyzer:
    def __init__(self, mismatch_threshold: float = 0.20) -> None:
        self.mismatch_threshold = mismatch_threshold

    def evaluate(self, record: ProjectRecord, features: FeatureVector) -> PaymentProgressSignal:
        del record
        values = features.values
        payment = values.get("payment_ratio")
        progress = values.get("physical_progress")
        gap = values.get("payment_progress_gap")
        if payment is None or progress is None or gap is None:
            return PaymentProgressSignal(payment, progress, gap, 0.0, False, "Payment or physical progress is unavailable", "MISSING")
        score = min(max(gap, 0.0), 1.0)
        return PaymentProgressSignal(payment, progress, gap, score, gap >= self.mismatch_threshold, f"Payment exceeds physical progress by {gap * 100:.1f} percentage points", "VALID")
