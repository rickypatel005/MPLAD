from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class ShapExplanation:
    status: str
    reason: str
    top_features: tuple[dict[str, float | str], ...] = ()


class ShapExplanationAdapter:
    """Future supervised-model SHAP adapter; never invents explanations without a model."""

    def explain(self, model=None, transformed_features=None, feature_names: Sequence[str] = ()) -> ShapExplanation:
        if model is None or transformed_features is None:
            return ShapExplanation("unavailable", "No trained supervised model exists")
        try:
            import shap
        except ImportError:
            return ShapExplanation("unavailable", "SHAP is not installed")
        explainer = shap.TreeExplainer(model)
        values = explainer.shap_values(transformed_features)
        row = values[0] if isinstance(values, list) else values[0]
        ranked = sorted(zip(feature_names, row), key=lambda item: abs(float(item[1])), reverse=True)
        return ShapExplanation("available", "SHAP values calculated for the trained supervised model", tuple({"feature": name, "value": float(value)} for name, value in ranked[:5]))
