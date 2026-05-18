export function getActiveNavItem(pathname: string): string | null {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/locker')) return 'locker';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/workouts/')) return null;
  return null;
}
