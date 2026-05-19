export function getActiveNavItem(pathname: string): string | null {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname === '/workouts') return 'workouts';
  if (pathname.startsWith('/workouts/')) return null;
  if (pathname.startsWith('/locker')) return 'locker';
  if (pathname.startsWith('/admin')) return 'admin';
  return null;
}
