import NavigationBar from './NavigationBar';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <NavigationBar />
      <main
        className="flex-1 min-h-0 p-6 overflow-auto"
        style={{
          backgroundImage: `url('/Watt-Locker-Wallpaper.png')`,
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
