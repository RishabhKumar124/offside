import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  clearPendingNotificationRoute,
  getPendingNotificationRoute,
  listenForNotificationRoute,
} from '@/lib/notificationNavigation';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import SplashScreen from '@/components/SplashScreen';
import Home from '@/pages/Home';
import CreateGame from '@/pages/CreateGame';
import GameDetail from '@/pages/GameDetail';
import Profile from '@/pages/Profile';
import PlayerProfile from '@/pages/PlayerProfile';
import Notifications from '@/pages/Notifications';
import Leaderboard from '@/pages/Leaderboard';
import AdminSettings from '@/pages/AdminSettings';

const StoreScreenshots = import.meta.env.DEV ? lazy(() => import('@/pages/StoreScreenshots')) : null;

const NotificationRouteHandler = () => {
  const { isAuthenticated, isLoadingAuth, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const openPendingRoute = useCallback((candidateRoute) => {
    if (!isAuthenticated || isLoadingAuth || authError) return;

    const route = candidateRoute || getPendingNotificationRoute();
    if (!route) return;

    clearPendingNotificationRoute();
    const currentRoute = `${location.pathname}${location.search}`;
    if (route !== currentRoute) {
      navigate(route);
    }
  }, [authError, isAuthenticated, isLoadingAuth, location.pathname, location.search, navigate]);

  useEffect(() => {
    openPendingRoute();
  }, [openPendingRoute]);

  useEffect(() => listenForNotificationRoute(openPendingRoute), [openPendingRoute]);

  return null;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-display text-xl tracking-wider text-muted-foreground">OFFSIDE</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <>
      <NotificationRouteHandler />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {import.meta.env.DEV && StoreScreenshots && (
          <Route path="/store-screenshots" element={<Suspense fallback={null}><StoreScreenshots /></Suspense>} />
        )}

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/create-game" element={<CreateGame />} />
            <Route path="/game/:id" element={<GameDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/player/:userId" element={<PlayerProfile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/admin" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
