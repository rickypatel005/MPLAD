import argparse
import json

from risk_pipeline.config import load_settings
from risk_pipeline.factory import build_pipeline
from risk_pipeline.logging_config import configure_logging


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the phase-1 person risk pipeline")
    parser.add_argument("--config", help="Path to a JSON configuration file")
    parser.add_argument("--trace", action="store_true", help="Log each pipeline stage")
    args = parser.parse_args()
    settings = load_settings(args.config)
    configure_logging(settings.log_level)
    results = build_pipeline(settings).run(trace=args.trace)
    print(json.dumps([result.__dict__ for result in results[:3]], default=str, indent=2))
    print(f"processed={len(results)}")


if __name__ == "__main__":
    main()
