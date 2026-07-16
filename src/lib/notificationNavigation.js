const PENDING_ROUTE_KEY = 'offside.pendingNotificationRoute';
const ROUTE_EVENT = 'offside:notification-route';

const isSafeInternalRoute = (route) => (
  typeof route === 'string' &&
  route.startsWith('/') &&
  !route.startsWith('//')
);

export const notificationRouteFromData = (data = {}) => {
  const route = data.url || data.route || data.link;
  if (isSafeInternalRoute(route)) return route;

  const gameId = data.game_id || data.gameId;
  if (gameId) return `/game/${gameId}`;

  return '/notifications';
};

export const getPendingNotificationRoute = () => {
  if (typeof window === 'undefined') return null;

  try {
    const route = window.sessionStorage.getItem(PENDING_ROUTE_KEY);
    return isSafeInternalRoute(route) ? route : null;
  } catch {
    return null;
  }
};

export const clearPendingNotificationRoute = () => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(PENDING_ROUTE_KEY);
  } catch {
    // Ignore storage access issues and let the app continue normally.
  }
};

export const queueNotificationRoute = (data = {}) => {
  const route = notificationRouteFromData(data);
  if (typeof window === 'undefined' || !route) return;

  try {
    window.sessionStorage.setItem(PENDING_ROUTE_KEY, route);
  } catch {
    // The in-memory event below still gives active sessions a chance to route.
  }

  window.dispatchEvent(new CustomEvent(ROUTE_EVENT, { detail: { route } }));
};

export const listenForNotificationRoute = (callback) => {
  if (typeof window === 'undefined') return () => {};

  const handler = (event) => {
    const route = event?.detail?.route;
    if (isSafeInternalRoute(route)) callback(route);
  };

  window.addEventListener(ROUTE_EVENT, handler);
  return () => window.removeEventListener(ROUTE_EVENT, handler);
};
