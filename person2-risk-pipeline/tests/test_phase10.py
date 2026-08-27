import importlib
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


api = importlib.import_module("risk_pipeline.api.app")


class Phase10ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(api.app)

    def test_health_endpoint(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_model_status_does_not_expose_path(self) -> None:
        response = self.client.get("/health/models")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["isolation_forest"]["available"])
        self.assertEqual(response.json()["isolation_forest"]["version"], "v1")
        self.assertNotIn("models/", response.text)

    def test_successful_project_risk_request(self) -> None:
        response = self.client.get("/projects/project-0000/risk")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["project_id"], "project-0000")
        self.assertEqual(body["prediction_status"], "unavailable")
        self.assertIsNone(body["prediction_score"])
        self.assertEqual(body["prediction"]["label"], "unavailable")
        self.assertEqual(body["isolation_forest_model_version"], "v1")
        self.assertTrue(all({"source", "severity", "reason"}.issubset(reason) for reason in body["reasons"]))

    def test_project_not_found(self) -> None:
        response = self.client.get("/projects/project-9999/risk")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Project not found"})

    def test_invalid_project_id(self) -> None:
        response = self.client.get("/projects/%2E%2E/risk")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "Invalid project ID")

    def test_pipeline_validation_failure_is_safe(self) -> None:
        with patch.object(api.PipelineService, "risk_for_project", side_effect=ValueError("internal details")):
            response = self.client.get("/projects/project-0000/risk")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"detail": "Project data failed validation"})
        self.assertNotIn("internal details", response.text)

    def test_model_artifact_failure_is_safe(self) -> None:
        with patch.object(api.PipelineService, "risk_for_project", side_effect=FileNotFoundError("C:/secret/model.pkl")):
            response = self.client.get("/projects/project-0000/risk")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Required risk model is unavailable"})
        self.assertNotIn("secret", response.text)

    def test_bulk_endpoint_serializes_dataclasses(self) -> None:
        response = self.client.post("/risk/run")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 25)
        self.assertIsInstance(response.json()["results"][0]["prediction"], dict)


if __name__ == "__main__":
    unittest.main()
