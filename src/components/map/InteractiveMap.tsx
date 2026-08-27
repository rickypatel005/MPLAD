'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

import type { MapDataResponse, MapProjectMarker, DistrictRiskAggregate } from '@/types/api';
import { RISK_LEVEL_META, riskLevelFromScore } from '@/lib/risk';
import { RiskBadge } from '@/components/RiskBadge';
import { formatCount, formatLakhs } from '@/lib/format';

import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons default path in Next.js
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface InteractiveMapProps {
  data: MapDataResponse;
  selectedState?: string;
  selectedDistrict?: string;
  onSelectProject?: (projectId: string) => void;
}

function MapViewController({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom);
  }, [map, lat, lon, zoom]);
  return null;
}

export function InteractiveMap({ data, selectedState, selectedDistrict, onSelectProject }: InteractiveMapProps) {
  // Center map on India by default
  const centerLat = 22.5937;
  const centerLon = 78.9629;
  const zoom = selectedDistrict ? 9 : selectedState ? 7 : 5;

  return (
    <div className="relative h-[650px] w-full rounded-card border border-line overflow-hidden shadow-card">
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewController lat={centerLat} lon={centerLon} zoom={zoom} />

        {/* District Aggregates (Circle Markers) */}
        {data.districts.map((dist) => {
          const hex = RISK_LEVEL_META[dist.risk_level].hex;
          return (
            <CircleMarker
              key={dist.district_id}
              center={[dist.lat, dist.lon]}
              radius={Math.max(12, Math.min(28, dist.project_count / 3))}
              pathOptions={{
                color: hex,
                fillColor: hex,
                fillOpacity: 0.5,
                weight: 2,
              }}
            >
              <Popup>
                <div className="p-1 space-y-2 min-w-[200px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{dist.district_name}</span>
                    <RiskBadge level={dist.risk_level} score={dist.mean_risk} size="sm" />
                  </div>
                  <p className="text-caption text-ink-muted">{dist.state_name}</p>
                  <div className="border-t border-line pt-1 text-caption space-y-0.5">
                    <div className="flex justify-between">
                      <span>Total Works:</span>
                      <span className="font-semibold">{formatCount(dist.project_count)}</span>
                    </div>
                    <div className="flex justify-between text-risk-critical-text">
                      <span>Critical:</span>
                      <span className="font-semibold">{dist.counts_by_risk_level.CRITICAL}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Individual Project Markers */}
        {data.projects.map((proj) => {
          const hex = RISK_LEVEL_META[proj.risk_level].hex;
          return (
            <CircleMarker
              key={proj.project_id}
              center={[proj.lat, proj.lon]}
              radius={6}
              pathOptions={{
                color: '#ffffff',
                fillColor: hex,
                fillOpacity: 0.9,
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="p-1 space-y-2 min-w-[220px]">
                  <div className="flex items-center justify-between">
                    <a
                      href={`/project/${encodeURIComponent(proj.project_id)}`}
                      className="font-bold text-gov-700 hover:underline"
                    >
                      {proj.project_id}
                    </a>
                    <RiskBadge level={proj.risk_level} score={proj.overall_risk} size="sm" />
                  </div>
                  <p className="text-caption font-medium text-ink">{proj.work_type}</p>
                  <p className="text-caption text-ink-muted">{proj.top_reason}</p>
                  <div className="flex justify-between text-meta text-ink-muted pt-1 border-t border-line">
                    <span>{proj.district_name}, {proj.state_name}</span>
                    <span>{proj.location_source === 'GPS' ? 'GPS' : 'Centroid'}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
