from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol, Sequence, runtime_checkable


@dataclass(frozen=True)
class ProjectRecord:
    project_id: str
    sanctioned_amount: float
    project_cost: float
    amount_released: float
    amount_paid: float
    amount_utilized: float
    physical_progress: float
    planned_start: datetime
    planned_end: datetime
    actual_start: datetime | None
    actual_end: datetime | None
    implementing_agency: str
    district: str
    constituency: str
    latitude: float
    longitude: float
    category: str
    dataset_label: str = "SYNTHETIC"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FeatureVector:
    project_id: str
    values: dict[str, float]


@dataclass(frozen=True)
class RuleFinding:
    rule_id: str
    triggered: bool
    severity: str
    score: float
    reason: str

    @property
    def message(self) -> str:
        """Backward-compatible name used by the Phase 1 explanation stage."""
        return self.reason


@dataclass(frozen=True)
class AnomalyFinding:
    detector_id: str
    is_anomaly: bool
    score: float
    message: str
    raw_score: float | None = None
    model_version: str | None = None


@dataclass(frozen=True)
class Prediction:
    project_id: str
    probability: float | None
    label: str
    model_name: str
    model_version: str


@dataclass(frozen=True)
class RiskResult:
    project_id: str
    risk_score: float
    risk_level: str
    rules: tuple[RuleFinding, ...]
    anomalies: tuple[AnomalyFinding, ...]
    prediction: Prediction
    explanation: str


@runtime_checkable
class DataProvider(Protocol):
    def get_project(self, project_id: str) -> ProjectRecord | None: ...

    def get_projects(self) -> Sequence[ProjectRecord]: ...

    def get_project_count(self) -> int: ...


class Validator(Protocol):
    def validate(self, records: Sequence[ProjectRecord]) -> Sequence[ProjectRecord]: ...


class FeatureEngineer(Protocol):
    def transform(self, records: Sequence[ProjectRecord]) -> Sequence[FeatureVector]: ...


class RuleEngine(Protocol):
    def evaluate(self, record: ProjectRecord, features: FeatureVector) -> Sequence[RuleFinding]: ...


class AnomalyDetector(Protocol):
    def detect(self, features: Sequence[FeatureVector]) -> Sequence[AnomalyFinding]: ...


class Predictor(Protocol):
    def predict(self, features: FeatureVector) -> Prediction: ...


@runtime_checkable
class PredictionModel(Protocol):
    def predict(self, features: FeatureVector) -> Prediction: ...


class RiskAggregator(Protocol):
    def aggregate(self, record: ProjectRecord, rules: Sequence[RuleFinding], anomalies: Sequence[AnomalyFinding], prediction: Prediction) -> RiskResult: ...


class Explainer(Protocol):
    def explain(self, result: RiskResult) -> str: ...
