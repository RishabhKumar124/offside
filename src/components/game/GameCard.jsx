import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  upcoming: 'bg-primary/10 text-primary border-primary/20',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function GameCard({ game, rsvpCount = 0 }) {
  const gameDate = new Date(game.date);
  const isPast = gameDate < new Date();

  return (
    <Link to={`/game/${game.id}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <Badge variant="outline" className={`text-xs font-medium ${statusColors[game.status] || statusColors.upcoming}`}>
              {game.status === 'in_progress' ? 'Live' : game.status}
            </Badge>
            {game.mvp_name && (
              <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20 text-xs">
                🏆 MVP: {game.mvp_name}
              </Badge>
            )}
          </div>

          <h3 className="font-heading text-2xl tracking-wide text-foreground group-hover:text-primary transition-colors mb-3">
            {game.title}
          </h3>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary/70" />
              <span>{format(gameDate, 'EEEE, MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary/70" />
              <span>{format(gameDate, 'h:mm a')}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary/70" />
              <span className="truncate">{game.location_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary/70" />
              <span>{rsvpCount} / {game.max_players} players</span>
              {rsvpCount >= game.max_players && (
                <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">FULL</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
            {game.host_photo ? (
              <img src={game.host_photo} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {game.host_name?.[0] || 'H'}
              </div>
            )}
            <span className="text-xs text-muted-foreground">Hosted by <span className="text-foreground font-medium">{game.host_name || 'Unknown'}</span></span>
          </div>

          {game.status === 'completed' && game.dark_score != null && game.white_score != null && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center justify-center gap-4 font-display text-2xl">
                <span className="text-foreground">⚫ {game.dark_score}</span>
                <span className="text-muted-foreground text-lg">vs</span>
                <span className="text-muted-foreground">⚪ {game.white_score}</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}