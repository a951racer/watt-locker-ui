import NavigationBar from './NavigationBar';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <NavigationBar />
      <main
        className="flex-1 p-6"
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
