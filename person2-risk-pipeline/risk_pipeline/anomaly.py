from __future__ import annotations

from typing import Sequence

from risk_pipeline.contracts import AnomalyDetector, AnomalyFinding, FeatureVector


class PlaceholderStatisticalDetector(AnomalyDetector):
    detector_id = "statistical-placeholder"

    def detect(self, features: Sequence[FeatureVector]) -> Sequence[AnomalyFinding]:
        return [AnomalyFinding(self.detector_id, False, 0.0, "Statistical detector not implemented in phase 1") for _ in features]
