import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Trophy, Star, Target, Pencil, Check, X } from 'lucide-react';

function EditableStatRow({ stat, gameId, isHost }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [goals, setGoals] = useState(stat.goals || 0);
  const [assists, setAssists] = useState(stat.assists || 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const newGoals = parseInt(goals);
      const newAssists = parseInt(assists);
      if (stat.id) {
        await base44.entities.StatSubmission.update(stat.id, {
          goals: newGoals,
          assists: newAssists,
          status: 'approved',
        });
      } else {
        await base44.entities.StatSubmission.create({
          game_id: gameId,
          user_id: stat.user_id,
          user_name: stat.user_name,
          goals: newGoals,
          assists: newAssists,
          status: 'approved',
        });
      }
      // Update career stats
      const users = await base44.entities.User.filter({ id: stat.user_id });
      if (users.length > 0) {
        const u = users[0];
        await base44.entities.User.update(stat.user_id, {
          total_goals: Math.max(0, (u.total_goals || 0) - (stat.goals || 0) + newGoals),
          total_assists: Math.max(0, (u.total_assists || 0) - (stat.assists || 0) + newAssists),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats', gameId] });
      setEditing(false);
    },
  });

  return (
    <div className="flex items-center gap-3 py-2">
      {stat.user_photo ? (
        <img src={stat.user_photo} className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {stat.user_name?.[0]}
        </div>
      )}
      <Link to={`/player/${stat.user_id}`} className="text-sm font-medium flex-1 hover:underline truncate">
        {stat.user_name}
      </Link>

      {editing ? (
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">⚽</span>
            <Input
              type="number" min={0}
              value={goals}
              onChange={e => setGoals(e.target.value)}
              className="w-14 h-7 text-xs px-2"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">🅰️</span>
            <Input
              type="number" min={0}
              value={assists}
              onChange={e => setAssists(e.target.value)}
              className="w-14 h-7 text-xs px-2"
            />
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveMutation.mutate()}>
            <Check className="w-3.5 h-3.5 text-primary" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
            <X className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 shrink-0">
          {(stat.goals > 0 || stat.assists > 0) ? (
            <span className="text-xs text-muted-foreground">
              {stat.goals > 0 && `⚽ ${stat.goals}`}
              {stat.goals > 0 && stat.assists > 0 && ' · '}
              {stat.assists > 0 && `🅰️ ${stat.assists}`}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No stats</span>
          )}
          {isHost && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PostGameDashboard({ game, gameId, isHost }) {
  const { data: stats = [] } = useQuery({
    queryKey: ['stats', gameId],
    queryFn: () => base44.entities.StatSubmission.filter({ game_id: gameId }),
  });

  const { data: rsvps = [] } = useQuery({
    queryKey: ['rsvps', gameId],
    queryFn: () => base44.entities.RSVP.filter({ game_id: gameId }),
  });

  const approvedStats = stats.filter(s => s.status === 'approved');
  const goingRsvps = rsvps.filter(r => r.status === 'going');

  // Build full player list: approved stats + players without stats
  const statsMap = Object.fromEntries(approvedStats.map(s => [s.user_id, s]));
  const allPlayers = goingRsvps.map(r => statsMap[r.user_id] || {
    user_id: r.user_id,
    user_name: r.user_name,
    user_photo: r.user_photo || '',
    goals: 0,
    assists: 0,
    status: 'none',
    id: null,
  });

  // Sort by goals desc, then assists
  const sortedPlayers = [...allPlayers].sort((a, b) =>
    (b.goals || 0) - (a.goals || 0) || (b.assists || 0) - (a.assists || 0)
  );

  const totalGoals = allPlayers.reduce((s, p) => s + (p.goals || 0), 0);
  const darkTeamPlayers = sortedPlayers.filter(p =>
    (game.dark_team || []).some(t => t.user_id === p.user_id)
  );
  const whiteTeamPlayers = sortedPlayers.filter(p =>
    (game.white_team || []).some(t => t.user_id === p.user_id)
  );
  const unassigned = sortedPlayers.filter(p =>
    !darkTeamPlayers.find(d => d.user_id === p.user_id) &&
    !whiteTeamPlayers.find(w => w.user_id === p.user_id)
  );

  const hasFinalScore = game.dark_score != null && game.white_score != null;
  const goalsMismatch = hasFinalScore && totalGoals !== (game.dark_score + game.white_score);

  return (
    <div className="space-y-4">
      {/* Final Score Banner */}
      {hasFinalScore && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-foreground/5 to-background p-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Full Time</p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">⚫ Dark</p>
                <p className="font-display text-6xl">{game.dark_score}</p>
              </div>
              <p className="text-2xl text-muted-foreground">—</p>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">⚪ White</p>
                <p className="font-display text-6xl">{game.white_score}</p>
              </div>
            </div>

            {game.mvp_name && (
              <div className="mt-4">
                <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-sm px-3 py-1">
                  <Star className="w-3.5 h-3.5 mr-1 fill-yellow-500 text-yellow-500" />
                  MOTM: {game.mvp_name}
                </Badge>
              </div>
            )}

            {goalsMismatch && isHost && (
              <p className="text-xs text-destructive mt-3">
                ⚠️ Score ({game.dark_score + game.white_score} goals) doesn't match submitted stats ({totalGoals} goals). Edit player stats below.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Scorers / Stats by team */}
      {(darkTeamPlayers.length > 0 || whiteTeamPlayers.length > 0) ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Dark Team */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                ⚫ Dark
                <span className="font-display text-base text-foreground">{game.dark_score ?? '—'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 divide-y divide-border">
              {darkTeamPlayers.map(p => (
                <EditableStatRow key={p.user_id} stat={p} gameId={gameId} isHost={isHost} />
              ))}
            </CardContent>
          </Card>

          {/* White Team */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                ⚪ White
                <span className="font-display text-base text-foreground">{game.white_score ?? '—'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 divide-y divide-border">
              {whiteTeamPlayers.map(p => (
                <EditableStatRow key={p.user_id} stat={p} gameId={gameId} isHost={isHost} />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* No teams — flat list */
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Player Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {sortedPlayers.map(p => (
              <EditableStatRow key={p.user_id} stat={p} gameId={gameId} isHost={isHost} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Unassigned players (if teams exist but some not in either) */}
      {(darkTeamPlayers.length > 0 || whiteTeamPlayers.length > 0) && unassigned.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Other Players</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {unassigned.map(p => (
              <EditableStatRow key={p.user_id} stat={p} gameId={gameId} isHost={isHost} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}