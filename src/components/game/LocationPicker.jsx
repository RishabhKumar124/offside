import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapClick({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({ lat, lng, locationName, onLocationChange, onNameChange, readOnly = false }) {
  const center = lat && lng ? [lat, lng] : [51.505, -0.09];

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Enter venue name..."
            value={locationName || ''}
            onChange={(e) => onNameChange?.(e.target.value)}
            className="pl-9"
          />
        </div>
      )}
      <div className="rounded-xl overflow-hidden border h-[200px] md:h-[300px]">
        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={!readOnly}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && <MapClick onLocationSelect={(la, ln) => onLocationChange?.(la, ln)} />}
          {lat && lng && <Marker position={[lat, lng]} />}
        </MapContainer>
      </div>
      {!readOnly && (
        <p className="text-xs text-muted-foreground">Click on the map to set the game location</p>
      )}
    </div>
  );
}