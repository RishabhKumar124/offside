import { MapPin, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function LocationPicker({ lat, lng, locationName, onLocationChange, onNameChange, readOnly = false }) {

  // Static map image from OpenStreetMap via staticmap service
  const staticMapUrl = lat && lng
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=600x300&maptype=mapnik&markers=${lat},${lng},red`
    : null;

  // Google Maps link for "open in maps"
  const googleMapsUrl = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : locationName
      ? `https://www.google.com/maps/search/${encodeURIComponent(locationName)}`
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
            <Input
              type="number"
              step="any"
              placeholder="Latitude"
              value={lat || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onLocationChange?.(isNaN(v) ? null : v, lng);
              }}
              className="text-xs"
            />
            <Input
              type="number"
              step="any"
              placeholder="Longitude"
              value={lng || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onLocationChange?.(lat, isNaN(v) ? null : v);
              }}
              className="text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">📍 Enter venue name — optionally add coordinates for a precise pin</p>
        </>
      )}

      {readOnly && locationName && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="w-4 h-4 text-primary" />
          {locationName}
        </div>
      )}

      {staticMapUrl && (
        <div className="rounded-xl overflow-hidden border relative group">
          <img
            src={staticMapUrl}
            alt={`Map showing ${locationName || 'game location'}`}
            className="w-full h-[220px] object-cover"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
          {/* Fallback if image fails */}
          <div className="hidden h-[220px] bg-muted/30 items-center justify-center flex-col gap-2">
            <MapPin className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Map unavailable</p>
          </div>
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 shadow hover:bg-white transition-colors text-foreground"
            >
              <ExternalLink className="w-3 h-3" /> Open in Maps
            </a>
          )}
        </div>
      )}

      {!staticMapUrl && locationName && (
        <div className="rounded-xl border bg-muted/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{locationName}</span>
          </div>
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> View on Maps
            </a>
          )}
        </div>
      )}

      {!staticMapUrl && !locationName && !readOnly && (
        <div className="rounded-xl border h-[120px] bg-muted/30 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Enter a venue name to see location</p>
          </div>
        </div>
      )}
    </div>
  );
}