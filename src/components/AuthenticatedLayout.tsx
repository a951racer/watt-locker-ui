import { useLocation } from 'react-router-dom';
import NavigationBar from './NavigationBar';
import AnalyticsNav from './AnalyticsNav';
import { isAnalyticsRoute } from '../utils/navigation';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

const contentBackgroundStyle = {
  backgroundImage: `url('/Watt-Locker-Wallpaper.png')`,
  backgroundRepeat: 'repeat' as const,
  backgroundSize: 'auto' as const,
};

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { pathname } = useLocation();
  const analytics = isAnalyticsRoute(pathname);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <NavigationBar />
      {analytics ? (
        <main className="flex-1 min-h-0 flex overflow-hidden">
          <AnalyticsNav />
          <div
            className="flex-1 min-h-0 overflow-auto p-6"
            style={contentBackgroundStyle}
          >
            {children}
          </div>
        </main>
      ) : (
        <main
          className="flex-1 min-h-0 p-6 overflow-auto"
          style={contentBackgroundStyle}
        >
          {children}
        </main>
      )}
    </div>
  );
}
