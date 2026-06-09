export function getActiveNavItem(pathname: string): string | null {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname === '/workouts') return 'workouts';
  if (pathname.startsWith('/workouts/')) return null;
  if (pathname.startsWith('/power')) return 'power';
  if (pathname.startsWith('/trends')) return 'trends';
  if (pathname.startsWith('/training-log')) return 'training-log';
  if (pathname.startsWith('/locker')) return 'locker';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
}
