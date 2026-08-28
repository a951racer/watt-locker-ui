export function getActiveNavItem(pathname: string): string | null {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname === '/workouts') return 'workouts';
  if (pathname.startsWith('/workouts/')) return 'workouts';
  if (pathname.startsWith('/power')) return 'power';
  if (pathname.startsWith('/trends')) return 'trends';
  if (pathname.startsWith('/training-log')) return 'training-log';
  if (pathname.startsWith('/locker')) return 'locker';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
}

/**
 * Returns true when the given pathname belongs to an Analytics page.
 * Analytics pages: dashboard, workouts (incl. /workouts/:id), power, trends, training-log.
 */
export function isAnalyticsRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname === '/workouts' ||
    pathname.startsWith('/workouts/') ||
    pathname.startsWith('/power') ||
    pathname.startsWith('/trends') ||
    pathname.startsWith('/training-log')
  );
}

/**
 * Maps a pathname to the active primary navigation key.
 * 'analytics' for any analytics route, otherwise 'calendar' | 'locker' | 'admin'.
 */
export function getActivePrimaryNav(pathname: string): string | null {
  if (isAnalyticsRoute(pathname)) return 'analytics';
  if (pathname.startsWith('/calendar')) return 'calendar';
  if (pathname.startsWith('/locker')) return 'locker';
  if (pathname.startsWith('/templates')) return 'templates';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
}
