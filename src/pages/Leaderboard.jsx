import { appClient } from '@/api/backendClient';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { Target, Handshake, Trophy, Loader2, Crown } from 'lucide-react';
import { useState } from 'react';
import PageBackButton from '@/components/PageBackButton';

export default function Leaderboard() {
  const [sort, setSort] = useState('goals');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => appClient.entities.User.list('-total_goals', 100),
  });

  const sorted = [...users]
    .filter(u => (u.games_played || 0) > 0)
    .sort((a, b) => {
      if (sort === 'goals') return (b.total_goals || 0) - (a.total_goals || 0);
      if (sort === 'assists') return (b.total_assists || 0) - (a.total_assists || 0);
      return (b.total_mvps || 0) - (a.total_mvps || 0);
    });

  const podiumColors = ['text-chart-3', 'text-muted-foreground', 'text-chart-3/60'];

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="mb-4">
        <PageBackButton fallbackTo="/" />
      </div>
      <h1 className="font-display text-4xl tracking-wider mb-6">RANKINGS</h1>

      <Tabs value={sort} onValueChange={setSort} className="mb-6">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="goals"><Target className="w-4 h-4 mr-1" /> Goals</TabsTrigger>
          <TabsTrigger value="assists"><Handshake className="w-4 h-4 mr-1" /> Assists</TabsTrigger>
          <TabsTrigger value="mvps"><Trophy className="w-4 h-4 mr-1" /> MVPs</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No stats recorded yet. Play some games!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((player, i) => {
            const val = sort === 'goals' ? player.total_goals : sort === 'assists' ? player.total_assists : player.total_mvps;
            return (
              <Link key={player.id} to={`/player/${player.id}`}>
                <Card className={`p-4 hover:shadow-md transition-all ${i < 3 ? 'border-primary/20' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-8 text-center">
                      {i < 3 ? (
                        <Crown className={`w-5 h-5 mx-auto ${podiumColors[i]}`} />
                      ) : (
                        <span className="text-sm font-mono text-muted-foreground">{i + 1}</span>
                      )}
                    </div>
                    {player.profile_photo ? (
                      <img src={player.profile_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {player.full_name?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{player.full_name}</p>
                      <p className="text-xs text-muted-foreground">{player.games_played || 0} games</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl">{val || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{sort}</p>
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
