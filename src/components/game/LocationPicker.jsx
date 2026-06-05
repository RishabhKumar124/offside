import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function LocationPicker({ lat, lng, locationName, onLocationChange, onNameChange, readOnly = false }) {

  const handleMapClick = (e) => {
    if (readOnly) return;
    // When user clicks, we use a search-based approach via the name input
  };

  // Build Google Maps embed URL
  const mapSrc = lat && lng
    ? `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`
    : locationName
      ? `https://maps.google.com/maps?q=${encodeURIComponent(locationName)}&z=14&output=embed`
      : null;

  return (
    <div className="space-y-3">
      {!readOnly && (
        <>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Enter venue name or address..."
              value={locationName || ''}
              onChange={(e) => onNameChange?.(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Input
                type="number"
                step="any"
                placeholder="Latitude (optional)"
                value={lat || ''}
                onChange={(e) => onLocationChange?.(parseFloat(e.target.value) || null, lng)}
                className="text-xs"
              />
            </div>
            <div className="relative">
              <Input
                type="number"
                step="any"
                placeholder="Longitude (optional)"
                value={lng || ''}
                onChange={(e) => onLocationChange?.(lat, parseFloat(e.target.value) || null)}
                className="text-xs"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">📍 Enter a venue name — the map preview will update automatically</p>
        </>
      )}

      {readOnly && locationName && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="w-4 h-4 text-primary" />
          {locationName}
        </div>
      )}

      {mapSrc && (
        <div className="rounded-xl overflow-hidden border h-[200px] md:h-[280px]">
          <iframe
            src={mapSrc}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Game location map"
          />
        </div>
      )}

      {!mapSrc && !readOnly && (
        <div className="rounded-xl border h-[200px] bg-muted/30 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Enter a venue name to see the map</p>
          </div>
        </div>
      )}
    </div>
  );
}