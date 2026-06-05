import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import {
  Bell, CheckCheck, Trophy, Users, Star, BarChart3, UserPlus, Clock, Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const typeIcons = {
  teams_announced: Users,
  submit_stats: BarChart3,
  stats_approved: CheckCheck,
  mvp_awarded: Trophy,
  rsvp_accepted: UserPlus,
  waitlist: Clock,
  game_update: Bell,
};

export default function Notifications() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await base44.entities.Notification.update(n.id, { read: true });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-4xl tracking-wider">NOTIFICATIONS</h1>
        {notifications.some(n => !n.read) && (
          <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate()}>
            <CheckCheck className="w-4 h-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const Icon = typeIcons[notif.type] || Bell;
            return (
              <Link key={notif.id} to={notif.game_id ? `/game/${notif.game_id}` : '#'}>
                <Card className={`p-4 transition-all hover:shadow-md ${!notif.read ? 'border-primary/30 bg-primary/5' : ''}`}>
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${!notif.read ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`w-4 h-4 ${!notif.read ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{notif.title}</p>
                        {!notif.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}