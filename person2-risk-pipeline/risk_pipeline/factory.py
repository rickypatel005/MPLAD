from risk_pipeline.aggregation import WeightedRiskAggregator
from pipeline.isolation_forest import IsolationForestDetector
from pipeline.prediction_model import PredictionUnavailableModel
from pipeline.cost_anomaly import CostAnomalyDetector
from pipeline.payment_progress import PaymentProgressAnalyzer
from pipeline.risk_engine import RiskEngine, RiskEngineConfig
from pipeline.timeline_risk import TimelineRiskAnalyzer
from pipeline.utilization import UtilizationAnalyzer
from risk_pipeline.anomaly import PlaceholderStatisticalDetector
from risk_pipeline.config import Settings
from risk_pipeline.data.synthetic import SyntheticDataProvider
from pipeline.explanation import ExplanationEngine
from pipeline.feature_engineering import FeatureEngineering
from pipeline.rules import ConfigurableRuleEngine, RuleConfig
from risk_pipeline.pipeline import RiskPipeline
from risk_pipeline.validation import BasicValidator


def build_pipeline(settings: Settings) -> RiskPipeline:
    if settings.source_kind != "synthetic":
        raise ValueError(f"Unsupported source kind in phase 1: {settings.source_kind}")
    source = SyntheticDataProvider(settings.record_count, settings.seed)
    cost_anomaly = CostAnomalyDetector()
    return RiskPipeline(
        source=source,
        validator=BasicValidator(),
        feature_engineer=FeatureEngineering(),
        rule_engine=ConfigurableRuleEngine(RuleConfig(payment_progress_gap_medium=settings.rule_risk_threshold)),
        statistical_detector=PlaceholderStatisticalDetector(),
        isolation_forest=IsolationForestDetector.load(settings.isolation_forest_artifact_dir),
        predictor=PredictionUnavailableModel(),
        aggregator=WeightedRiskAggregator(settings.high_risk_threshold),
        explainer=None,
        risk_engine=RiskEngine(RiskEngineConfig(financial_weight=settings.financial_weight, timeline_weight=settings.timeline_weight, compliance_weight=settings.compliance_weight, anomaly_weight=settings.anomaly_weight, prediction_weight=settings.prediction_weight, medium_threshold=settings.medium_risk_threshold, high_threshold=settings.high_risk_threshold)),
        cost_anomaly=cost_anomaly,
        timeline_risk=TimelineRiskAnalyzer(),
        payment_progress=PaymentProgressAnalyzer(settings.rule_risk_threshold),
        utilization=UtilizationAnalyzer(),
        explanation_engine=ExplanationEngine(),
    )
