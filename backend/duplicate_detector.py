"""
Person 3 — Duplicate Detection Engine
Calculates composite duplicate probability based on:
1. Semantic text similarity (Sentence-BERT / TF-IDF embeddings)
2. Geographic distance (Haversine km)
3. Temporal proximity (sanction/start date delta)
4. Implementing Agency overlap
"""
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

BASE_DIR = Path(__file__).resolve().parent
PROJECTS_JSON_PATH = BASE_DIR.parent / "person1" / "data" / "processed" / "projects.json"

# Lazy SentenceTransformer holder
_SENTENCE_MODEL = None

def get_sentence_model():
    global _SENTENCE_MODEL
    if _SENTENCE_MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer
            _SENTENCE_MODEL = SentenceTransformer("paraphrase-multilingual-mpnet-base-v2")
        except Exception as e:
            _SENTENCE_MODEL = False
    return _SENTENCE_MODEL if _SENTENCE_MODEL is not False else None


def load_real_projects() -> List[Dict[str, Any]]:
    """Loads real projects from processed dataset."""
    if PROJECTS_JSON_PATH.is_file():
        try:
            with open(PROJECTS_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else data.get("records", [])
        except Exception:
            pass
    return []


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance in kilometers."""
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def compute_text_similarity(descriptions: List[str]) -> np.ndarray:
    """Computes pairwise cosine similarity using SentenceTransformer or TF-IDF fallback."""
    model = get_sentence_model()
    if model is not None:
        try:
            embeddings = model.encode(descriptions)
            return cosine_similarity(embeddings)
        except Exception:
            pass
    
    # Fast TF-IDF fallback (multilingual char/word n-grams)
    vectorizer = TfidfVectorizer(ngram_range=(1, 3), analyzer="char_wb")
    tfidf_matrix = vectorizer.fit_transform(descriptions)
    return cosine_similarity(tfidf_matrix)


def detect_duplicates(
    projects: Optional[List[Dict[str, Any]]] = None,
    similarity_threshold: float = 0.70,
    max_matches: int = 100
) -> List[Dict[str, Any]]:
    """
    Detects duplicate and near-duplicate civic works across projects.
    Returns composite duplicate probability and rich explanation evidence.
    """
    if projects is None:
        projects = load_real_projects()
        
    if len(projects) < 2:
        return []

    # Filter projects with descriptions
    valid_projects = [
        p for p in projects
        if (p.get("description") or p.get("work_description") or p.get("project_name"))
    ]
    
    # Cap candidate set for pairwise computation if needed
    pool = valid_projects[:min(len(valid_projects), 1500)]
    descriptions = [
        str(p.get("description") or p.get("work_description") or p.get("project_name"))
        for p in pool
    ]

    sim_matrix = compute_text_similarity(descriptions)
    matches: List[Dict[str, Any]] = []

    for i in range(len(pool)):
        for j in range(i + 1, len(pool)):
            p1 = pool[i]
            p2 = pool[j]
            
            semantic_score = float(sim_matrix[i][j])
            
            # Location info
            loc1 = p1.get("location") if isinstance(p1.get("location"), dict) else {}
            loc2 = p2.get("location") if isinstance(p2.get("location"), dict) else {}
            lat1 = float(p1.get("latitude") or loc1.get("latitude") or p1.get("work_lat") or 0.0)
            lon1 = float(p1.get("longitude") or loc1.get("longitude") or p1.get("work_lon") or 0.0)
            lat2 = float(p2.get("latitude") or loc2.get("latitude") or p2.get("work_lat") or 0.0)
            lon2 = float(p2.get("longitude") or loc2.get("longitude") or p2.get("work_lon") or 0.0)
            
            has_geo = (lat1 != 0.0 and lon1 != 0.0 and lat2 != 0.0 and lon2 != 0.0)
            dist_km = haversine_km(lat1, lon1, lat2, lon2) if has_geo else 999.0
            
            geo_prox = max(0.0, 1.0 - (dist_km / 10.0)) if has_geo else 0.5
            
            # Temporal info
            d1 = str(p1.get("sanction_date") or p1.get("start_date") or "")
            d2 = str(p2.get("sanction_date") or p2.get("start_date") or "")
            same_period = (d1[:7] == d2[:7]) if (len(d1) >= 7 and len(d2) >= 7) else False
            temporal_prox = 1.0 if same_period else 0.6
            
            # IA overlap
            ia1 = str(p1.get("ia_id") or p1.get("implementing_agency") or "")
            ia2 = str(p2.get("ia_id") or p2.get("implementing_agency") or "")
            same_ia = bool(ia1 and ia2 and ia1 == ia2)
            ia_prox = 1.0 if same_ia else 0.3

            # Composite Duplicate Probability
            composite_prob = (
                0.50 * semantic_score +
                0.25 * geo_prox +
                0.15 * temporal_prox +
                0.10 * ia_prox
            )
            
            if composite_prob >= similarity_threshold or semantic_score >= 0.85:
                reasons = []
                if semantic_score >= 0.80:
                    reasons.append(f"High semantic description match ({round(semantic_score*100, 1)}%)")
                if has_geo and dist_km <= 2.0:
                    reasons.append(f"Geographic proximity ({dist_km} km)")
                if same_ia:
                    reasons.append(f"Same implementing agency ({ia1})")
                if same_period:
                    reasons.append("Sanctioned within same financial cycle")

                matches.append({
                    "project_1": p1.get("project_id"),
                    "project_2": p2.get("project_id"),
                    "project_id_1": p1.get("project_id"),
                    "project_id_2": p2.get("project_id"),
                    "similarity_score": round(semantic_score, 4),
                    "geo_distance_km": dist_km if has_geo else None,
                    "same_agency": same_ia,
                    "composite_probability": round(composite_prob, 4),
                    "detection_method": "SBERT_GEO_TEMPORAL_HYBRID",
                    "reasons": reasons or ["Elevated composite similarity index"],
                    "text_1": descriptions[i],
                    "text_2": descriptions[j],
                })
                
                if len(matches) >= max_matches:
                    break
        if len(matches) >= max_matches:
            break

    matches.sort(key=lambda m: m["composite_probability"], reverse=True)
    return matches


def find_duplicates_for_project(project_id: str, threshold: float = 0.60) -> Dict[str, Any]:
    """Returns all duplicate candidate matches for a specific project."""
    all_projects = load_real_projects()
    target = next((p for p in all_projects if p.get("project_id") == project_id), None)
    if not target:
        return {"project_id": project_id, "found": False, "matches": [], "error": "Project not found"}

    target_district = target.get("district_id") or target.get("district_name")
    target_category = target.get("category") or target.get("work_type")
    
    # Filter candidates in same district/state or category
    candidates = [
        p for p in all_projects
        if p.get("project_id") != project_id and (
            p.get("district_id") == target_district or
            p.get("category") == target_category or
            p.get("state_id") == target.get("state_id")
        )
    ]
    
    if not candidates:
        candidates = [p for p in all_projects if p.get("project_id") != project_id][:100]

    pool = [target] + candidates[:300]
    results = detect_duplicates(pool, similarity_threshold=threshold, max_matches=25)
    
    # Filter matches involving target project
    project_matches = [
        m for m in results
        if m["project_1"] == project_id or m["project_2"] == project_id
    ]
    
    # Normalize result format for target project
    normalized = []
    for m in project_matches:
        is_p1 = (m["project_1"] == project_id)
        other_id = m["project_2"] if is_p1 else m["project_1"]
        other_text = m["text_2"] if is_p1 else m["text_1"]
        normalized.append({
            "target_project_id": project_id,
            "counterpart_project_id": other_id,
            "similarity_score": m["similarity_score"],
            "geo_distance_km": m["geo_distance_km"],
            "same_agency": m["same_agency"],
            "duplicate_probability": m["composite_probability"],
            "reasons": m["reasons"],
            "counterpart_description": other_text
        })

    return {
        "project_id": project_id,
        "found": len(normalized) > 0,
        "duplicate_count": len(normalized),
        "matches": normalized
    }