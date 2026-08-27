from __future__ import annotations

import logging
from dataclasses import replace
from typing import Sequence

from risk_pipeline.contracts import DataProvider, RiskResult

logger = logging.getLogger(__name__)


class RiskPipeline:
    def __init__(self, source: DataProvider, validator, feature_engineer, rule_engine, statistical_detector, isolation_forest, predictor, aggregator, explainer, risk_engine=None, cost_anomaly=None, timeline_risk=None, payment_progress=None, utilization=None, explanation_engine=None) -> None:
        self.source = source
        self.validator = validator
        self.feature_engineer = feature_engineer
        self.rule_engine = rule_engine
        self.statistical_detector = statistical_detector
        self.isolation_forest = isolation_forest
        self.predictor = predictor
        self.aggregator = aggregator
        self.explainer = explainer
        self.risk_engine = risk_engine
        self.cost_anomaly = cost_anomaly
        self.timeline_risk = timeline_risk
        self.payment_progress = payment_progress
        self.utilization = utilization
        self.explanation_engine = explanation_engine

    def run(self, trace: bool = False) -> Sequence[RiskResult]:
        records = self.validator.validate(self.source.get_projects())
        if self.cost_anomaly is not None:
            self.cost_anomaly.fit(records)
        if trace:
            logger.info("trace validation: records=%d", len(records))
        features = list(self.feature_engineer.transform(records))
        if trace:
            logger.info("trace feature_engineering: count=%d names=%s", len(features), sorted(features[0].values) if features else [])
        statistical = list(self.statistical_detector.detect(features))
        if trace:
            logger.info("trace statistical_analysis: count=%d", len(statistical))
        isolation = list(self.isolation_forest.detect(features))
        if trace:
            logger.info("trace isolation_forest: count=%d", len(isolation))
        results: list[RiskResult] = []
        for index, (record, feature) in enumerate(zip(records, features)):
            rules = self.rule_engine.evaluate(record, feature)
            anomalies = (statistical[index], isolation[index])
            prediction = self.predictor.predict(feature)
            if trace:
                logger.info("trace project=%s rules=%d prediction_status=%s", record.project_id, len(rules), "available" if prediction.probability is not None else "unavailable")
            if self.risk_engine is not None:
                cost_signal = self.cost_anomaly.evaluate(record, feature) if self.cost_anomaly else None
                timeline_signal = self.timeline_risk.evaluate(record, feature) if self.timeline_risk else None
                payment_signal = self.payment_progress.evaluate(record, feature) if self.payment_progress else None
                utilization_signal = self.utilization.evaluate(record, feature) if self.utilization else None
                result = self.risk_engine.aggregate(
                    record=record,
                    rules=rules,
                    cost_anomaly=cost_signal,
                    timeline=timeline_signal,
                    payment_progress=payment_signal,
                    utilization=utilization_signal,
                    statistical_anomaly=statistical[index],
                    isolation_forest=isolation[index],
                    prediction=prediction,
                )
                if self.explanation_engine is not None:
                    explanation = self.explanation_engine.explain(
                        result,
                        rules,
                        cost_signal,
                        timeline_signal,
                        payment_signal,
                        utilization_signal,
                        statistical[index],
                        isolation[index],
                    )
                    result = replace(result, reasons=tuple({"source": item.source, "severity": item.severity, "reason": item.reason} for item in explanation.reasons))
                results.append(result)
                continue
            result = self.aggregator.aggregate(record, rules, anomalies, prediction)
            results.append(replace(result, explanation=self.explainer.explain(result)))
        logger.info("Pipeline completed: records=%d", len(results))
        return results
