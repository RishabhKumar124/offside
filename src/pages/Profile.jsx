import { useState, useEffect } from 'react';
import { appClient } from '@/api/backendClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ClubSearch from '@/components/clubs/ClubSearch';
import { Camera, Trophy, Target, Handshake, Gamepad2, Save, LogOut, Loader2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import PageBackButton from '@/components/PageBackButton';
import { useAuth } from '@/lib/AuthContext';

export default function Profile() {
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    birthday: '',
    about_me: '',
    favourite_club: '',
    profile_photo: '',
  });

  useEffect(() => {
    appClient.auth.me().then(u => {
      setUser(u);
      setForm({
        birthday: u.birthday || '',
        about_me: u.about_me || '',
        favourite_club: u.favourite_club || '',
        profile_photo: u.profile_photo || '',
      });
      setLoading(false);
    });
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setForm(prev => ({ ...prev, profile_photo: file_url }));
    } catch (error) {
      toast({
        title: 'Photo upload failed',
        description: error.message || 'Please try another image.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await appClient.auth.updateMe(form);
      toast({
        title: 'Profile saved',
        description: 'Your changes were saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    { label: 'Goals', value: user?.total_goals || 0, icon: Target, color: 'text-primary' },
    { label: 'Assists', value: user?.total_assists || 0, icon: Handshake, color: 'text-chart-2' },
    { label: 'MVPs', value: user?.total_mvps || 0, icon: Trophy, color: 'text-chart-3' },
    { label: 'Games', value: user?.games_played || 0, icon: Gamepad2, color: 'text-chart-4' },
  ];

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="mb-4">
        <PageBackButton fallbackTo="/" />
      </div>
      <h1 className="font-display text-4xl tracking-wider mb-6">MY PROFILE</h1>

      {/* Player Card */}
      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-transparent to-primary/5 p-6">
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              {form.profile_photo ? (
                <img src={form.profile_photo} alt="" className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                  <span className="text-3xl font-display text-muted-foreground">{user?.full_name?.[0]}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
            <div>
              <h2 className="font-heading text-2xl">{user?.full_name}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {form.favourite_club && (
                <Badge variant="outline" className="mt-1 text-xs">{form.favourite_club}</Badge>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
                <p className="font-display text-2xl">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Edit Form */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Birthday</Label>
              <Input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({...form, birthday: e.target.value})}
              />
            </div>
            <div>
              <Label>Favourite Club</Label>
              <ClubSearch value={form.favourite_club} onChange={(v) => setForm({...form, favourite_club: v})} />
            </div>
            <div>
              <Label>About Me</Label>
              <Textarea
                placeholder="Tell others about yourself..."
                value={form.about_me}
                onChange={(e) => setForm({...form, about_me: e.target.value})}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full h-12 font-heading tracking-wider text-lg" disabled={saving}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> SAVE PROFILE</>}
        </Button>

        {user?.role === 'admin' && (
          <Link to="/admin">
            <Button variant="outline" className="w-full border-primary/30 text-primary">
              <ShieldCheck className="w-4 h-4 mr-2" /> Admin Settings
            </Button>
          </Link>
        )}

        <Button variant="outline" className="w-full" onClick={() => logout()}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
