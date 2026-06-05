import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Plus, User, Bell, Trophy } from 'lucide-react';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function AppLayout() {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notifications', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const notifs = await base44.entities.Notification.filter({ user_id: user.id, read: false });
      return notifs.length;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/create-game', icon: Plus, label: 'Host' },
    { path: '/leaderboard', icon: Trophy, label: 'Rankings' },
    { path: '/notifications', icon: Bell, label: 'Alerts', badge: unreadCount },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-20 md:pb-6 md:pt-16">
        <Outlet />
      </main>

      {/* Desktop Top Nav */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b h-16 items-center justify-between px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-display text-lg">⚽</span>
          </div>
          <span className="font-display text-2xl tracking-wider text-foreground">KICKOFF</span>
        </Link>
        <div className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                location.pathname === item.path
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute -top-1 right-0 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}