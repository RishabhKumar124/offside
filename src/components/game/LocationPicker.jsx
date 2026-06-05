import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
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

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Flies to coordinates when they change
function MapFlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

export default function LocationPicker({ lat, lng, locationName, onLocationChange, onNameChange, readOnly = false }) {
  const defaultCenter = [40.7128, -74.006]; // New York as default
  const center = lat && lng ? [lat, lng] : defaultCenter;

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
      {readOnly && locationName && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="w-4 h-4 text-primary" />
          {locationName}
        </div>
      )}
      <div className="rounded-xl overflow-hidden border h-[200px] md:h-[280px]">
        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && (
            <MapClickHandler onLocationSelect={(la, ln) => onLocationChange?.(la, ln)} />
          )}
          {lat && lng && (
            <>
              <Marker position={[lat, lng]} />
              <MapFlyTo lat={lat} lng={lng} />
            </>
          )}
        </MapContainer>
      </div>
      {!readOnly && (
        <p className="text-xs text-muted-foreground">📍 Click on the map to pin the game location</p>
      )}
    </div>
  );
}