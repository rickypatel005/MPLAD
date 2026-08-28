"""
Integration and Unit Tests for Person 3 Intelligence Layer
Covers Duplicate Detector (Sentence-BERT / TF-IDF), IA Network Graph & HHI,
Geo Verifier, and FastAPI Endpoints.
"""

import unittest
import sys
import os

# Put root directory in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.duplicate_detector import detect_duplicates, find_duplicates_for_project
from backend.ia_network_graph import build_network_graph, calculate_ia_metrics, get_network_for_project
from backend.geo_verifier import verify_project_boundary, verify_project_geo_by_id
from backend.api_service import app
from fastapi.testclient import TestClient


class TestPerson3Integration(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_duplicate_detector_real_or_mock(self):
        matches = detect_duplicates(similarity_threshold=0.50, max_matches=10)
        self.assertIsInstance(matches, list)
        if len(matches) > 0:
            m = matches[0]
            self.assertIn("project_id_1", m)
            self.assertIn("project_id_2", m)
            self.assertIn("similarity_score", m)
            self.assertGreaterEqual(m["similarity_score"], 0.0)
            self.assertLessEqual(m["similarity_score"], 1.0)

    def test_find_duplicates_for_project(self):
        res = find_duplicates_for_project("P10001", threshold=0.40)
        self.assertIn("project_id", res)
        self.assertEqual(res["project_id"], "P10001")
        self.assertIn("matches", res)

    def test_ia_network_graph_metrics(self):
        net = get_network_for_project("P10001")
        self.assertIn("metrics", net)
        self.assertIn("graph", net)
        metrics = net["metrics"]
        self.assertIn("hhi_concentration_index", metrics)
        self.assertGreaterEqual(metrics["hhi_concentration_index"], 0.0)
        self.assertLessEqual(metrics["hhi_concentration_index"], 1.0)

    def test_geo_verifier_boundary(self):
        # Center of Varanasi constituency
        res = verify_project_boundary(82.9739, 25.3176, "C001")
        self.assertIn("is_within_bounds", res)
        self.assertIn("geo_score", res)
        self.assertIsInstance(res["is_within_bounds"], bool)
        self.assertGreaterEqual(res["geo_score"], 0.0)
        self.assertLessEqual(res["geo_score"], 1.0)

    def test_fastapi_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_fastapi_network_endpoint(self):
        response = self.client.get("/projects/P10001/network")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("metrics", data)

    def test_fastapi_duplicates_endpoint(self):
        response = self.client.get("/duplicates?threshold=0.5&limit=5")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("duplicates_found", data)
        self.assertIn("matches", data)

    def test_fastapi_geo_endpoint(self):
        response = self.client.get("/projects/P10001/geo?lon=82.97&lat=25.31&target_constituency=C001")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("is_within_bounds", data)


if __name__ == "__main__":
    unittest.main()
