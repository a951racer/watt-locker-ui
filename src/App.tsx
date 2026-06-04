import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import AuthenticatedLayout from './components/AuthenticatedLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import LockerPage from './pages/LockerPage';
import AdminPage from './pages/AdminPage';
import WorkoutDetailPage from './pages/WorkoutDetailPage';
import WorkoutsPage from './pages/WorkoutsPage';
import PowerPage from './pages/PowerPage';

function RootRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <DashboardPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/locker"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <LockerPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <AdminPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workouts/:id"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <WorkoutDetailPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workouts"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <WorkoutsPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/power"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <PowerPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
