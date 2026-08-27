from __future__ import annotations

import json
from dataclasses import asdict

from risk_pipeline.config import load_settings
from risk_pipeline.factory import build_pipeline


def main() -> None:
    settings = load_settings()
    results = build_pipeline(settings).run()
    print(json.dumps([asdict(result) for result in results[:5]], default=str, indent=2))
    print(json.dumps({
        "projects": len(results),
        "risk_levels": {level: sum(result.risk_level == level for result in results) for level in ("LOW", "MEDIUM", "HIGH")},
        "prediction_statuses": {status: sum(result.prediction_status == status for result in results) for status in ("available", "unavailable")},
    }, indent=2))


if __name__ == "__main__":
    main()
