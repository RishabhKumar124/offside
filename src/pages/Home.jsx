import { appClient } from '@/api/backendClient';
import { useQuery } from '@tanstack/react-query';
import GameCard from '@/components/game/GameCard';
import { Loader2, Zap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { goingParticipantsWithHost } from '@/utils/gameParticipants';

export default function Home() {
  const [tab, setTab] = useState('upcoming');

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => appClient.entities.Game.list('-date', 50),
  });

  const { data: rsvps = [] } = useQuery({
    queryKey: ['all-rsvps'],
    queryFn: () => appClient.entities.RSVP.filter({ status: 'going' }),
  });

  const rsvpsByGameId = rsvps.reduce((acc, rsvp) => {
    acc[rsvp.game_id] = acc[rsvp.game_id] || [];
    acc[rsvp.game_id].push(rsvp);
    return acc;
  }, {});

  const now = new Date();
  const upcoming = games.filter(g => g.status === 'upcoming' && new Date(g.date) >= now);
  const past = games.filter(g => g.status === 'completed');
  const displayGames = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="font-display text-5xl md:text-6xl tracking-wider text-foreground">
          OFF<span className="text-primary">SIDE</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Find your next game. Show your skills.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="upcoming" className="font-medium">
            <Zap className="w-4 h-4 mr-1.5" /> Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" className="font-medium">Past Games</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : displayGames.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">
            {tab === 'upcoming' ? 'No upcoming games. Be the first to host one!' : 'No past games yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayGames.map(game => {
            const rsvpCount = goingParticipantsWithHost(game, rsvpsByGameId[game.id] || []).length;
            return <GameCard key={game.id} game={game} rsvpCount={rsvpCount} />;
          })}
        </div>
      )}
    </div>
  );
}
