import { Link, useLocation } from 'react-router-dom';
import { getActiveNavItem } from '../utils/navigation';

const analyticsLinks = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'workouts', label: 'Workouts', path: '/workouts' },
  { key: 'power', label: 'Power', path: '/power' },
  { key: 'trends', label: 'Trends', path: '/trends' },
  { key: 'training-log', label: 'Training Log', path: '/training-log' },
] as const;

export default function AnalyticsNav() {
  const { pathname } = useLocation();
  const activeItem = getActiveNavItem(pathname);

  return (
    <nav
      aria-label="Analytics"
      className="bg-midnightBlue w-48 shrink-0 h-full overflow-y-auto px-4 py-6"
    >
      <ul className="flex flex-col gap-2 list-none m-0 p-0">
        {analyticsLinks.map(({ key, label, path }) => {
          const isActive = activeItem === key;
          return (
            <li key={key}>
              <Link
                to={path}
                className={`block text-sm font-medium px-3 py-2 rounded transition-colors border-l-2 ${
                  isActive
                    ? 'text-electricBlue border-electricBlue'
                    : 'text-softFog hover:text-lightSilver border-transparent'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
