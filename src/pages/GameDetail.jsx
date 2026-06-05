import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MapPin, Calendar, Clock, Users, Shield, CheckCircle, XCircle,
  Loader2, Trophy, UserPlus, UserMinus, Star, ArrowLeft, Pencil, X, Crown
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import LocationPicker from '@/components/game/LocationPicker';
import CommentSection from '@/components/game/CommentSection';
import TeamBuilder from '@/components/game/TeamBuilder';

export default function GameDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ id });
      return games[0];
    },
  });

  const { data: rsvps = [] } = useQuery({
    queryKey: ['rsvps', id],
    queryFn: () => base44.entities.RSVP.filter({ game_id: id }),
  });

  const { data: stats = [] } = useQuery({
    queryKey: ['stats', id],
    queryFn: () => base44.entities.StatSubmission.filter({ game_id: id }),
    enabled: game?.status === 'completed',
  });

  const goingRsvps = rsvps.filter(r => r.status === 'going');
  const waitlistRsvps = rsvps.filter(r => r.status === 'waitlist');
  const userRsvp = rsvps.find(r => r.user_id === user?.id);
  const isHost = game?.host_id === user?.id;

  const isFull = goingRsvps.length >= (game?.max_players || 0);

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      if (userRsvp) {
        // Leave
        await base44.entities.RSVP.delete(userRsvp.id);
        // Promote first waitlisted
        if (userRsvp.status === 'going' && waitlistRsvps.length > 0) {
          await base44.entities.RSVP.update(waitlistRsvps[0].id, { status: 'going' });
          await base44.entities.Notification.create({
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
        await base44.entities.RSVP.create({
          game_id: id,
          user_id: user.id,
          user_name: user.full_name,
          user_photo: user.profile_photo || '',
          status,
        });
        if (status === 'waitlist') {
          await base44.entities.Notification.create({
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

  const editGameMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Game.update(id, editForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', id] });
      setEditMode(false);
    },
  });

  const openEdit = () => {
    setEditForm({
      title: game.title,
      date: game.date ? new Date(game.date).toISOString().slice(0, 16) : '',
      location_name: game.location_name,
      location_lat: game.location_lat,
      location_lng: game.location_lng,
      max_players: game.max_players,
      rules: game.rules || '',
    });
    setEditMode(true);
  };

  const completeGameMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Game.update(id, { status: 'completed' });
      // Notify all going players to submit stats
      for (const rsvp of goingRsvps) {
        await base44.entities.Notification.create({
          user_id: rsvp.user_id,
          type: 'submit_stats',
          title: 'Game Over! Submit Your Stats',
          message: `"${game.title}" has ended. Submit your goals and assists!`,
          game_id: id,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', id] }),
  });

  const saveTeamsMutation = useMutation({
    mutationFn: async ({ dark, white }) => {
      await base44.entities.Game.update(id, { dark_team: dark, white_team: white });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', id] }),
  });

  const announceTeamsMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Game.update(id, { teams_announced: true });
      for (const rsvp of goingRsvps) {
        await base44.entities.Notification.create({
          user_id: rsvp.user_id,
          type: 'teams_announced',
          title: 'Teams Announced!',
          message: `Teams for "${game.title}" have been set. Check which team you're on!`,
          game_id: id,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', id] }),
  });

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
          {isHost && !editMode && (
            <Button variant="ghost" size="icon" onClick={openEdit} className="mt-1 shrink-0">
              <Pencil className="w-4 h-4" />
            </Button>
          )}
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

      {/* Edit Form */}
      {editMode && editForm && (
        <Card className="mb-6 border-primary/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Edit Game</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setEditMode(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} />
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={editForm.date} onChange={(e) => setEditForm({...editForm, date: e.target.value})} />
            </div>
            <div>
              <Label>Max Players</Label>
              <Input type="number" min={2} max={50} value={editForm.max_players} onChange={(e) => setEditForm({...editForm, max_players: parseInt(e.target.value)})} />
            </div>
            <div>
              <Label>Venue Name</Label>
              <Input value={editForm.location_name || ''} onChange={(e) => setEditForm({...editForm, location_name: e.target.value})} placeholder="Venue name or address..." />
            </div>
            <div>
              <Label>Rules & Notes</Label>
              <Textarea value={editForm.rules} onChange={(e) => setEditForm({...editForm, rules: e.target.value})} className="min-h-[80px]" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => editGameMutation.mutate()} disabled={editGameMutation.isPending}>
                {editGameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RSVP Button */}
      {user && game.status === 'upcoming' && (
        <div className="mb-6">
          {userRsvp ? (
            <Button onClick={() => rsvpMutation.mutate()} variant="outline" className="w-full h-12">
              <UserMinus className="w-4 h-4 mr-2" />
              {userRsvp.status === 'waitlist' ? 'Leave Waitlist' : 'Leave Game'}
            </Button>
          ) : (
            <Button onClick={() => rsvpMutation.mutate()} className="w-full h-12 font-heading text-lg tracking-wider">
              <UserPlus className="w-4 h-4 mr-2" />
              {isFull ? 'JOIN WAITLIST' : 'JOIN GAME'}
            </Button>
          )}
        </div>
      )}

      {/* Scores for completed */}
      {game.status === 'completed' && game.dark_score != null && (
        <Card className="mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-foreground/5 to-background p-6 text-center">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Final Score</p>
            <div className="flex items-center justify-center gap-6 font-display text-5xl">
              <span>⚫ {game.dark_score}</span>
              <span className="text-muted-foreground text-3xl">-</span>
              <span>⚪ {game.white_score}</span>
            </div>
            {game.mvp_name && (
              <div className="mt-3">
                <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20">
                  <Star className="w-3 h-3 mr-1 fill-chart-3" /> MVP: {game.mvp_name}
                </Badge>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Host Controls */}
      {isHost && game.status === 'upcoming' && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Host Controls</p>
            <div className="flex gap-2">
              <Button onClick={() => completeGameMutation.mutate()} variant="outline" size="sm">
                <CheckCircle className="w-4 h-4 mr-1" /> End Game
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Host - Score + MVP + Stats for completed games */}
      {isHost && game.status === 'completed' && <HostPostGame game={game} gameId={id} stats={stats} goingRsvps={goingRsvps} />}

      {/* Tabs */}
      <Tabs defaultValue="details" className="mt-6">
        <TabsList className={`w-full grid ${isHost ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          {isHost && <TabsTrigger value="teams">Teams</TabsTrigger>}
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

          {/* Map */}
          {game.location_lat && game.location_lng && (
            <Card>
              <CardContent className="p-4">
                <LocationPicker
                  lat={game.location_lat}
                  lng={game.location_lng}
                  locationName={game.location_name}
                  readOnly
                />
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
                    {isHost && r.user_id !== user?.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <MakeOrganizerButton rsvp={r} game={game} gameId={id} />
                        <RemovePlayerButton rsvp={r} gameId={id} />
                      </div>
                    )}
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
                      {isHost && (
                        <AcceptWaitlistButton rsvp={r} gameId={id} game={game} />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isHost && (
          <TabsContent value="teams" className="mt-4">
            <TeamBuilder
              game={game}
              rsvps={rsvps}
              isHost={isHost}
              onSaveTeams={(dark, white) => saveTeamsMutation.mutate({ dark, white })}
              onAnnounceTeams={() => announceTeamsMutation.mutate()}
            />
          </TabsContent>
        )}

        <TabsContent value="chat" className="mt-4">
          <CommentSection gameId={id} user={user} />
        </TabsContent>
      </Tabs>

      {/* Player stat submission for completed games */}
      {user && game.status === 'completed' && !isHost && goingRsvps.some(r => r.user_id === user.id) && (
        <PlayerStatSubmission gameId={id} userId={user.id} userName={user.full_name} stats={stats} />
      )}
    </div>
  );
}

function MakeOrganizerButton({ rsvp, game, gameId }) {
  const queryClient = useQueryClient();
  const isAlreadyOrganizer = game.host_id === rsvp.user_id;
  const mutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Game.update(gameId, {
        host_id: rsvp.user_id,
        host_name: rsvp.user_name,
        host_photo: rsvp.user_photo || '',
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', gameId] }),
  });
  if (isAlreadyOrganizer) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      title="Make organizer"
      onClick={(e) => { e.preventDefault(); mutation.mutate(); }}
      className="text-chart-3 hover:text-chart-3"
    >
      <Crown className="w-3.5 h-3.5" />
    </Button>
  );
}

function RemovePlayerButton({ rsvp, gameId }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => base44.entities.RSVP.update(rsvp.id, { status: 'removed' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rsvps', gameId] }),
  });
  return (
    <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); mutation.mutate(); }} className="ml-auto text-destructive">
      <XCircle className="w-3.5 h-3.5" />
    </Button>
  );
}

function AcceptWaitlistButton({ rsvp, gameId, game }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      await base44.entities.RSVP.update(rsvp.id, { status: 'going' });
      await base44.entities.Notification.create({
        user_id: rsvp.user_id,
        type: 'rsvp_accepted',
        title: 'You\'re in!',
        message: `You've been accepted into "${game.title}"!`,
        game_id: gameId,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rsvps', gameId] }),
  });
  return (
    <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); mutation.mutate(); }} className="ml-auto text-primary">
      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Accept
    </Button>
  );
}

function HostPostGame({ game, gameId, stats, goingRsvps }) {
  const queryClient = useQueryClient();
  const [darkScore, setDarkScore] = useState(game.dark_score || 0);
  const [whiteScore, setWhiteScore] = useState(game.white_score || 0);
  const [mvpId, setMvpId] = useState(game.mvp_user_id || '');

  const saveScoreMutation = useMutation({
    mutationFn: async () => {
      const mvpPlayer = goingRsvps.find(r => r.user_id === mvpId);
      await base44.entities.Game.update(gameId, {
        dark_score: parseInt(darkScore),
        white_score: parseInt(whiteScore),
        mvp_user_id: mvpId,
        mvp_name: mvpPlayer?.user_name || '',
      });
      if (mvpId) {
        await base44.entities.Notification.create({
          user_id: mvpId,
          type: 'mvp_awarded',
          title: '🏆 You are the MVP!',
          message: `You were selected as the MVP for "${game.title}"!`,
          game_id: gameId,
        });
        // Update user's MVP count
        const users = await base44.entities.User.filter({ id: mvpId });
        if (users.length > 0) {
          await base44.entities.User.update(mvpId, { total_mvps: (users[0].total_mvps || 0) + 1 });
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', gameId] }),
  });

  const approveStatMutation = useMutation({
    mutationFn: async (stat) => {
      await base44.entities.StatSubmission.update(stat.id, { status: 'approved' });
      // Update user career stats
      const users = await base44.entities.User.filter({ id: stat.user_id });
      if (users.length > 0) {
        const u = users[0];
        await base44.entities.User.update(stat.user_id, {
          total_goals: (u.total_goals || 0) + (stat.goals || 0),
          total_assists: (u.total_assists || 0) + (stat.assists || 0),
          games_played: (u.games_played || 0) + 1,
        });
      }
      await base44.entities.Notification.create({
        user_id: stat.user_id,
        type: 'stats_approved',
        title: 'Stats Approved!',
        message: `Your stats for "${game.title}" have been approved.`,
        game_id: gameId,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats', gameId] }),
  });

  const rejectStatMutation = useMutation({
    mutationFn: (stat) => base44.entities.StatSubmission.update(stat.id, { status: 'rejected' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats', gameId] }),
  });

  const pendingStats = stats.filter(s => s.status === 'pending');

  return (
    <div className="space-y-4 mb-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-sm">Set Final Score & MVP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>⚫ Dark Team Score</Label>
              <Input type="number" min={0} value={darkScore} onChange={(e) => setDarkScore(e.target.value)} />
            </div>
            <div>
              <Label>⚪ White Team Score</Label>
              <Input type="number" min={0} value={whiteScore} onChange={(e) => setWhiteScore(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>🏆 MVP</Label>
            <Select value={mvpId} onValueChange={setMvpId}>
              <SelectTrigger><SelectValue placeholder="Select MVP" /></SelectTrigger>
              <SelectContent>
                {goingRsvps.map(r => (
                  <SelectItem key={r.user_id} value={r.user_id}>{r.user_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => saveScoreMutation.mutate()} className="w-full">
            <Trophy className="w-4 h-4 mr-2" /> Save Score & MVP
          </Button>
        </CardContent>
      </Card>

      {pendingStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Stat Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingStats.map(stat => (
              <div key={stat.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">{stat.user_name}</p>
                  <p className="text-xs text-muted-foreground">⚽ {stat.goals} goals · 🅰️ {stat.assists} assists</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => approveStatMutation.mutate(stat)}>
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectStatMutation.mutate(stat)}>
                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlayerStatSubmission({ gameId, userId, userName, stats }) {
  const queryClient = useQueryClient();
  const existing = stats.find(s => s.user_id === userId);
  const [goals, setGoals] = useState(existing?.goals || 0);
  const [assists, setAssists] = useState(existing?.assists || 0);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (existing) {
        await base44.entities.StatSubmission.update(existing.id, { goals: parseInt(goals), assists: parseInt(assists), status: 'pending' });
      } else {
        await base44.entities.StatSubmission.create({
          game_id: gameId,
          user_id: userId,
          user_name: userName,
          goals: parseInt(goals),
          assists: parseInt(assists),
          status: 'pending',
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats', gameId] }),
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
          <p className="text-xs text-chart-3">Your stats are pending host approval.</p>
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
        <Button onClick={() => submitMutation.mutate()} className="w-full" disabled={existing?.status === 'pending'}>
          {existing ? 'Update Stats' : 'Submit Stats'}
        </Button>
      </CardContent>
    </Card>
  );
}