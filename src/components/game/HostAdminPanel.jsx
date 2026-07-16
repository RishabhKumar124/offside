import { useState } from 'react';
import { appClient } from '@/api/backendClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import {
  CheckCircle, XCircle, Crown, Trophy, Loader2, UserMinus, AlertTriangle
} from 'lucide-react';
import TeamBuilder from '@/components/game/TeamBuilder';
import { toApiDateTime, toDateTimeLocalValue } from '@/lib/dateTime';
import { toast } from '@/components/ui/use-toast';

export default function HostAdminPanel({ game, gameId, rsvps, stats, user, onSaveTeams, onAnnounceTeams }) {
  const queryClient = useQueryClient();
  const goingRsvps = rsvps.filter(r => r.status === 'going');
  const waitlistRsvps = rsvps.filter(r => r.status === 'waitlist');

  const [editForm, setEditForm] = useState({
    title: game.title,
    date: toDateTimeLocalValue(game.date),
    location_name: game.location_name || '',
    max_players: game.max_players,
    rules: game.rules || '',
  });

  const [darkScore, setDarkScore] = useState(game.dark_score ?? 0);
  const [whiteScore, setWhiteScore] = useState(game.white_score ?? 0);
  const [mvpId, setMvpId] = useState(game.mvp_user_id || '');

  const { data: motmVotes = [] } = useQuery({
    queryKey: ['motm-votes', gameId],
    queryFn: () => appClient.entities.MOTMVote.filter({ game_id: gameId }),
    enabled: game.status === 'completed',
  });

  const voteTally = motmVotes.reduce((acc, v) => {
    acc[v.voted_for_id] = (acc[v.voted_for_id] || 0) + 1;
    return acc;
  }, {});

  const pendingStats = stats.filter(s => s.status === 'pending');
  const submittedVoteCount = new Set(motmVotes.map(v => v.voter_id)).size;

  const refreshPostGameQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    queryClient.invalidateQueries({ queryKey: ['stats', gameId] });
    queryClient.invalidateQueries({ queryKey: ['motm-votes', gameId] });
    queryClient.invalidateQueries({ queryKey: ['player'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const editMutation = useMutation({
    mutationFn: () => appClient.entities.Game.update(gameId, {
      ...editForm,
      date: toApiDateTime(editForm.date),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      toast({ title: 'Game updated', description: 'Changes were saved.' });
    },
    onError: (error) => {
      toast({
        title: 'Could not save game',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const endGameMutation = useMutation({
    mutationFn: () => appClient.postGame.completeGame(gameId),
    onSuccess: () => {
      refreshPostGameQueries();
      toast({
        title: 'Game ended',
        description: 'Players were notified and games played were updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not end game',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const saveScoreMutation = useMutation({
    mutationFn: () => appClient.postGame.saveScoreAndMvp({
      gameId,
      darkScore,
      whiteScore,
      mvpUserId: mvpId || null,
    }),
    onSuccess: (updatedGame) => {
      refreshPostGameQueries();
      toast({
        title: updatedGame?.mvp_name ? 'Score and MVP saved' : 'Score saved',
        description: updatedGame?.mvp_name
          ? `${updatedGame.mvp_name} was saved as MVP.`
          : 'Final score was saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not save score',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const approveStatMutation = useMutation({
    mutationFn: (stat) => appClient.postGame.approveStatSubmission(stat.id),
    onSuccess: (stat) => {
      refreshPostGameQueries();
      toast({
        title: 'Stats approved',
        description: `${stat.user_name}'s profile totals were updated.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not approve stats',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const rejectStatMutation = useMutation({
    mutationFn: (stat) => appClient.entities.StatSubmission.update(stat.id, { status: 'rejected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats', gameId] });
      toast({ title: 'Stats rejected', description: 'The player can submit again.' });
    },
    onError: (error) => {
      toast({
        title: 'Could not reject stats',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const removePlayerMutation = useMutation({
    mutationFn: (rsvp) => appClient.entities.RSVP.update(rsvp.id, { status: 'removed' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rsvps', gameId] }),
  });

  const acceptWaitlistMutation = useMutation({
    mutationFn: async (rsvp) => {
      await appClient.entities.RSVP.update(rsvp.id, { status: 'going' });
      await appClient.entities.Notification.create({
        user_id: rsvp.user_id,
        type: 'rsvp_accepted',
        title: "You're in!",
        message: `You've been accepted into "${game.title}"!`,
        game_id: gameId,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rsvps', gameId] }),
  });

  const makeOrganizerMutation = useMutation({
    mutationFn: (rsvp) => appClient.entities.Game.update(gameId, {
      host_id: rsvp.user_id,
      host_name: rsvp.user_name,
      host_photo: rsvp.user_photo || '',
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', gameId] }),
  });

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wider">Host Admin</CardTitle>
          {game.status === 'upcoming' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => endGameMutation.mutate()}
              disabled={endGameMutation.isPending}
            >
              {endGameMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
              End Game
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Tabs defaultValue={game.status === 'completed' ? 'score' : 'players'}>
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="players">Players</TabsTrigger>
            {game.status === 'upcoming' && <TabsTrigger value="teams">Teams</TabsTrigger>}
            {game.status === 'completed' && <TabsTrigger value="score">Score</TabsTrigger>}
            {game.status === 'completed' && pendingStats.length > 0 && (
              <TabsTrigger value="stats" className="relative">
                Stats
                <Badge className="ml-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center bg-destructive text-white">{pendingStats.length}</Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="players" className="space-y-3 mt-0">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Going ({goingRsvps.length})</p>
              <div className="space-y-1">
                {goingRsvps.map(r => (
                  <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-background">
                    <Link to={`/player/${r.user_id}`} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80">
                      {r.user_photo
                        ? <img src={r.user_photo} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        : <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{r.user_name?.[0]}</div>
                      }
                      <span className="text-sm truncate">{r.user_name}</span>
                    </Link>
                    {r.user_id !== user?.id && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-chart-3"
                          title="Transfer host role"
                          aria-label="Transfer host role"
                          onClick={() => makeOrganizerMutation.mutate(r)}
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Remove player"
                          onClick={() => removePlayerMutation.mutate(r)}
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {goingRsvps.length === 0 && <p className="text-sm text-muted-foreground">No confirmed players yet.</p>}
              </div>
            </div>

            {waitlistRsvps.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Waitlist ({waitlistRsvps.length})</p>
                <div className="space-y-1">
                  {waitlistRsvps.map(r => (
                    <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-background">
                      {r.user_photo
                        ? <img src={r.user_photo} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        : <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">{r.user_name?.[0]}</div>
                      }
                      <span className="text-sm flex-1 truncate">{r.user_name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-primary shrink-0"
                        onClick={() => acceptWaitlistMutation.mutate(r)}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Accept
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {game.status === 'upcoming' && (
            <TabsContent value="teams" className="mt-0">
              <TeamBuilder
                game={game}
                rsvps={rsvps}
                isHost={true}
                onSaveTeams={onSaveTeams}
                onAnnounceTeams={onAnnounceTeams}
              />
            </TabsContent>
          )}

          {game.status === 'completed' && (
            <TabsContent value="score" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Dark Score</Label>
                  <Input type="number" min={0} value={darkScore} onChange={e => setDarkScore(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">White Score</Label>
                  <Input type="number" min={0} value={whiteScore} onChange={e => setWhiteScore(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">MVP / Man of the Match</Label>
                <Select value={mvpId} onValueChange={setMvpId}>
                  <SelectTrigger><SelectValue placeholder="Select MVP" /></SelectTrigger>
                  <SelectContent>
                    {[...goingRsvps]
                      .sort((a, b) => (voteTally[b.user_id] || 0) - (voteTally[a.user_id] || 0))
                      .map(r => {
                        const voteCount = voteTally[r.user_id] || 0;
                        return (
                          <SelectItem key={r.user_id} value={r.user_id}>
                            {r.user_name}{voteCount > 0 ? ` - ${voteCount} vote${voteCount !== 1 ? 's' : ''}` : ''}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {submittedVoteCount}/{goingRsvps.length} MVP votes in. MVP auto-announces when all confirmed players vote or the 2-hour window closes.
                </p>
              </div>
              <Button className="w-full" onClick={() => saveScoreMutation.mutate()} disabled={saveScoreMutation.isPending}>
                {saveScoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
                Save Score & MVP
              </Button>
            </TabsContent>
          )}

          {game.status === 'completed' && pendingStats.length > 0 && (
            <TabsContent value="stats" className="space-y-2 mt-0">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-chart-3" />
                <p className="text-xs text-muted-foreground">{pendingStats.length} submission{pendingStats.length !== 1 ? 's' : ''} awaiting approval</p>
              </div>
              {pendingStats.map(stat => (
                <div key={stat.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{stat.user_name}</p>
                    <p className="text-xs text-muted-foreground">{stat.goals} goals - {stat.assists} assists</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => approveStatMutation.mutate(stat)}
                      disabled={approveStatMutation.isPending}
                    >
                      {approveStatMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <CheckCircle className="w-3.5 h-3.5 text-primary" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectStatMutation.mutate(stat)}
                      disabled={rejectStatMutation.isPending}
                    >
                      {rejectStatMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-destructive" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>
          )}

          <TabsContent value="edit" className="space-y-3 mt-0">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Date & Time</Label>
              <Input type="datetime-local" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Max Players</Label>
              <Input type="number" min={2} max={50} value={editForm.max_players} onChange={e => setEditForm({ ...editForm, max_players: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Venue</Label>
              <Input value={editForm.location_name} onChange={e => setEditForm({ ...editForm, location_name: e.target.value })} placeholder="Venue name..." />
            </div>
            <div>
              <Label className="text-xs">Rules & Notes</Label>
              <Textarea value={editForm.rules} onChange={e => setEditForm({ ...editForm, rules: e.target.value })} className="min-h-[80px]" />
            </div>
            <Button className="w-full" onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
