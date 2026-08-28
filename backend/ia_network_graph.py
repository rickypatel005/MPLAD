"""
Person 3 — Implementing Agency (IA) Network & Concentration Analysis
Builds bipartite / tripartite graphs (MP <-> IA <-> District) and computes
degree centrality, Herfindahl-Hirschman Index (HHI), and agency risk metrics.
"""
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import networkx as nx

BASE_DIR = Path(__file__).resolve().parent
PROJECTS_JSON_PATH = BASE_DIR.parent / "person1" / "data" / "processed" / "projects.json"


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


def build_network_graph(projects: Optional[List[Dict[str, Any]]] = None) -> nx.Graph:
    """Builds a tripartite NetworkX graph connecting MPs, IAs, and Districts."""
    if projects is None:
        projects = load_real_projects()
        
    G = nx.Graph()
    
    for p in projects:
        mp = str(p.get("mp_id") or p.get("mp_name") or "UNKNOWN_MP")
        ia = str(p.get("ia_id") or p.get("ia_name") or p.get("implementing_agency") or "UNKNOWN_IA")
        district = str(p.get("district_id") or p.get("district_name") or "UNKNOWN_DISTRICT")
        
        cost = float(p.get("sanction_amount") or (p.get("estimated_cost_lakhs", 0) * 100000) or 0.0)
        cost_lakhs = cost / 100000.0
        
        # Add nodes with category types
        if not G.has_node(mp):
            G.add_node(mp, node_type="MP", label=str(p.get("mp_name") or mp), project_count=0, total_cost_lakhs=0.0)
        if not G.has_node(ia):
            G.add_node(ia, node_type="IA", label=str(p.get("ia_name") or ia), project_count=0, total_cost_lakhs=0.0)
        if not G.has_node(district):
            G.add_node(district, node_type="District", label=str(p.get("district_name") or district), project_count=0, total_cost_lakhs=0.0)
            
        G.nodes[mp]["project_count"] += 1
        G.nodes[mp]["total_cost_lakhs"] += cost_lakhs
        G.nodes[ia]["project_count"] += 1
        G.nodes[ia]["total_cost_lakhs"] += cost_lakhs
        G.nodes[district]["project_count"] += 1
        G.nodes[district]["total_cost_lakhs"] += cost_lakhs
        
        # Weighted MP <-> IA edge
        if G.has_edge(mp, ia):
            G[mp][ia]["weight"] += 1
            G[mp][ia]["total_cost_lakhs"] += cost_lakhs
        else:
            G.add_edge(mp, ia, weight=1, total_cost_lakhs=cost_lakhs)
            
        # Weighted IA <-> District edge
        if G.has_edge(ia, district):
            G[ia][district]["weight"] += 1
            G[ia][district]["total_cost_lakhs"] += cost_lakhs
        else:
            G.add_edge(ia, district, weight=1, total_cost_lakhs=cost_lakhs)
            
    return G


def calculate_ia_metrics(
    G: nx.Graph,
    projects: Optional[List[Dict[str, Any]]],
    target_ia: str
) -> Dict[str, Any]:
    """Calculates HHI (market concentration) and degree centrality for a target IA."""
    if projects is None:
        projects = load_real_projects()
        
    ia_projects = [
        p for p in projects
        if str(p.get("ia_id") or p.get("ia_name") or p.get("implementing_agency")) == target_ia
    ]
    
    if not ia_projects:
        return {
            "error": "IA not found",
            "target_ia": target_ia,
            "total_projects": 0,
            "degree_centrality": 0.0,
            "hhi_concentration_index": 0.0,
            "ia_risk_score": 0.0,
            "is_high_concentration": False,
        }

    degree_centrality = round(nx.degree_centrality(G).get(target_ia, 0.0), 3) if G.has_node(target_ia) else 0.0

    # HHI Concentration across MPs for this IA
    mp_counts: Dict[str, int] = {}
    for p in ia_projects:
        mp = str(p.get("mp_id") or p.get("mp_name") or "UNKNOWN")
        mp_counts[mp] = mp_counts.get(mp, 0) + 1
        
    total_ia_projects = len(ia_projects)
    hhi_score = 0.0
    mp_shares: Dict[str, float] = {}
    
    for mp, count in mp_counts.items():
        share = count / total_ia_projects
        mp_shares[mp] = round(share * 100, 2)
        hhi_score += (share ** 2)  # Normalized 0.0 - 1.0 scale

    hhi_score = round(hhi_score, 3)
    is_high = hhi_score > 0.50 or total_ia_projects > 30

    # Composite IA risk score (0.00 - 1.00)
    ia_risk_score = round(min(1.0, 0.60 * hhi_score + 0.40 * min(1.0, degree_centrality * 5)), 2)

    return {
        "target_ia": target_ia,
        "ia_name": ia_projects[0].get("ia_name") if ia_projects else target_ia,
        "total_projects": total_ia_projects,
        "degree_centrality": degree_centrality,
        "hhi_concentration_index": hhi_score,
        "ia_risk_score": ia_risk_score,
        "mp_project_share_percent": mp_shares,
        "is_high_concentration": is_high,
        "evaluation": "High single-MP concentration detected" if hhi_score > 0.50 else "Standard IA project distribution"
    }


def get_network_for_project(project_id: str) -> Dict[str, Any]:
    """Retrieves full IA graph and concentration analysis for a project's IA."""
    all_projects = load_real_projects()
    project = next((p for p in all_projects if p.get("project_id") == project_id), None)
    
    if not project:
        return {"error": f"Project '{project_id}' not found", "found": False}
        
    target_ia = str(project.get("ia_id") or project.get("ia_name") or project.get("implementing_agency"))
    
    # Filter projects related to this state/district for faster graph construction
    state_id = project.get("state_id")
    subset = [p for p in all_projects if p.get("state_id") == state_id] if state_id else all_projects[:1000]
    if len(subset) < 20:
        subset = all_projects[:1000]
        
    G = build_network_graph(subset)
    metrics = calculate_ia_metrics(G, subset, target_ia)
    
    # Generate node/edge list around target IA for UI graph rendering
    nodes = []
    edges = []
    
    if G.has_node(target_ia):
        neighbors = list(G.neighbors(target_ia))
        nodes_to_include = set([target_ia] + neighbors)
        
        for node in nodes_to_include:
            attrs = G.nodes[node]
            nodes.append({
                "id": node,
                "label": attrs.get("label", node),
                "type": attrs.get("node_type", "IA"),
                "project_count": attrs.get("project_count", 1),
                "risk": metrics.get("ia_risk_score", 0.3) if node == target_ia else 0.2
            })
            
        for n in neighbors:
            if G.has_edge(target_ia, n):
                e = G[target_ia][n]
                edges.append({
                    "source": target_ia,
                    "target": n,
                    "weight": e.get("weight", 1),
                    "total_cost_lakhs": round(e.get("total_cost_lakhs", 0.0), 2)
                })
                
    return {
        "project_id": project_id,
        "ia_id": target_ia,
        "metrics": metrics,
        "graph": {
            "nodes": nodes,
            "edges": edges
        }
    }