import { Bell, Calendar, Clock, MapPin, MessageCircle, Plus, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const players = {
  dark: ['Rishabh', 'Aman', 'Neil', 'Sahil', 'Jay', 'Marco', 'Diego', 'Leo'],
  white: ['Arjun', 'Karan', 'Dev', 'Varun', 'Sam', 'Omar', 'Ben', 'Chris'],
};

const notifications = [
  ['Teams announced', 'Check which side you are on for Friday Night Football.', 'teams_announced'],
  ['Submit your stats', 'Goals and assists are open for the match.', 'submit_stats'],
  ['MVP voting is live', 'Vote for the player of the match before the window closes.', 'mvp_vote'],
  ['New match comment', 'Aman mentioned you in the match chat.', 'comment'],
];

const Shell = ({ children, active = 'Home' }) => {
  const nav = ['Home', 'Host', 'Rankings', 'Alerts', 'Profile'];
  return (
    <div className="dark relative w-[1080px] min-h-[1920px] overflow-hidden bg-background text-foreground font-body">
      <main className="min-h-[1920px] pb-28">
        {children}
      </main>
      <nav className="absolute bottom-0 left-0 right-0 h-20 bg-card/95 border-t border-border backdrop-blur-xl">
        <div className="grid grid-cols-5 h-full">
          {nav.map((item) => (
            <div key={item} className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${item === active ? 'text-primary' : 'text-muted-foreground'}`}>
              {item === 'Home' && <Calendar className="w-6 h-6" />}
              {item === 'Host' && <Plus className="w-6 h-6" />}
              {item === 'Rankings' && <Trophy className="w-6 h-6" />}
              {item === 'Alerts' && <Bell className="w-6 h-6" />}
              {item === 'Profile' && <Users className="w-6 h-6" />}
              <span>{item}</span>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

const AppHeader = ({ eyebrow, title, children }) => (
  <section className="px-8 pt-12 pb-6 bg-gradient-to-b from-primary/20 to-transparent">
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl">O</div>
        <span className="font-display tracking-widest text-4xl">OFFSIDE</span>
      </div>
      <div className="relative">
        <Bell className="w-7 h-7 text-muted-foreground" />
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">3</span>
      </div>
    </div>
    <p className="text-primary font-bold uppercase tracking-[0.3em] text-sm mb-3">{eyebrow}</p>
    <h1 className="font-heading text-6xl leading-none tracking-wide">{title}</h1>
    {children}
  </section>
);

const GameInfo = () => (
  <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
    <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Fri, Jul 17</div>
    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> 7:30 PM</div>
    <div className="flex items-center gap-2 col-span-2"><MapPin className="w-4 h-4 text-primary" /> Riverside Turf, Field 2</div>
  </div>
);

const HomeScreen = () => (
  <Shell>
    <AppHeader eyebrow="Next pickup match" title="Friday Night Football">
      <p className="text-muted-foreground text-xl mt-4">RSVP, check teams, and keep match chat in one place.</p>
    </AppHeader>
    <section className="px-8 space-y-6">
      <Card className="p-6 border-primary/30 bg-card/90">
        <div className="flex items-center justify-between mb-5">
          <Badge className="bg-primary/15 text-primary border-primary/25">upcoming</Badge>
          <Badge variant="outline" className="text-chart-3 border-chart-3/30 bg-chart-3/10">16 / 16 players</Badge>
        </div>
        <h2 className="font-heading text-5xl tracking-wide mb-4">Friday Night Football</h2>
        <GameInfo />
        <div className="flex gap-3 mt-6">
          <Button className="flex-1 h-12">Going</Button>
          <Button variant="outline" className="flex-1 h-12">Open chat</Button>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-heading text-4xl tracking-wide mb-4">Match chat</h3>
        <div className="space-y-4">
          <div className="rounded-xl bg-muted p-4">
            <p className="font-bold">Aman</p>
            <p className="text-muted-foreground">Bring both dark and white shirts.</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-4 border border-primary/20">
            <p className="font-bold">Rishabh</p>
            <p className="text-muted-foreground">Teams will be posted before kickoff.</p>
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-heading text-4xl tracking-wide mb-4">Leaderboard preview</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-muted p-4"><p className="text-3xl font-black">12</p><p className="text-xs text-muted-foreground">Goals</p></div>
          <div className="rounded-xl bg-muted p-4"><p className="text-3xl font-black">9</p><p className="text-xs text-muted-foreground">Assists</p></div>
          <div className="rounded-xl bg-muted p-4"><p className="text-3xl font-black">3</p><p className="text-xs text-muted-foreground">MVPs</p></div>
        </div>
      </Card>
    </section>
  </Shell>
);

const TeamColumn = ({ title, names, tone }) => (
  <Card className="p-5">
    <h3 className={`font-heading text-5xl tracking-wide mb-5 ${tone}`}>{title}</h3>
    <div className="space-y-3">
      {names.map((name) => (
        <div key={name} className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-primary/80" />
          <span className="font-bold text-lg">{name}</span>
        </div>
      ))}
    </div>
  </Card>
);

const TeamsScreen = () => (
  <Shell active="Host">
    <AppHeader eyebrow="Host tools" title="Balanced teams">
      <p className="text-muted-foreground text-xl mt-4">Draft sides, include the host, and announce teams to everyone.</p>
    </AppHeader>
    <section className="px-8 space-y-6">
      <Card className="p-6 bg-card/90">
        <GameInfo />
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <TeamColumn title="Dark" names={players.dark} tone="text-primary" />
        <TeamColumn title="White" names={players.white} tone="text-foreground" />
      </div>
      <Button className="w-full h-16 text-xl font-black">Announce teams</Button>
    </section>
  </Shell>
);

const StatsScreen = () => (
  <Shell active="Profile">
    <AppHeader eyebrow="Post game" title="Submit your stats">
      <p className="text-muted-foreground text-xl mt-4">Goals and assists go to the host for approval.</p>
    </AppHeader>
    <section className="px-8 space-y-6">
      <Card className="p-6">
        <p className="text-muted-foreground text-sm uppercase tracking-[0.3em] mb-3">Final score</p>
        <div className="flex items-center justify-center gap-8 font-display text-7xl">
          <span>Dark 7</span>
          <span className="text-muted-foreground text-4xl">vs</span>
          <span>White 5</span>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="font-heading text-5xl tracking-wide mb-6">Rishabh Kumar</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-primary/10 border border-primary/25 p-6 text-center">
            <p className="text-7xl font-black text-primary">2</p>
            <p className="font-bold text-muted-foreground">Goals</p>
          </div>
          <div className="rounded-2xl bg-chart-2/10 border border-chart-2/25 p-6 text-center">
            <p className="text-7xl font-black text-chart-2">1</p>
            <p className="font-bold text-muted-foreground">Assists</p>
          </div>
        </div>
        <Button className="w-full h-14 text-lg font-black mt-6">Submit stats</Button>
      </Card>
      <Card className="p-6">
        <h3 className="font-heading text-4xl tracking-wide mb-4">Pending approval</h3>
        {['Aman - 3 goals, 1 assist', 'Arjun - 1 goal, 2 assists', 'Neil - 2 assists'].map((item) => (
          <div key={item} className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
            <span className="font-bold">{item}</span>
            <Badge variant="outline">pending</Badge>
          </div>
        ))}
      </Card>
    </section>
  </Shell>
);

const MvpScreen = () => (
  <Shell active="Rankings">
    <AppHeader eyebrow="Player of the match" title="Vote MVP">
      <p className="text-muted-foreground text-xl mt-4">Every player gets one vote before the result is announced.</p>
    </AppHeader>
    <section className="px-8 space-y-6">
      <Card className="p-6 bg-primary/10 border-primary/25">
        <div className="flex items-center gap-4">
          <Trophy className="w-14 h-14 text-chart-3" />
          <div>
            <p className="text-muted-foreground font-bold">Voting closes in</p>
            <p className="text-4xl font-black">1h 42m</p>
          </div>
        </div>
      </Card>
      {[
        ['Aman Patel', '4 votes', 'Pressed all game and scored twice'],
        ['Rishabh Kumar', '3 votes', 'Controlled midfield and assisted the winner'],
        ['Arjun Mehta', '2 votes', 'Big saves late in the match'],
      ].map(([name, votes, note]) => (
        <Card key={name} className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/80 flex items-center justify-center font-black text-primary-foreground">{name[0]}</div>
            <div className="flex-1">
              <p className="font-black text-2xl">{name}</p>
              <p className="text-muted-foreground">{note}</p>
            </div>
            <Badge className="text-base px-3 py-1">{votes}</Badge>
          </div>
        </Card>
      ))}
      <Button className="w-full h-16 text-xl font-black">Cast MVP vote</Button>
    </section>
  </Shell>
);

const AlertsScreen = () => (
  <Shell active="Alerts">
    <AppHeader eyebrow="Notifications" title="Match alerts">
      <p className="text-muted-foreground text-xl mt-4">Know when teams, stats, comments, and MVP results are ready.</p>
    </AppHeader>
    <section className="px-8 space-y-4">
      {notifications.map(([title, body, type]) => (
        <Card key={type} className="p-5">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
              {type === 'comment' ? <MessageCircle className="w-6 h-6 text-primary" /> : <Bell className="w-6 h-6 text-primary" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-black text-xl">{title}</p>
                <span className="text-xs text-muted-foreground">now</span>
              </div>
              <p className="text-muted-foreground text-base">{body}</p>
            </div>
          </div>
        </Card>
      ))}
    </section>
  </Shell>
);

const FeatureTeamList = ({ title, names, tone }) => (
  <div className="rounded-xl border border-border bg-background/60 p-4">
    <h3 className={`font-heading text-4xl tracking-wide mb-4 ${tone}`}>{title}</h3>
    <div className="space-y-3">
      {names.map((name) => (
        <div key={name} className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-primary/80" />
          <span className="font-bold text-lg">{name}</span>
        </div>
      ))}
    </div>
  </div>
);

const FeatureGraphic = () => (
  <div className="dark w-screen h-screen bg-background text-foreground overflow-hidden">
    <div className="relative w-full h-full bg-gradient-to-br from-primary/30 via-background to-background">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px), linear-gradient(hsl(var(--primary)) 1px, transparent 1px)',
        backgroundSize: '92px 92px',
      }} />
      <div className="relative z-10 grid grid-cols-[1.1fr_0.9fr] gap-8 h-full px-16 py-10">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-3xl">O</div>
            <span className="font-display text-7xl tracking-wide">Offside</span>
          </div>
          <h1 className="font-heading text-5xl leading-none tracking-wide mb-4">Pickup football, organized.</h1>
          <p className="text-xl text-muted-foreground font-semibold leading-snug max-w-[520px]">Create games, announce teams, track stats, and vote MVP from one match hub.</p>
        </div>
        <Card className="self-center p-5 bg-card/95 border-primary/30 shadow-2xl">
          <Badge className="mb-3">Friday Night Football</Badge>
          <div className="grid grid-cols-2 gap-4">
            <FeatureTeamList title="Dark" names={players.dark.slice(0, 4)} tone="text-primary" />
            <FeatureTeamList title="White" names={players.white.slice(0, 4)} tone="text-foreground" />
          </div>
        </Card>
      </div>
    </div>
  </div>
);

const screens = {
  home: <HomeScreen />,
  teams: <TeamsScreen />,
  stats: <StatsScreen />,
  mvp: <MvpScreen />,
  alerts: <AlertsScreen />,
  feature: <FeatureGraphic />,
};

export default function StoreScreenshots() {
  const params = new URLSearchParams(window.location.search);
  const asset = params.get('asset') || 'home';
  return screens[asset] || screens.home;
}
