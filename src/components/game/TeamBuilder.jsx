import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Send } from 'lucide-react';

function PlayerCard({ player, index, isDraggable }) {
  if (!isDraggable) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
        {player.photo ? (
          <img src={player.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {player.name?.[0] || '?'}
          </div>
        )}
        <span className="text-sm font-medium">{player.name}</span>
      </div>
    );
  }

  return (
    <Draggable draggableId={player.user_id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`flex items-center gap-3 p-3 rounded-lg bg-card border transition-all ${
            snapshot.isDragging ? 'shadow-lg border-primary scale-105' : 'border-border/50 hover:border-primary/30'
          }`}
        >
          {player.photo ? (
            <img src={player.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {player.name?.[0] || '?'}
            </div>
          )}
          <span className="text-sm font-medium">{player.name}</span>
        </div>
      )}
    </Draggable>
  );
}

export default function TeamBuilder({ game, rsvps, isHost, onSaveTeams, onAnnounceTeams }) {
  const goingPlayers = rsvps.filter(r => r.status === 'going').map(r => ({
    user_id: r.user_id,
    name: r.user_name,
    photo: r.user_photo,
  }));

  const [darkTeam, setDarkTeam] = useState(game.dark_team || []);
  const [whiteTeam, setWhiteTeam] = useState(game.white_team || []);
  const [unassigned, setUnassigned] = useState([]);

  useEffect(() => {
    const assignedIds = [...(game.dark_team || []), ...(game.white_team || [])].map(p => p.user_id);
    const unassignedPlayers = goingPlayers.filter(p => !assignedIds.includes(p.user_id));
    setUnassigned(unassignedPlayers);
    setDarkTeam(game.dark_team || []);
    setWhiteTeam(game.white_team || []);
  }, [rsvps, game.dark_team, game.white_team]);

  const onDragEnd = (result) => {
    if (!result.destination || !isHost) return;

    const { source, destination } = result;
    const lists = { unassigned: [...unassigned], dark: [...darkTeam], white: [...whiteTeam] };
    const [moved] = lists[source.droppableId].splice(source.index, 1);
    lists[destination.droppableId].splice(destination.index, 0, moved);

    setUnassigned(lists.unassigned);
    setDarkTeam(lists.dark);
    setWhiteTeam(lists.white);
  };

  const handleSave = () => {
    onSaveTeams(darkTeam, whiteTeam);
  };

  const TeamColumn = ({ id, label, players, emoji, bgClass }) => (
    <div className={`rounded-xl p-4 ${bgClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-heading text-lg tracking-wide flex items-center gap-2">
          {emoji} {label}
        </h4>
        <Badge variant="outline" className="text-xs">{players.length}</Badge>
      </div>
      {isHost ? (
        <Droppable droppableId={id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-2 min-h-[80px] rounded-lg p-2 transition-colors ${
                snapshot.isDraggingOver ? 'bg-primary/5' : ''
              }`}
            >
              {players.map((player, i) => (
                <PlayerCard key={player.user_id} player={player} index={i} isDraggable={true} />
              ))}
              {provided.placeholder}
              {players.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Drag players here</p>
              )}
            </div>
          )}
        </Droppable>
      ) : (
        <div className="space-y-2 min-h-[80px]">
          {players.map((player) => (
            <PlayerCard key={player.user_id} player={player} index={0} isDraggable={false} />
          ))}
          {players.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No players assigned</p>
          )}
        </div>
      )}
    </div>
  );

  const content = (
    <div className="space-y-4">
      {isHost && unassigned.length > 0 && (
        <TeamColumn id="unassigned" label="Unassigned" players={unassigned} emoji="👥" bgClass="bg-muted/50" />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamColumn id="dark" label="Dark Team" players={darkTeam} emoji="⚫" bgClass="bg-foreground/5" />
        <TeamColumn id="white" label="White Team" players={whiteTeam} emoji="⚪" bgClass="bg-background border border-border" />
      </div>
      {isHost && (
        <div className="flex gap-3">
          <Button onClick={handleSave} variant="outline" className="flex-1">
            <Users className="w-4 h-4 mr-2" /> Save Teams
          </Button>
          <Button onClick={() => { handleSave(); onAnnounceTeams(); }} className="flex-1">
            <Send className="w-4 h-4 mr-2" /> Announce Teams
          </Button>
        </div>
      )}
    </div>
  );

  return isHost ? (
    <DragDropContext onDragEnd={onDragEnd}>
      {content}
    </DragDropContext>
  ) : content;
}