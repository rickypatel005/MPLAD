"""
Person 3 — Geospatial Boundary Verification Engine
Validates project coordinates against constituency boundaries with confidence,
source attribution, and explicit disclaimer metadata.
"""
import json
from pathlib import Path
from typing import Any, Dict, Optional
from shapely.geometry import Point, Polygon

BASE_DIR = Path(__file__).resolve().parent
PROJECTS_JSON_PATH = BASE_DIR.parent / "person1" / "data" / "processed" / "projects.json"
CONSTITUENCIES_JSON_PATH = BASE_DIR.parent / "person1" / "data" / "processed" / "constituencies.json"

_BOUNDARIES_CACHE: Dict[str, Polygon] = {}
_PROJECTS_CACHE: Dict[str, Dict[str, Any]] = {}


def _init_caches():
    global _BOUNDARIES_CACHE, _PROJECTS_CACHE
    if _PROJECTS_CACHE:
        return
        
    projects = []
    if PROJECTS_JSON_PATH.is_file():
        try:
            with open(PROJECTS_JSON_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
                projects = raw if isinstance(raw, list) else raw.get("records", [])
        except Exception:
            projects = []
            
    # Group coordinates by constituency to build clusters
    by_constituency: Dict[str, list] = {}
    for p in projects:
        pid = p.get("project_id")
        if pid:
            _PROJECTS_CACHE[pid] = p
            
        cid = p.get("constituency_id") or p.get("constituency_name")
        loc = p.get("location") if isinstance(p.get("location"), dict) else {}
        lat = float(p.get("latitude") or loc.get("latitude") or p.get("work_lat") or 0.0)
        lon = float(p.get("longitude") or loc.get("longitude") or p.get("work_lon") or 0.0)
        
        if cid and lat != 0.0 and lon != 0.0:
            by_constituency.setdefault(cid, []).append(Point(lon, lat))

    # Build convex hull polygons with 0.08 deg (~8km) buffer
    for cid, points in by_constituency.items():
        if len(points) == 1:
            _BOUNDARIES_CACHE[cid] = points[0].buffer(0.10)
        elif len(points) >= 2:
            from shapely.geometry import MultiPoint
            mp = MultiPoint(points)
            _BOUNDARIES_CACHE[cid] = mp.convex_hull.buffer(0.08)


def verify_project_boundary(project_lon: float, project_lat: float, target_constituency_id: str) -> Dict[str, Any]:
    """Checks if coordinates fall inside the constituency boundary polygon."""
    _init_caches()
    project_point = Point(project_lon, project_lat)
    
    polygon = _BOUNDARIES_CACHE.get(target_constituency_id)
    if polygon is None:
        return {
            "constituency_id": target_constituency_id,
            "is_within_bounds": True,
            "geo_score": 0.15,
            "confidence": 0.50,
            "boundary_source": "SYNTHETIC_CLUSTER_BUFFER_ESTIMATE",
            "warning": f"Official GIS polygon for '{target_constituency_id}' not loaded. Using default regional tolerance.",
        }
        
    is_within = bool(polygon.contains(project_point))
    # Distance to boundary exterior if outside
    dist_deg = 0.0 if is_within else float(polygon.exterior.distance(project_point))
    
    # 0.00 = perfect (inside), 1.00 = high risk (far outside)
    geo_score = 0.0 if is_within else round(min(1.0, 0.50 + dist_deg * 2.0), 2)

    return {
        "constituency_id": target_constituency_id,
        "is_within_bounds": is_within,
        "distance_from_boundary_deg": round(dist_deg, 4),
        "geo_score": geo_score,
        "confidence": 0.85 if len(_PROJECTS_CACHE) > 0 else 0.50,
        "boundary_source": "SYNTHETIC_CLUSTER_BUFFER_ESTIMATE",
        "warning": "Constituency boundary is estimated from civic project cluster convex hulls with a 0.08° buffer."
    }


def verify_project_geo_by_id(project_id: str) -> Dict[str, Any]:
    """Verifies geospatial compliance for a specific project ID."""
    _init_caches()
    project = _PROJECTS_CACHE.get(project_id)
    if not project:
        # Try reloading or fallback
        return {
            "project_id": project_id,
            "found": False,
            "error": f"Project '{project_id}' not found in geospatial store",
            "is_within_bounds": True,
            "geo_score": 0.0,
        }
        
    cid = str(project.get("constituency_id") or project.get("constituency_name") or "C001")
    loc = project.get("location") if isinstance(project.get("location"), dict) else {}
    lat = float(project.get("latitude") or loc.get("latitude") or project.get("work_lat") or 0.0)
    lon = float(project.get("longitude") or loc.get("longitude") or project.get("work_lon") or 0.0)
    
    verification = verify_project_boundary(lon, lat, cid)
    
    return {
        "project_id": project_id,
        "project_name": project.get("project_name") or project.get("work_description"),
        "location": {"latitude": lat, "longitude": lon},
        "constituency_id": cid,
        "state_id": project.get("state_id"),
        "district_id": project.get("district_id"),
        "is_within_bounds": verification["is_within_bounds"],
        "geo_score": verification["geo_score"],
        "confidence": verification["confidence"],
        "boundary_source": verification["boundary_source"],
        "warning": verification["warning"]
    }