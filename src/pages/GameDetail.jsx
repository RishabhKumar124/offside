import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { appClient } from '@/api/backendClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MapPin, Calendar, Clock, Users, Shield, CheckCircle,
  Loader2, UserPlus, UserMinus, ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import CommentSection from '@/components/game/CommentSection';
import MOTMVoting from '@/components/game/MOTMVoting';
import PostGameDashboard from '@/components/game/PostGameDashboard';
import HostAdminPanel from '@/components/game/HostAdminPanel';
import { goingParticipantsWithHost, participantsWithHost, uniqueByUserId } from '@/utils/gameParticipants';
import { toast } from '@/components/ui/use-toast';

export default function GameDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    appClient.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: async () => {
      const games = await appClient.entities.Game.filter({ id });
      return games[0];
    },
  });

  const { data: rsvps = [] } = useQuery({
    queryKey: ['rsvps', id],
    queryFn: () => appClient.entities.RSVP.filter({ game_id: id }),
  });

  const { data: stats = [] } = useQuery({
    queryKey: ['stats', id],
    queryFn: () => appClient.entities.StatSubmission.filter({ game_id: id }),
    enabled: game?.status === 'completed',
  });

  const rsvpsWithHost = participantsWithHost(game, rsvps);
  const goingRsvps = goingParticipantsWithHost(game, rsvps);
  const waitlistRsvps = rsvps.filter(r => r.status === 'waitlist');
  const userRsvp = rsvps.find(r => r.user_id === user?.id);
  const isHost = !!(game?.host_id && user?.id && game.host_id === user.id);

  const isFull = goingRsvps.length >= (game?.max_players || 0);

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      if (userRsvp) {
        // Leave
        await appClient.entities.RSVP.delete(userRsvp.id);
        // Promote first waitlisted
        if (userRsvp.status === 'going' && waitlistRsvps.length > 0) {
          await appClient.entities.RSVP.update(waitlistRsvps[0].id, { status: 'going' });
          await appClient.entities.Notification.create({
            user_id: waitlistRsvps[0].user_id,
            type: 'rsvp_accepted',
            title: 'You\'re in!',
            message: `A spot opened up in "${game.title}". You've been moved from the waitlist!`,
            game_id: id,
          });
        }
      } else {
        // Join
        const status = isFull ? 'waitlist' : 'going';
        await appClient.entities.RSVP.create({
          game_id: id,
          user_id: user.id,
          user_name: user.full_name,
          user_photo: user.profile_photo || '',
          status,
        });
        if (status === 'waitlist') {
          await appClient.entities.Notification.create({
            user_id: user.id,
            type: 'waitlist',
            title: 'Added to Waitlist',
            message: `The game "${game.title}" is full. You're on the waitlist.`,
            game_id: id,
          });
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rsvps', id] }),
  });



  const saveTeamsMutation = useMutation({
    mutationFn: async ({ dark, white }) => {
      await appClient.entities.Game.update(id, { dark_team: dark, white_team: white });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', id] }),
  });

  const announceTeamsMutation = useMutation({
    mutationFn: async ({ dark, white } = {}) => {
      await appClient.entities.Game.update(id, {
        dark_team: dark || game.dark_team || [],
        white_team: white || game.white_team || [],
      });
      return appClient.game.announceTeams(id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['game', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Teams announced',
        description: `${result?.notified_count || 0} players were notified.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not announce teams',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSaveTeams = (dark, white) => saveTeamsMutation.mutateAsync({ dark, white });
  const handleAnnounceTeams = (dark, white) => announceTeamsMutation.mutate({ dark, white });

  const [mvpFinalizeCheckKey, setMvpFinalizeCheckKey] = useState('');

  useEffect(() => {
    if (!user || !game || game.status !== 'completed' || game.mvp_user_id) return;

    const checkKey = `${game.id}:${game.completed_date || game.updated_date || ''}`;
    if (mvpFinalizeCheckKey === checkKey) return;

    setMvpFinalizeCheckKey(checkKey);
    appClient.postGame.finalizeMvpIfReady(game.id)
      .then((updatedGame) => {
        if (updatedGame?.mvp_user_id) {
          queryClient.invalidateQueries({ queryKey: ['game', id] });
          queryClient.invalidateQueries({ queryKey: ['player'] });
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
          toast({
            title: 'MVP announced',
            description: `${updatedGame.mvp_name} has been selected as Man of the Match.`,
          });
        }
      })
      .catch((error) => {
        console.warn('Could not auto-finalize MVP voting:', error);
      });
  }, [game, id, mvpFinalizeCheckKey, queryClient, user]);

  if (isLoading || !game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      {/* Header */}
      <div className="mb-6">
        <Badge variant="outline" className="mb-2 text-xs">
          {game.status === 'in_progress' ? '🔴 Live' : game.status}
        </Badge>
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-display text-4xl md:text-5xl tracking-wider">{game.title}</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            {format(new Date(game.date), 'EEEE, MMM d, yyyy')}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 text-primary" />
            {format(new Date(game.date), 'h:mm a')}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            {game.location_name}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4 text-primary" />
            {goingRsvps.length} / {game.max_players} players
          </div>
        </div>
      </div>



      {/* RSVP Button */}
      {user && game.status === 'upcoming' && !isHost && (
        <div className="mb-6">
          {(() => {
            const inTeam = [...(game.dark_team || []), ...(game.white_team || [])].some(p => p.user_id === user.id);
            if (userRsvp || inTeam) {
              return (
                <Button
                  onClick={() => userRsvp ? rsvpMutation.mutate() : null}
                  variant="outline"
                  className="w-full h-12"
                  disabled={inTeam && !userRsvp}
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  {userRsvp?.status === 'waitlist' ? 'Leave Waitlist' : 'Leave Game'}
                </Button>
              );
            }
            return (
              <Button onClick={() => rsvpMutation.mutate()} className="w-full h-12 font-heading text-lg tracking-wider">
                <UserPlus className="w-4 h-4 mr-2" />
                {isFull ? 'JOIN WAITLIST' : 'JOIN GAME'}
              </Button>
            );
          })()}
        </div>
      )}

      {/* Post-game dashboard — always shown for completed games */}
      {game.status === 'completed' && (
        <div className="mb-6">
          <PostGameDashboard game={game} gameId={id} isHost={isHost} />
        </div>
      )}

      {/* Host Admin Panel */}
      {isHost && (
        <HostAdminPanel
          game={game}
          gameId={id}
          rsvps={rsvpsWithHost}
          stats={stats}
          user={user}
          onSaveTeams={handleSaveTeams}
          onAnnounceTeams={handleAnnounceTeams}
        />
      )}

      {/* Tabs — hidden for completed games */}
      <Tabs defaultValue="details" className={`mt-6 ${game.status === 'completed' ? 'hidden' : ''}`}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-4">
          {/* Host */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Hosted by</p>
              <Link to={`/player/${game.host_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                {game.host_photo ? (
                  <img src={game.host_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {game.host_name?.[0]}
                  </div>
                )}
                <span className="font-medium">{game.host_name}</span>
              </Link>
            </CardContent>
          </Card>

          {/* Location link */}
          {game.location_name && (
            <Card>
              <CardContent className="p-4">
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(game.location_name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  {game.location_name} — Open in Google Maps
                </a>
              </CardContent>
            </Card>
          )}

          {/* Rules */}
          {game.rules && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Rules & Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{game.rules}</p>
              </CardContent>
            </Card>
          )}

          {/* Announced teams (visible to all once announced) */}
          {!isHost && game.teams_announced && (game.dark_team?.length > 0 || game.white_team?.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">⚫ Dark</p>
                    <div className="space-y-1">
                      {(game.dark_team || []).map(p => (
                        <div key={p.user_id} className="flex items-center gap-2 text-sm">
                          {p.photo ? <img src={p.photo} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{p.name?.[0]}</div>}
                          {p.name}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">⚪ White</p>
                    <div className="space-y-1">
                      {(game.white_team || []).map(p => (
                        <div key={p.user_id} className="flex items-center gap-2 text-sm">
                          {p.photo ? <img src={p.photo} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{p.name?.[0]}</div>}
                          {p.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="players" className="mt-4 space-y-4">
          {/* Going */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" /> Going ({goingRsvps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {goingRsvps.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                    <Link to={`/player/${r.user_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      {r.user_photo ? (
                        <img src={r.user_photo} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {r.user_name?.[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium truncate">{r.user_name}</span>
                    </Link>

                  </div>
                ))}
                {goingRsvps.length === 0 && <p className="text-sm text-muted-foreground">No one has joined yet.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Waitlist */}
          {waitlistRsvps.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-chart-3" /> Waitlist ({waitlistRsvps.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {waitlistRsvps.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-2">
                      {r.user_photo ? (
                        <img src={r.user_photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {r.user_name?.[0]}
                        </div>
                      )}
                      <span className="text-sm">{r.user_name}</span>

                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
            <CommentSection
              gameId={id}
              user={user}
              game={game}
              players={uniqueByUserId([
                { id: game.host_id, user_id: game.host_id, full_name: game.host_name, profile_photo: game.host_photo },
                ...rsvps.map((r) => ({ id: r.user_id, user_id: r.user_id, full_name: r.user_name, profile_photo: r.user_photo })),
              ])}
            />
          </TabsContent>
        </Tabs>

      {/* Player stat submission remains available after MVP is announced. */}
      {user && game.status === 'completed' && goingRsvps.some(r => r.user_id === user.id) && (
        <PlayerStatSubmission gameId={id} userId={user.id} userName={user.full_name} stats={stats} />
      )}

      {/* MVP voting closes once MVP is announced. */}
      {user && game.status === 'completed' && !game.mvp_name && goingRsvps.some(r => r.user_id === user.id) && (
        <MOTMVoting game={game} gameId={id} userId={user.id} goingRsvps={goingRsvps} />
      )}
    </div>
  );
}



function PlayerStatSubmission({ gameId, userId, userName, stats }) {
  const queryClient = useQueryClient();
  const existing = stats.find(s => s.user_id === userId);
  const [goals, setGoals] = useState(existing?.goals || 0);
  const [assists, setAssists] = useState(existing?.assists || 0);

  useEffect(() => {
    setGoals(existing?.goals || 0);
    setAssists(existing?.assists || 0);
  }, [existing?.id, existing?.goals, existing?.assists]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const submittedGoals = Math.max(0, Number.parseInt(goals, 10) || 0);
      const submittedAssists = Math.max(0, Number.parseInt(assists, 10) || 0);
      if (existing) {
        await appClient.entities.StatSubmission.update(existing.id, {
          goals: submittedGoals,
          assists: submittedAssists,
          status: 'pending',
        });
      } else {
        await appClient.entities.StatSubmission.create({
          game_id: gameId,
          user_id: userId,
          user_name: userName,
          goals: submittedGoals,
          assists: submittedAssists,
          status: 'pending',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats', gameId] });
      toast({
        title: 'Stats submitted',
        description: 'They are pending host approval. Your profile totals update after approval.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not submit stats',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  if (existing?.status === 'approved') {
    return (
      <Card className="mt-6 border-primary/20">
        <CardContent className="p-4 text-center">
          <CheckCircle className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-sm font-medium">Your stats have been approved!</p>
          <p className="text-xs text-muted-foreground">⚽ {existing.goals} goals · 🅰️ {existing.assists} assists</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-sm">Submit Your Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {existing?.status === 'rejected' && (
          <p className="text-xs text-destructive">Your previous submission was rejected. Please resubmit.</p>
        )}
        {existing?.status === 'pending' && (
          <p className="text-xs text-chart-3">Your stats are pending host approval. Goals and assists update on your profile after approval.</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>⚽ Goals</Label>
            <Input type="number" min={0} value={goals} onChange={(e) => setGoals(e.target.value)} />
          </div>
          <div>
            <Label>🅰️ Assists</Label>
            <Input type="number" min={0} value={assists} onChange={(e) => setAssists(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => submitMutation.mutate()} className="w-full" disabled={submitMutation.isPending || existing?.status === 'pending'}>
          {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {existing ? 'Update Stats' : 'Submit Stats'}
        </Button>
      </CardContent>
    </Card>
  );
}
