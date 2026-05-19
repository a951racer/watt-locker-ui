import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getActiveNavItem } from '../utils/navigation';
import { useAuthStore } from '../store/authStore';

const navLinks = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'workouts', label: 'Workouts', path: '/workouts' },
  { key: 'locker', label: 'Locker', path: '/locker' },
  { key: 'admin', label: 'Admin', path: '/admin' },
] as const;

export default function NavigationBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const activeItem = getActiveNavItem(pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-midnightBlue w-full px-6 flex items-center h-14 shrink-0">
      <Link to="/dashboard" className="flex items-center mr-8">
        <img
          src="/Watt-Locker-Nav-Logo.png"
          alt="Watt Locker logo"
          className="h-14 w-auto object-contain"
        />
      </Link>

      <ul className="flex items-center gap-6 list-none m-0 p-0">
        {navLinks.map(({ key, label, path }) => {
          const isActive = activeItem === key;
          return (
            <li key={key}>
              <Link
                to={path}
                className={`text-sm font-medium pb-1 transition-colors ${
                  isActive
                    ? 'text-electricBlue border-b-2 border-electricBlue'
                    : 'text-softFog hover:text-lightSilver border-b-2 border-transparent'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-softFog hover:text-lightSilver transition-colors"
          >
            Logout
          </button>
        </li>
      </ul>

      <span className="ml-auto text-lightSilver italic text-xl font-bold">
        Watt Locker
      </span>

      <button
        onClick={handleLogout}
        className="ml-6 text-sm text-softFog hover:text-pureWhite transition-colors"
      >
        Logout
      </button>
    </nav>
  );
}
