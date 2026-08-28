import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECTS_PATH = BASE_DIR.parent / "person1" / "data" / "processed" / "projects.parquet"

# 1. Load the Parquet data and filter out missing coordinates
df = pd.read_parquet(PROJECTS_PATH)
df = df.dropna(subset=['latitude', 'longitude'])

# 2. Convert to a GeoDataFrame using the extracted points
gdf = gpd.GeoDataFrame(
    df, 
    geometry=gpd.points_from_xy(df.longitude, df.latitude),
    crs="EPSG:4326"
)

print("Generating synthetic constituency boundaries from project clusters...")

# 3. Create synthetic polygons using Convex Hulls + Buffer
# A 0.05 degree buffer adds roughly a 5km radius to ensure even 1-point constituencies have an area
constituency_boundaries = gdf.groupby('constituency_id')['geometry'].apply(
    lambda geom: geom.union_all().convex_hull.buffer(0.05)
).reset_index()

boundaries_gdf = gpd.GeoDataFrame(constituency_boundaries, geometry='geometry', crs="EPSG:4326")
print(f"Successfully generated boundary map for {len(boundaries_gdf)} synthetic constituencies!\n")


def verify_project_boundary(project_lon: float, project_lat: float, target_constituency_id: str) -> dict:
    """
    Checks if a given coordinate falls inside the generated constituency boundary.
    """
    project_point = Point(project_lon, project_lat)
    
    # Locate the dynamically generated boundary
    constituency = boundaries_gdf[boundaries_gdf['constituency_id'] == target_constituency_id]
    
    if constituency.empty:
        return {"error": "Constituency boundary not found", "is_within_bounds": False, "geo_score": 0.0}
        
    polygon = constituency.iloc[0].geometry
    is_within = polygon.contains(project_point)
    
    return {
        "is_within_bounds": bool(is_within),
        "geo_score": 1.0 if is_within else 0.0 
    }

# Quick self-test using the first record's exact coordinates
if __name__ == "__main__":
    test_lon, test_lat = 92.2115, 12.1653
    target_id = "C001"
    
    print(f"Testing Point(Lon: {test_lon}, Lat: {test_lat}) against Boundary '{target_id}'...")
    result = verify_project_boundary(test_lon, test_lat, target_id)
    print(f"Result: {result}")