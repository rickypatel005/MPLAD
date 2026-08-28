"""
Person 3 — Intelligence Layer API Service
Exposes real Sentence-BERT NLP Duplicate Detection, Tripartite Network Graph & HHI,
and Geospatial Boundary Verification over the full MPLADS project dataset.
"""
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import sys

# Ensure backend directory and project root are on sys.path
sys_path_dir = os.path.dirname(os.path.abspath(__file__))
if sys_path_dir not in sys.path:
    sys.path.insert(0, sys_path_dir)
root_dir = os.path.dirname(sys_path_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from backend.duplicate_detector import detect_duplicates, find_duplicates_for_project
    from backend.ia_network_graph import (
        build_network_graph,
        calculate_ia_metrics,
        get_network_for_project,
        load_real_projects
    )
    from backend.geo_verifier import verify_project_boundary, verify_project_geo_by_id
except ImportError:
    from duplicate_detector import detect_duplicates, find_duplicates_for_project
    from ia_network_graph import (
        build_network_graph,
        calculate_ia_metrics,
        get_network_for_project,
        load_real_projects
    )
    from geo_verifier import verify_project_boundary, verify_project_geo_by_id

app = FastAPI(
    title="MPLADS Audit AI - Person 3 Intelligence Layer",
    version="1.0.0",
    description="NLP Semantic Duplicate Detection, IA Network Concentration Graph, and PostGIS Geospatial Verification"
)

# Cross-origin access for Person 4 frontend (3001) and Person 1 backend (3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> Dict[str, Any]:
    return {
        "service": "person3-intelligence-service",
        "status": "healthy",
        "endpoints": [
            "/projects/{project_id}/duplicates",
            "/projects/{project_id}/network",
            "/projects/{project_id}/geo",
            "/duplicates",
            "/network/summary"
        ]
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/projects/{project_id}/network")
def get_ia_network(project_id: str) -> Dict[str, Any]:
    """Returns the real IA concentration metrics and graph nodes/edges for the project."""
    result = get_network_for_project(project_id)
    if "error" in result and not result.get("found", True):
        # Return graceful structure with default metrics if project not found
        return {
            "project_id": project_id,
            "ia_id": "UNKNOWN",
            "metrics": {
                "target_ia": "UNKNOWN",
                "total_projects": 0,
                "degree_centrality": 0.0,
                "hhi_concentration_index": 0.0,
                "ia_risk_score": 0.20,
                "is_high_concentration": False,
            },
            "graph": {"nodes": [], "edges": []}
        }
    return result


@app.get("/projects/{project_id}/duplicates")
def get_project_duplicates(
    project_id: str,
    threshold: float = Query(0.60, ge=0.0, le=1.0)
) -> Dict[str, Any]:
    """Runs Sentence-BERT and hybrid similarity to find duplicates for a project."""
    result = find_duplicates_for_project(project_id, threshold=threshold)
    return result


@app.get("/projects/all/duplicates")
@app.get("/duplicates")
def get_all_duplicates(
    threshold: float = Query(0.70, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=200)
) -> Dict[str, Any]:
    """Runs Sentence-BERT + geo + temporal duplicate detection across projects."""
    matches = detect_duplicates(similarity_threshold=threshold, max_matches=limit)
    return {
        "duplicates_found": len(matches),
        "matches": matches,
        "model": "Sentence-BERT paraphrase-multilingual-mpnet-base-v2"
    }


@app.post("/duplicates/detect")
def detect_duplicates_custom(
    payload: List[Dict[str, Any]] = Body(...),
    threshold: float = Query(0.70, ge=0.0, le=1.0)
) -> Dict[str, Any]:
    """Detects duplicates across custom provided project records."""
    matches = detect_duplicates(projects=payload, similarity_threshold=threshold)
    return {"duplicates_found": len(matches), "matches": matches}


@app.get("/projects/{project_id}/geo")
def get_geo_verification(
    project_id: str,
    lon: Optional[float] = Query(None),
    lat: Optional[float] = Query(None),
    target_constituency: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """
    Validates if a project's coordinates fall within its assigned constituency polygon.
    Supports either explicit coordinates or project ID lookup.
    """
    if lon is not None and lat is not None and target_constituency:
        result = verify_project_boundary(lon, lat, target_constituency)
        return {
            "project_id": project_id,
            "constituency_id": target_constituency,
            "location": {"latitude": lat, "longitude": lon},
            "is_within_bounds": result["is_within_bounds"],
            "geo_score": result["geo_score"],
            "confidence": result.get("confidence", 0.85),
            "boundary_source": result.get("boundary_source", "SYNTHETIC_CLUSTER_BUFFER_ESTIMATE"),
            "warning": result.get("warning")
        }
        
    return verify_project_geo_by_id(project_id)


@app.post("/geo/verify")
def verify_geo_payload(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Verifies geo coordinates for a payload object."""
    loc = payload.get("location") if isinstance(payload.get("location"), dict) else {}
    lat = float(payload.get("latitude") or loc.get("latitude") or payload.get("work_lat") or 0.0)
    lon = float(payload.get("longitude") or loc.get("longitude") or payload.get("work_lon") or 0.0)
    cid = str(payload.get("constituency_id") or payload.get("constituency") or "C001")
    
    result = verify_project_boundary(lon, lat, cid)
    return {
        "is_within_bounds": result["is_within_bounds"],
        "geo_score": result["geo_score"],
        "confidence": result.get("confidence", 0.85),
        "boundary_source": result.get("boundary_source"),
        "warning": result.get("warning")
    }


if __name__ == "__main__":
    port = int(os.environ.get("PERSON3_PORT", 8000))
    print(f"Starting Person 3 Intelligence Layer on port {port}...")
    uvicorn.run("backend.api_service:app", host="0.0.0.0", port=port, reload=True)