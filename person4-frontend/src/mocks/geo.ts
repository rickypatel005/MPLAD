/**
 * Reference geography for the synthetic dataset.
 *
 * State and district names and their approximate centroids are real, so the map
 * and choropleth are recognisably India and district markers land in the right
 * place. Everything attached to them — projects, costs, risk scores — is synthetic.
 *
 * `weight` approximates each state's share of Lok Sabha seats. Project volume is
 * allocated in proportion to it, so Uttar Pradesh, Maharashtra, West Bengal and
 * Bihar carry the most works. Without this the choropleth would be uniform noise
 * and the "top risk state" KPI would be meaningless.
 */

export interface MockState {
  state_id: string;
  state_name: string;
  lat: number;
  lon: number;
  /** Relative project-volume weight, ≈ Lok Sabha seat share. */
  weight: number;
}

export const MOCK_STATES: readonly MockState[] = [
  { state_id: 'UP', state_name: 'Uttar Pradesh', lat: 26.85, lon: 80.95, weight: 80 },
  { state_id: 'MH', state_name: 'Maharashtra', lat: 19.75, lon: 75.71, weight: 48 },
  { state_id: 'WB', state_name: 'West Bengal', lat: 22.99, lon: 87.85, weight: 42 },
  { state_id: 'BR', state_name: 'Bihar', lat: 25.6, lon: 85.35, weight: 40 },
  { state_id: 'TN', state_name: 'Tamil Nadu', lat: 11.13, lon: 78.66, weight: 39 },
  { state_id: 'MP', state_name: 'Madhya Pradesh', lat: 23.47, lon: 77.95, weight: 29 },
  { state_id: 'KA', state_name: 'Karnataka', lat: 15.32, lon: 75.71, weight: 28 },
  { state_id: 'GJ', state_name: 'Gujarat', lat: 22.31, lon: 72.14, weight: 26 },
  { state_id: 'AP', state_name: 'Andhra Pradesh', lat: 15.91, lon: 79.74, weight: 25 },
  { state_id: 'RJ', state_name: 'Rajasthan', lat: 27.02, lon: 74.22, weight: 25 },
  { state_id: 'OD', state_name: 'Odisha', lat: 20.95, lon: 85.1, weight: 21 },
  { state_id: 'KL', state_name: 'Kerala', lat: 10.85, lon: 76.27, weight: 20 },
  { state_id: 'TG', state_name: 'Telangana', lat: 18.11, lon: 79.02, weight: 17 },
  { state_id: 'AS', state_name: 'Assam', lat: 26.2, lon: 92.94, weight: 14 },
  { state_id: 'JH', state_name: 'Jharkhand', lat: 23.61, lon: 85.28, weight: 14 },
  { state_id: 'PB', state_name: 'Punjab', lat: 31.15, lon: 75.34, weight: 13 },
  { state_id: 'CG', state_name: 'Chhattisgarh', lat: 21.28, lon: 81.87, weight: 11 },
  { state_id: 'HR', state_name: 'Haryana', lat: 29.06, lon: 76.09, weight: 10 },
  { state_id: 'DL', state_name: 'Delhi', lat: 28.65, lon: 77.19, weight: 7 },
  { state_id: 'JK', state_name: 'Jammu & Kashmir', lat: 33.78, lon: 76.58, weight: 5 },
  { state_id: 'UK', state_name: 'Uttarakhand', lat: 30.07, lon: 79.09, weight: 5 },
  { state_id: 'HP', state_name: 'Himachal Pradesh', lat: 31.81, lon: 77.23, weight: 4 },
  { state_id: 'AR', state_name: 'Arunachal Pradesh', lat: 28.05, lon: 94.34, weight: 2 },
  { state_id: 'GA', state_name: 'Goa', lat: 15.36, lon: 74.03, weight: 2 },
  { state_id: 'ML', state_name: 'Meghalaya', lat: 25.47, lon: 91.37, weight: 2 },
  { state_id: 'MN', state_name: 'Manipur', lat: 24.72, lon: 93.9, weight: 2 },
  { state_id: 'TR', state_name: 'Tripura', lat: 23.75, lon: 91.71, weight: 2 },
  { state_id: 'NL', state_name: 'Nagaland', lat: 26.09, lon: 94.53, weight: 1 },
  { state_id: 'MZ', state_name: 'Mizoram', lat: 23.36, lon: 92.83, weight: 1 },
  { state_id: 'SK', state_name: 'Sikkim', lat: 27.55, lon: 88.5, weight: 1 },
] as const;

export interface MockDistrict {
  district_id: string;
  district_name: string;
  state_id: string;
  lat: number;
  lon: number;
}

