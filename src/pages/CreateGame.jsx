import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LocationPicker from '@/components/game/LocationPicker';
import { CalendarDays, Users, Trophy, Loader2 } from 'lucide-react';

export default function CreateGame() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: '',
    location_name: '',
    location_lat: null,
    location_lng: null,
    max_players: 10,
    rules: '',
  });

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const game = await base44.entities.Game.create({
      ...form,
      host_id: user.id,
      host_name: user.full_name,
      host_photo: user.profile_photo || '',
      status: 'upcoming',
      dark_team: [],
      white_team: [],
      stats_locked: false,
      teams_announced: false,
    });
    setLoading(false);
    navigate(`/game/${game.id}`);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="font-display text-4xl tracking-wider mb-6">HOST A GAME</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="w-5 h-5 text-primary" /> Game Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Game Title</Label>
              <Input
                placeholder="e.g. Saturday Night Football"
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                required
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Date & Time
              </Label>
              <Input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm({...form, date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" /> Max Players
              </Label>
              <Input
                type="number"
                min={2}
                max={50}
                value={form.max_players}
                onChange={(e) => setForm({...form, max_players: parseInt(e.target.value)})}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationPicker
              lat={form.location_lat}
              lng={form.location_lng}
              locationName={form.location_name}
              onLocationChange={(lat, lng) => setForm({...form, location_lat: lat, location_lng: lng})}
              onNameChange={(name) => setForm({...form, location_name: name})}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rules & Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any special rules, what to bring, or other notes..."
              value={form.rules}
              onChange={(e) => setForm({...form, rules: e.target.value})}
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-12 text-lg font-heading tracking-wider" disabled={loading}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CREATE GAME'}
        </Button>
      </form>
    </div>
  );
}