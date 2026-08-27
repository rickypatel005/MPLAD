from __future__ import annotations

import json
from dataclasses import asdict

from risk_pipeline.config import load_settings
from risk_pipeline.factory import build_pipeline
from risk_pipeline.logging_config import configure_logging



def main() -> None:
    settings = load_settings()
    configure_logging(settings.log_level)
    results = build_pipeline(settings).run(trace=True)
    print("Synthetic development demonstration - not real-world performance.")
    print(json.dumps([
        {
            "project_id": result.project_id,
            "overall_score": result.overall_score,
            "overall_risk_level": result.overall_risk_level,
            "highest_finding_severity": result.highest_finding_severity,
            "critical_finding_count": result.critical_finding_count,
            "information_status": result.information_status,
            "anomaly_score": result.anomaly_score,
            "isolation_forest_model_version": result.isolation_forest_model_version,
            "prediction_status": result.prediction_status,
            "top_reasons": list(result.reasons[:3]),
        }
        for result in results[:10]
    ], indent=2))
    print(json.dumps({
        "projects_processed": len(results),
        "risk_levels": {level: sum(result.overall_risk_level == level for result in results) for level in ("LOW", "MEDIUM", "HIGH")},
        "prediction_unavailable": sum(result.prediction_status == "unavailable" for result in results),
    }, indent=2))


if __name__ == "__main__":
    main()