/** Real district names with approximate administrative-centre coordinates. */
export const MOCK_DISTRICTS: readonly MockDistrict[] = [
  // Uttar Pradesh
  { district_id: 'UP-LKO', district_name: 'Lucknow', state_id: 'UP', lat: 26.8467, lon: 80.9462 },
  { district_id: 'UP-KNP', district_name: 'Kanpur Nagar', state_id: 'UP', lat: 26.4499, lon: 80.3319 },
  { district_id: 'UP-VNS', district_name: 'Varanasi', state_id: 'UP', lat: 25.3176, lon: 82.9739 },
  { district_id: 'UP-PRJ', district_name: 'Prayagraj', state_id: 'UP', lat: 25.4358, lon: 81.8463 },
  { district_id: 'UP-GKP', district_name: 'Gorakhpur', state_id: 'UP', lat: 26.7606, lon: 83.3732 },
  { district_id: 'UP-MRT', district_name: 'Meerut', state_id: 'UP', lat: 28.9845, lon: 77.7064 },
  { district_id: 'UP-AGR', district_name: 'Agra', state_id: 'UP', lat: 27.1767, lon: 78.0081 },
  { district_id: 'UP-BLY', district_name: 'Bareilly', state_id: 'UP', lat: 28.367, lon: 79.4304 },
  // Maharashtra
  { district_id: 'MH-PUN', district_name: 'Pune', state_id: 'MH', lat: 18.5204, lon: 73.8567 },
  { district_id: 'MH-NGP', district_name: 'Nagpur', state_id: 'MH', lat: 21.1458, lon: 79.0882 },
  { district_id: 'MH-NSK', district_name: 'Nashik', state_id: 'MH', lat: 19.9975, lon: 73.7898 },
  { district_id: 'MH-ABD', district_name: 'Chhatrapati Sambhajinagar', state_id: 'MH', lat: 19.8762, lon: 75.3433 },
  { district_id: 'MH-SOL', district_name: 'Solapur', state_id: 'MH', lat: 17.6599, lon: 75.9064 },
  { district_id: 'MH-KOL', district_name: 'Kolhapur', state_id: 'MH', lat: 16.705, lon: 74.2433 },
  // West Bengal
  { district_id: 'WB-KOL', district_name: 'Kolkata', state_id: 'WB', lat: 22.5726, lon: 88.3639 },
  { district_id: 'WB-HOW', district_name: 'Howrah', state_id: 'WB', lat: 22.5958, lon: 88.2636 },
  { district_id: 'WB-MUR', district_name: 'Murshidabad', state_id: 'WB', lat: 24.1833, lon: 88.2833 },
  { district_id: 'WB-DAR', district_name: 'Darjeeling', state_id: 'WB', lat: 27.041, lon: 88.2663 },
  { district_id: 'WB-BAN', district_name: 'Bankura', state_id: 'WB', lat: 23.2324, lon: 87.0753 },
  // Bihar
  { district_id: 'BR-PAT', district_name: 'Patna', state_id: 'BR', lat: 25.5941, lon: 85.1376 },
  { district_id: 'BR-GAY', district_name: 'Gaya', state_id: 'BR', lat: 24.7955, lon: 84.9994 },
  { district_id: 'BR-MZP', district_name: 'Muzaffarpur', state_id: 'BR', lat: 26.1209, lon: 85.3647 },
  { district_id: 'BR-BGP', district_name: 'Bhagalpur', state_id: 'BR', lat: 25.2425, lon: 86.9842 },
  { district_id: 'BR-DAR', district_name: 'Darbhanga', state_id: 'BR', lat: 26.1542, lon: 85.8918 },
  // Tamil Nadu
  { district_id: 'TN-CHN', district_name: 'Chennai', state_id: 'TN', lat: 13.0827, lon: 80.2707 },
  { district_id: 'TN-CBE', district_name: 'Coimbatore', state_id: 'TN', lat: 11.0168, lon: 76.9558 },
  { district_id: 'TN-MDU', district_name: 'Madurai', state_id: 'TN', lat: 9.9252, lon: 78.1198 },
  { district_id: 'TN-TRY', district_name: 'Tiruchirappalli', state_id: 'TN', lat: 10.7905, lon: 78.7047 },
  { district_id: 'TN-SLM', district_name: 'Salem', state_id: 'TN', lat: 11.6643, lon: 78.146 },
  // Madhya Pradesh
  { district_id: 'MP-BHO', district_name: 'Bhopal', state_id: 'MP', lat: 23.2599, lon: 77.4126 },
  { district_id: 'MP-IND', district_name: 'Indore', state_id: 'MP', lat: 22.7196, lon: 75.8577 },
  { district_id: 'MP-JBP', district_name: 'Jabalpur', state_id: 'MP', lat: 23.1815, lon: 79.9864 },
  { district_id: 'MP-GWL', district_name: 'Gwalior', state_id: 'MP', lat: 26.2183, lon: 78.1828 },
  // Karnataka
  { district_id: 'KA-BLR', district_name: 'Bengaluru Urban', state_id: 'KA', lat: 12.9716, lon: 77.5946 },
  { district_id: 'KA-MYS', district_name: 'Mysuru', state_id: 'KA', lat: 12.2958, lon: 76.6394 },
  { district_id: 'KA-BGM', district_name: 'Belagavi', state_id: 'KA', lat: 15.8497, lon: 74.4977 },
  { district_id: 'KA-KLB', district_name: 'Kalaburagi', state_id: 'KA', lat: 17.3297, lon: 76.8343 },
  // Gujarat
  { district_id: 'GJ-AMD', district_name: 'Ahmedabad', state_id: 'GJ', lat: 23.0225, lon: 72.5714 },
  { district_id: 'GJ-SRT', district_name: 'Surat', state_id: 'GJ', lat: 21.1702, lon: 72.8311 },
  { district_id: 'GJ-VAD', district_name: 'Vadodara', state_id: 'GJ', lat: 22.3072, lon: 73.1812 },
  { district_id: 'GJ-RAJ', district_name: 'Rajkot', state_id: 'GJ', lat: 22.3039, lon: 70.8022 },
  // Andhra Pradesh
  { district_id: 'AP-VSK', district_name: 'Visakhapatnam', state_id: 'AP', lat: 17.6868, lon: 83.2185 },
  { district_id: 'AP-VJA', district_name: 'Krishna', state_id: 'AP', lat: 16.5062, lon: 80.648 },
  { district_id: 'AP-GTR', district_name: 'Guntur', state_id: 'AP', lat: 16.3067, lon: 80.4365 },
  { district_id: 'AP-KNL', district_name: 'Kurnool', state_id: 'AP', lat: 15.8281, lon: 78.0373 },
  // Rajasthan
  { district_id: 'RJ-JAI', district_name: 'Jaipur', state_id: 'RJ', lat: 26.9124, lon: 75.7873 },
  { district_id: 'RJ-JOD', district_name: 'Jodhpur', state_id: 'RJ', lat: 26.2389, lon: 73.0243 },
  { district_id: 'RJ-UDR', district_name: 'Udaipur', state_id: 'RJ', lat: 24.5854, lon: 73.7125 },
  { district_id: 'RJ-KOT', district_name: 'Kota', state_id: 'RJ', lat: 25.2138, lon: 75.8648 },
  // Odisha
  { district_id: 'OD-KHR', district_name: 'Khordha', state_id: 'OD', lat: 20.2961, lon: 85.8245 },
  { district_id: 'OD-CTC', district_name: 'Cuttack', state_id: 'OD', lat: 20.4625, lon: 85.8828 },
  { district_id: 'OD-GJM', district_name: 'Ganjam', state_id: 'OD', lat: 19.3149, lon: 84.7941 },
  { district_id: 'OD-SBP', district_name: 'Sambalpur', state_id: 'OD', lat: 21.4669, lon: 83.9812 },
  // Kerala
  { district_id: 'KL-TVM', district_name: 'Thiruvananthapuram', state_id: 'KL', lat: 8.5241, lon: 76.9366 },
  { district_id: 'KL-EKM', district_name: 'Ernakulam', state_id: 'KL', lat: 9.9816, lon: 76.2999 },
  { district_id: 'KL-KZD', district_name: 'Kozhikode', state_id: 'KL', lat: 11.2588, lon: 75.7804 },
  // Telangana
  { district_id: 'TG-HYD', district_name: 'Hyderabad', state_id: 'TG', lat: 17.385, lon: 78.4867 },
  { district_id: 'TG-WGL', district_name: 'Warangal', state_id: 'TG', lat: 17.9689, lon: 79.5941 },
  { district_id: 'TG-KRM', district_name: 'Karimnagar', state_id: 'TG', lat: 18.4386, lon: 79.1288 },
  // Assam
  { district_id: 'AS-KAM', district_name: 'Kamrup Metropolitan', state_id: 'AS', lat: 26.1445, lon: 91.7362 },
  { district_id: 'AS-DIB', district_name: 'Dibrugarh', state_id: 'AS', lat: 27.4728, lon: 94.912 },
  { district_id: 'AS-SIL', district_name: 'Cachar', state_id: 'AS', lat: 24.8333, lon: 92.7789 },
  // Jharkhand
  { district_id: 'JH-RAN', district_name: 'Ranchi', state_id: 'JH', lat: 23.3441, lon: 85.3096 },
  { district_id: 'JH-DHN', district_name: 'Dhanbad', state_id: 'JH', lat: 23.7957, lon: 86.4304 },
  { district_id: 'JH-JSR', district_name: 'East Singhbhum', state_id: 'JH', lat: 22.8046, lon: 86.2029 },
  // Punjab
  { district_id: 'PB-ASR', district_name: 'Amritsar', state_id: 'PB', lat: 31.634, lon: 74.8723 },
  { district_id: 'PB-LDH', district_name: 'Ludhiana', state_id: 'PB', lat: 30.901, lon: 75.8573 },
  { district_id: 'PB-PTL', district_name: 'Patiala', state_id: 'PB', lat: 30.3398, lon: 76.3869 },
  // Chhattisgarh
  { district_id: 'CG-RAI', district_name: 'Raipur', state_id: 'CG', lat: 21.2514, lon: 81.6296 },
  { district_id: 'CG-BSP', district_name: 'Bilaspur', state_id: 'CG', lat: 22.0797, lon: 82.1409 },
  { district_id: 'CG-BST', district_name: 'Bastar', state_id: 'CG', lat: 19.3178, lon: 81.9615 },
  // Haryana
  { district_id: 'HR-GGN', district_name: 'Gurugram', state_id: 'HR', lat: 28.4595, lon: 77.0266 },
  { district_id: 'HR-HSR', district_name: 'Hisar', state_id: 'HR', lat: 29.1492, lon: 75.7217 },
  { district_id: 'HR-KNL', district_name: 'Karnal', state_id: 'HR', lat: 29.6857, lon: 76.9905 },
  // Delhi
  { district_id: 'DL-ND', district_name: 'New Delhi', state_id: 'DL', lat: 28.6139, lon: 77.209 },
  { district_id: 'DL-NW', district_name: 'North West Delhi', state_id: 'DL', lat: 28.7186, lon: 77.0684 },
  // Jammu & Kashmir
  { district_id: 'JK-SRI', district_name: 'Srinagar', state_id: 'JK', lat: 34.0837, lon: 74.7973 },
  { district_id: 'JK-JMU', district_name: 'Jammu', state_id: 'JK', lat: 32.7266, lon: 74.857 },
  // Uttarakhand
  { district_id: 'UK-DDN', district_name: 'Dehradun', state_id: 'UK', lat: 30.3165, lon: 78.0322 },
  { district_id: 'UK-NTL', district_name: 'Nainital', state_id: 'UK', lat: 29.3919, lon: 79.4542 },
  // Himachal Pradesh
  { district_id: 'HP-SML', district_name: 'Shimla', state_id: 'HP', lat: 31.1048, lon: 77.1734 },
  { district_id: 'HP-KGR', district_name: 'Kangra', state_id: 'HP', lat: 32.0998, lon: 76.2691 },
  // Smaller states and UTs
  { district_id: 'AR-PAP', district_name: 'Papum Pare', state_id: 'AR', lat: 27.1004, lon: 93.6167 },
  { district_id: 'GA-NGA', district_name: 'North Goa', state_id: 'GA', lat: 15.4989, lon: 73.8278 },
  { district_id: 'ML-EKH', district_name: 'East Khasi Hills', state_id: 'ML', lat: 25.5788, lon: 91.8933 },
  { district_id: 'MN-IMW', district_name: 'Imphal West', state_id: 'MN', lat: 24.8074, lon: 93.9384 },
  { district_id: 'TR-WTR', district_name: 'West Tripura', state_id: 'TR', lat: 23.8315, lon: 91.2868 },
  { district_id: 'NL-KOH', district_name: 'Kohima', state_id: 'NL', lat: 25.6751, lon: 94.1086 },
  { district_id: 'MZ-AIZ', district_name: 'Aizawl', state_id: 'MZ', lat: 23.7271, lon: 92.7176 },
  { district_id: 'SK-EST', district_name: 'Gangtok', state_id: 'SK', lat: 27.3314, lon: 88.6138 },
] as const;

export const STATE_BY_ID: Record<string, MockState> = Object.fromEntries(
  MOCK_STATES.map((s) => [s.state_id, s]),
);

export const DISTRICT_BY_ID: Record<string, MockDistrict> = Object.fromEntries(
  MOCK_DISTRICTS.map((d) => [d.district_id, d]),
);

export const DISTRICTS_BY_STATE: Record<string, MockDistrict[]> = MOCK_DISTRICTS.reduce<
  Record<string, MockDistrict[]>
>((acc, district) => {
  (acc[district.state_id] ??= []).push(district);
  return acc;
}, {});

/** Great-circle distance in kilometres. Used to derive duplicate-pair separation. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Offsets a coordinate by a given distance in metres along a bearing. */
export function offsetCoordinate(
  lat: number,
  lon: number,
  metres: number,
  bearingDeg: number,
): { lat: number; lon: number } {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const angular = metres / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: Number(toDeg(lat2).toFixed(6)), lon: Number(toDeg(lon2).toFixed(6)) };
}
