from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import json

# 1. Initialize the multilingual model
# This will download the model weights (~1GB) the very first time you run it.
print("Loading NLP Model... (This may take a minute on the first run)")
model = SentenceTransformer('paraphrase-multilingual-mpnet-base-v2')

# 2. Mock Data: Project Descriptions (Testing English & Hindi overlap)
mock_projects = [
    {
        "project_id": "P201",
        "district": "Pune",
        "description": "Construction of a new concrete road connecting the primary school to the main highway in village A."
    },
    {
        "project_id": "P202",
        "district": "Pune",
        "description": "Building a cement road from the local school to the highway in village A." # Semantic Duplicate
    },
    {
        "project_id": "P203",
        "district": "Pune",
        "description": "गांव ए में प्राथमिक विद्यालय को मुख्य राजमार्ग से जोड़ने वाली एक नई कंक्रीट सड़क का निर्माण।" # Hindi translation of P201
    },
    {
        "project_id": "P204",
        "district": "Nagpur",
        "description": "Installation of 10 solar street lights near the community center." # Totally different work
    }
]

def detect_duplicates(projects, similarity_threshold=0.85):
    """Detects semantically similar project descriptions using Cosine Similarity."""
    descriptions = [p["description"] for p in projects]
    
    # Generate 768-dimensional embeddings for all descriptions
    print("Generating embeddings...")
    embeddings = model.encode(descriptions)
    
    # Calculate all-pairs cosine similarity
    similarity_matrix = cosine_similarity(embeddings)
    
    flagged_duplicates = []
    
    # Iterate through the upper triangle of the matrix to find matches
    for i in range(len(projects)):
        for j in range(i + 1, len(projects)):
            score = similarity_matrix[i][j]
            
            # If the semantic similarity is higher than our threshold, flag it
            if score >= similarity_threshold:
                flagged_duplicates.append({
                    "project_1": projects[i]["project_id"],
                    "project_2": projects[j]["project_id"],
                    "similarity_score": round(float(score), 4),
                    "reason": "High semantic similarity in descriptions",
                    "text_1": projects[i]["description"],
                    "text_2": projects[j]["description"]
                })
                
    return flagged_duplicates

# 3. Test execution
if __name__ == "__main__":
    results = detect_duplicates(mock_projects, similarity_threshold=0.85)
    print("\n=== NLP Duplicate Detection Output ===")
    print(json.dumps(results, indent=2, ensure_ascii=False))