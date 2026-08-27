'use client';

import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet';

import type { DuplicateSideProject } from '@/types/api';
import { formatDistanceKm } from '@/lib/format';

import 'leaflet/dist/leaflet.css';

interface PairDistanceMiniMapProps {
  projectA: DuplicateSideProject;
  projectB: DuplicateSideProject;
  geoDistanceKm: number;
}

export function PairDistanceMiniMap({ projectA, projectB, geoDistanceKm }: PairDistanceMiniMapProps) {
  const latA = projectA.lat ?? 26.8467;
  const lonA = projectA.lon ?? 80.9462;
  const latB = projectB.lat ?? 26.8521;
  const lonB = projectB.lon ?? 80.9515;

  const centerLat = (latA + latB) / 2;
  const centerLon = (lonA + lonB) / 2;

  return (
    <div className="relative h-[220px] w-full rounded-card border border-line overflow-hidden shadow-flat">
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        dragging={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Work A Marker */}
        <CircleMarker
          center={[latA, lonA]}
          radius={8}
          pathOptions={{ color: '#2c5a96', fillColor: '#2c5a96', fillOpacity: 0.9, weight: 2 }}
        >
          <Popup>
            <div className="text-caption">
              <strong>Work A:</strong> {projectA.project_id}
            </div>
          </Popup>
        </CircleMarker>

        {/* Work B Marker */}
        <CircleMarker
          center={[latB, lonB]}
          radius={8}
          pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.9, weight: 2 }}
        >
          <Popup>
            <div className="text-caption">
              <strong>Work B:</strong> {projectB.project_id}
            </div>
          </Popup>
        </CircleMarker>

        {/* Distance Vector Polyline */}
        <Polyline
          positions={[
            [latA, lonA],
            [latB, lonB],
          ]}
          pathOptions={{ color: '#f97316', weight: 3, dashArray: '6, 6' }}
        />
      </MapContainer>

      {/* Floating Distance Badge */}
      <div className="absolute bottom-2 right-2 z-[1000] rounded-control border border-line bg-surface/90 px-2.5 py-1 backdrop-blur shadow-flat">
        <span className="eyebrow text-risk-high-text">Vector Distance: {formatDistanceKm(geoDistanceKm)}</span>
      </div>
    </div>
  );
}
