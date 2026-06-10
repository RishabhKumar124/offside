import { appClient } from '@/api/backendClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, CheckCircle } from 'lucide-react';

export default function MOTMVoting({ gameId, userId, goingRsvps }) {
  const queryClient = useQueryClient();

  const { data: votes = [] } = useQuery({
    queryKey: ['motm-votes', gameId],
    queryFn: () => appClient.entities.MOTMVote.filter({ game_id: gameId }),
  });

  const myVote = votes.find(v => v.voter_id === userId);

  const voteMutation = useMutation({
    mutationFn: async (player) => {
      if (myVote) {
        await appClient.entities.MOTMVote.update(myVote.id, {
          voted_for_id: player.user_id,
          voted_for_name: player.user_name,
        });
      } else {
        await appClient.entities.MOTMVote.create({
          game_id: gameId,
          voter_id: userId,
          voted_for_id: player.user_id,
          voted_for_name: player.user_name,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['motm-votes', gameId] }),
  });

  // Tally votes
  const tally = votes.reduce((acc, v) => {
    acc[v.voted_for_id] = (acc[v.voted_for_id] || 0) + 1;
    return acc;
  }, {});

  const eligible = goingRsvps.filter(r => r.user_id !== userId);

  if (myVote) {
    return (
      <Card className="mt-6 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-chart-3 fill-chart-3" /> Man of the Match Vote
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            You voted for <span className="font-semibold text-foreground">{myVote.voted_for_name}</span>. 
            {' '}Tap another player to change your vote.
          </p>
          <div className="space-y-2">
            {eligible.map(player => {
              const count = tally[player.user_id] || 0;
              const isSelected = myVote.voted_for_id === player.user_id;
              return (
                <button
                  key={player.user_id}
                  onClick={() => voteMutation.mutate(player)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    isSelected
                      ? 'border-chart-3 bg-chart-3/10'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {player.user_photo ? (
                    <img src={player.user_photo} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {player.user_name?.[0]}
                    </div>
                  )}
                  <span className="text-sm font-medium flex-1">{player.user_name}</span>
                  {count > 0 && (
                    <span className="text-xs text-muted-foreground">{count} vote{count !== 1 ? 's' : ''}</span>
                  )}
                  {isSelected && <CheckCircle className="w-4 h-4 text-chart-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="w-4 h-4 text-chart-3" /> Vote for Man of the Match
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">Who was the best player today?</p>
        {eligible.map(player => (
          <button
            key={player.user_id}
            onClick={() => voteMutation.mutate(player)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted hover:border-chart-3/50 transition-all text-left"
          >
            {player.user_photo ? (
              <img src={player.user_photo} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {player.user_name?.[0]}
              </div>
            )}
            <span className="text-sm font-medium">{player.user_name}</span>
            <Star className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
          </button>
        ))}
        {eligible.length === 0 && (
          <p className="text-sm text-muted-foreground">No other players to vote for.</p>
        )}
      </CardContent>
    </Card>
  );
}