import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { register, isLoading, error } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    try {
      await register(email, password);
      navigate('/dashboard');
    } catch {
      // Error is already set in the auth store
    }
  };

  const displayError = localError || error;

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/Watt-Locker-Login-Background.png')" }}
    >
      <div className="w-full max-w-md mx-4 bg-midnightBlue/95 rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/Watt-Locker-Logo.png"
            alt="Watt Locker"
            className="h-16 object-contain"
          />
        </div>

        <h1 className="text-xl font-semibold text-pureWhite text-center mb-6">
          Create an Account
        </h1>

        {/* Error message */}
        {displayError && (
          <div
            className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm text-center"
            role="alert"
          >
            {displayError}
          </div>
        )}

        {/* Registration form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-lightSilver mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-steelBlue/50 border border-steelBlue text-pureWhite placeholder-softFog focus:outline-none focus:ring-2 focus:ring-electricBlue focus:border-transparent transition"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-lightSilver mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-steelBlue/50 border border-steelBlue text-pureWhite placeholder-softFog focus:outline-none focus:ring-2 focus:ring-electricBlue focus:border-transparent transition"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-lightSilver mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-steelBlue/50 border border-steelBlue text-pureWhite placeholder-softFog focus:outline-none focus:ring-2 focus:ring-electricBlue focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-electricBlue text-pureWhite font-semibold hover:bg-brightCyan focus:outline-none focus:ring-2 focus:ring-brightCyan focus:ring-offset-2 focus:ring-offset-midnightBlue disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <Link
            to="/login"
            className="text-brightCyan hover:text-pureWhite transition"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
