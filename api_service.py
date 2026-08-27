from fastapi import FastAPI, HTTPException
import uvicorn

# Import your working prototypes
from ia_network_graph import MOCK_PROJECTS, build_network_graph, calculate_ia_metrics
from duplicate_detector import mock_projects as nlp_mock_projects, detect_duplicates

app = FastAPI(title="MPLADS Audit AI - Intelligence Layer")

@app.get("/")
def read_root():
    return {"message": "Person 3 NLP & Graph API is running"}

@app.get("/projects/{project_id}/network")
def get_ia_network(project_id: str):
    """Returns the IA concentration metrics for the IA associated with a project."""
    # Find the IA for this project
    project = next((p for p in MOCK_PROJECTS if p["project_id"] == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    target_ia = project["ia_id"]
    
    # Build graph and calculate metrics
    graph = build_network_graph(MOCK_PROJECTS)
    metrics = calculate_ia_metrics(graph, MOCK_PROJECTS, target_ia)
    
    return metrics

@app.get("/projects/all/duplicates")
def get_all_duplicates():
    """Runs the Sentence-BERT model to find duplicates across all projects."""
    # In a real app, you'd filter by district or timeframe. We'll run all mocks here.
    results = detect_duplicates(nlp_mock_projects, similarity_threshold=0.85)
    return {"duplicates_found": len(results), "matches": results}

if __name__ == "__main__":
    print("Starting API Server on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)