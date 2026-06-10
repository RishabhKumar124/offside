import { useParams, Link } from 'react-router-dom';
import { appClient } from '@/api/backendClient';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Target, Handshake, Trophy, Gamepad2, Loader2 } from 'lucide-react';

export default function PlayerProfile() {
  const { userId } = useParams();

  const { data: player, isLoading } = useQuery({
    queryKey: ['player', userId],
    queryFn: async () => {
      const users = await appClient.entities.User.filter({ id: userId });
      return users[0];
    },
  });

  const { data: recentStats = [] } = useQuery({
    queryKey: ['player-stats', userId],
    queryFn: () => appClient.entities.StatSubmission.filter({ user_id: userId, status: 'approved' }),
  });

  if (isLoading || !player) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    { label: 'Goals', value: player.total_goals || 0, icon: Target, color: 'text-primary' },
    { label: 'Assists', value: player.total_assists || 0, icon: Handshake, color: 'text-chart-2' },
    { label: 'MVPs', value: player.total_mvps || 0, icon: Trophy, color: 'text-chart-3' },
    { label: 'Games', value: player.games_played || 0, icon: Gamepad2, color: 'text-chart-4' },
  ];

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-transparent to-primary/5 p-6">
          <div className="flex items-center gap-4">
            {player.profile_photo ? (
              <img src={player.profile_photo} alt="" className="w-20 h-20 rounded-2xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <span className="text-3xl font-display text-muted-foreground">{player.full_name?.[0]}</span>
              </div>
            )}
            <div>
              <h2 className="font-heading text-3xl tracking-wide">{player.full_name}</h2>
              {player.favourite_club && (
                <Badge variant="outline" className="mt-1 text-xs">{player.favourite_club}</Badge>
              )}
            </div>
          </div>

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

        {player.about_me && (
          <div className="p-6 border-t">
            <h3 className="text-sm font-medium mb-2">About</h3>
            <p className="text-sm text-muted-foreground">{player.about_me}</p>
          </div>
        )}

        {recentStats.length > 0 && (
          <div className="p-6 border-t">
            <h3 className="text-sm font-medium mb-3">Recent Games</h3>
            <div className="space-y-2">
              {recentStats.slice(0, 10).map(stat => (
                <Link key={stat.id} to={`/game/${stat.game_id}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <span className="text-sm text-muted-foreground">Game</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span>⚽ {stat.goals}</span>
                    <span>🅰️ {stat.assists}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}