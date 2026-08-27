import networkx as nx
import json

# 1. Mock Data representing project allocations
MOCK_PROJECTS = [
    {"project_id": "P101", "mp_id": "MP_A", "ia_id": "IA_1", "district": "Varanasi", "cost": 50.0},
    {"project_id": "P102", "mp_id": "MP_A", "ia_id": "IA_2", "district": "Varanasi", "cost": 120.0},
    {"project_id": "P103", "mp_id": "MP_B", "ia_id": "IA_2", "district": "Prayagraj", "cost": 80.0},
    {"project_id": "P104", "mp_id": "MP_A", "ia_id": "IA_2", "district": "Varanasi", "cost": 30.0},
    {"project_id": "P105", "mp_id": "MP_C", "ia_id": "IA_2", "district": "Varanasi", "cost": 65.0},
    {"project_id": "P106", "mp_id": "MP_A", "ia_id": "IA_3", "district": "Varanasi", "cost": 40.0},
]

def build_network_graph(projects):
    """Builds a bipartite/tripartite NetworkX graph connecting MPs, IAs, and Districts."""
    G = nx.Graph()
    
    for p in projects:
        mp = p["mp_id"]
        ia = p["ia_id"]
        district = p["district"]
        cost = p["cost"]
        
        # Add nodes with category types
        G.add_node(mp, node_type="MP")
        G.add_node(ia, node_type="IA")
        G.add_node(district, node_type="District")
        
        # Add weighted edges representing projects
        if G.has_edge(mp, ia):
            G[mp][ia]["weight"] += 1
            G[mp][ia]["total_cost"] += cost
        else:
            G.add_edge(mp, ia, weight=1, total_cost=cost)
            
        if not G.has_edge(ia, district):
            G.add_edge(ia, district, weight=1)
            
    return G

def calculate_ia_metrics(G, projects, target_ia):
    """Calculates HHI (market concentration) and degree centrality for a target IA."""
    # Filter projects for this IA
    ia_projects = [p for p in projects if p["ia_id"] == target_ia]
    if not ia_projects:
        return {"error": "IA not found"}

    # Degree Centrality (Connectivity across MPs and Districts)
    degree_centrality = nx.degree_centrality(G).get(target_ia, 0.0)

    # 1. HHI Concentration across MPs for this IA
    mp_counts = {}
    for p in ia_projects:
        mp_counts[p["mp_id"]] = mp_counts.get(p["mp_id"], 0) + 1
        
    total_ia_projects = len(ia_projects)
    hhi_score = 0.0
    mp_shares = {}
    
    for mp, count in mp_counts.items():
        share = count / total_ia_projects
        mp_shares[mp] = round(share * 100, 2)
        hhi_score += (share ** 2)  # Normalized 0.0 - 1.0 scale

    return {
        "target_ia": target_ia,
        "total_projects": total_ia_projects,
        "degree_centrality": round(degree_centrality, 3),
        "hhi_concentration_index": round(hhi_score, 3),
        "mp_project_share_percent": mp_shares,
        "is_high_concentration": hhi_score > 0.50
    }

# 3. Test execution
if __name__ == "__main__":
    graph = build_network_graph(MOCK_PROJECTS)
    metrics = calculate_ia_metrics(graph, MOCK_PROJECTS, target_ia="IA_2")
    
    print("=== IA Network Analysis Output ===")
    print(json.dumps(metrics, indent=2))