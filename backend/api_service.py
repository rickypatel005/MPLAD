from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import working modules
from backend.ia_network_graph import MOCK_PROJECTS, build_network_graph, calculate_ia_metrics
from backend.duplicate_detector import mock_projects as nlp_mock_projects, detect_duplicates
from backend.geo_verifier import verify_project_boundary

app = FastAPI(title="MPLADS Audit AI - Intelligence Layer")

# Allow requests from React HUD (port 3000) and other local dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Person 3 NLP, Graph & Geo API is running"}

@app.get("/projects/{project_id}/network")
def get_ia_network(project_id: str):
    """Returns the IA concentration metrics for the IA associated with a project."""
    project = next((p for p in MOCK_PROJECTS if p["project_id"] == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    target_ia = project["ia_id"]
    
    graph = build_network_graph(MOCK_PROJECTS)
    metrics = calculate_ia_metrics(graph, MOCK_PROJECTS, target_ia)
    
    return metrics

@app.get("/projects/all/duplicates")
def get_all_duplicates():
    """Runs the Sentence-BERT model to find duplicates across all projects."""
    results = detect_duplicates(nlp_mock_projects, similarity_threshold=0.85)
    return {"duplicates_found": len(results), "matches": results}

@app.get("/projects/{project_id}/geo")
def get_geo_verification(project_id: str, lon: float, lat: float, target_constituency: str):
    """Validates if a project's coordinates fall within its assigned constituency polygon."""
    result = verify_project_boundary(lon, lat, target_constituency)
    
    if "error" in result and result.get("error") == "Constituency boundary not found":
        raise HTTPException(status_code=404, detail=result["error"])
        
    return {
        "project_id": project_id,
        "constituency_id": target_constituency,
        "is_within_bounds": result["is_within_bounds"],
        "geo_score": result["geo_score"]
    }

if __name__ == "__main__":
    print("Starting API Server on port 8000...")
    uvicorn.run("backend.api_service:app", host="0.0.0.0", port=8000, reload=True)