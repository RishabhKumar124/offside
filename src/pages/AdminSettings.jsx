import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Save, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function AdminSettings() {
  const [user, setUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['host-password-setting'],
    queryFn: () => base44.entities.AppSettings.filter({ key: 'host_password' }),
  });

  const currentSetting = settings[0];

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (currentSetting) {
        await base44.entities.AppSettings.update(currentSetting.id, { value: newPassword });
      } else {
        await base44.entities.AppSettings.create({ key: 'host_password', value: newPassword });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-password-setting'] });
      setSaved(true);
      setNewPassword('');
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 text-center">
        <Lock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h1 className="font-display text-3xl tracking-wider">ADMIN SETTINGS</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="w-4 h-4 text-primary" /> Host Passcode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Current passcode</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={currentSetting?.value || '—'}
                readOnly
                className="bg-muted/50"
              />
              <Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label>New passcode</Label>
            <Input
              type="text"
              placeholder="Enter new passcode..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => updateMutation.mutate()}
            disabled={!newPassword.trim() || updateMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saved ? '✓ Saved!' : 'Save New Passcode'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}