import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { appClient } from '@/api/backendClient';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LocationSearch from '@/components/game/LocationSearch';
import { CalendarDays, Users, Trophy, Loader2, Lock, ShieldCheck } from 'lucide-react';
import PageBackButton from '@/components/PageBackButton';
import { toast } from '@/components/ui/use-toast';
import { toApiDateTime } from '@/lib/dateTime';

export default function CreateGame() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ['host-password-setting'],
    queryFn: () => appClient.entities.AppSettings.filter({ key: 'host_password' }),
  });
  const hostPassword = settings[0]?.value || 'cesurtheman';
  const [form, setForm] = useState({
    title: '',
    date: '',
    location_name: '',
    location_lat: null,
    location_lng: null,
    max_players: 10,
    rules: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!unlocked) {
      toast({
        title: 'Host passcode required',
        description: 'Enter the host passcode to create a game.',
        variant: 'destructive',
      });
      return;
    }

    let currentUser = user;
    try {
      currentUser = await appClient.auth.me();
    } catch {
      toast({
        title: 'Not signed in',
        description: 'Please sign in again before creating a game.',
        variant: 'destructive',
      });
      return;
    }

    const title = form.title.trim();
    const date = form.date.trim();
    const locationName = form.location_name.trim();
    const maxPlayers = Number.isFinite(form.max_players) ? form.max_players : 10;

    if (!title || !date) {
      toast({
        title: 'Missing details',
        description: 'Add a title and date before creating the game.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const game = await appClient.game.create({
        ...form,
        title,
        date: toApiDateTime(date),
        location_name: locationName || 'TBD',
        max_players: maxPlayers,
        host_name: currentUser.full_name,
        host_photo: currentUser.profile_photo || '',
      });
      toast({
        title: 'Game created',
        description: 'Your event is live.',
      });
      navigate(`/game/${game.id}`);
    } catch (error) {
      toast({
        title: 'Could not create game',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl tracking-wider mb-2">HOSTS ONLY</h1>
        <p className="text-muted-foreground text-sm mb-8">Enter the host passcode to create a game.</p>
        <div className="w-full space-y-3">
          <Input
            type="password"
            placeholder="Enter passcode..."
            value={passcode}
            onChange={(e) => { setPasscode(e.target.value); setPasscodeError(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (passcode === hostPassword) setUnlocked(true);
                else setPasscodeError(true);
              }
            }}
            className={`text-center text-lg h-12 ${passcodeError ? 'border-destructive' : ''}`}
            autoFocus
          />
          {passcodeError && <p className="text-destructive text-sm">Incorrect passcode. Try again.</p>}
          <Button
            className="w-full h-12 font-heading tracking-wider text-lg"
            onClick={() => {
              if (passcode === hostPassword) setUnlocked(true);
              else setPasscodeError(true);
            }}
          >
            <ShieldCheck className="w-4 h-4 mr-2" /> UNLOCK
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="mb-4">
        <PageBackButton fallbackTo="/" />
      </div>
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
            <LocationSearch
              value={form.location_name}
              onChange={(name) => setForm({...form, location_name: name})}
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
