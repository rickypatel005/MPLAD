from risk_pipeline.contracts import Explainer, RiskResult


class BasicExplainer(Explainer):
    def explain(self, result: RiskResult) -> str:
        triggered = [finding.message for finding in result.rules if finding.triggered]
        anomaly_messages = [finding.message for finding in result.anomalies if finding.is_anomaly]
        reasons = triggered + anomaly_messages
        return "; ".join(reasons) if reasons else "No configured risk signal triggered"
