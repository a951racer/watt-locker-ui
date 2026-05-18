import { useEffect, useState, type FormEvent } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export default function AdminPage() {
  const { settings, isLoading, error, fetchSettings, updateSettings } = useSettingsStore();
  const [driveStoragePath, setDriveStoragePath] = useState('');
  const [driveInboxPath, setDriveInboxPath] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setDriveStoragePath(settings.driveStoragePath);
      setDriveInboxPath(settings.driveInboxPath);
    }
  }, [settings]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    try {
      await updateSettings({ driveStoragePath, driveInboxPath });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error is set in the store
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-pureWhite mb-6">Admin Settings</h1>

      {/* Google Drive Configuration */}
      <div className="bg-midnightBlue/80 rounded-xl p-6 mb-6 shadow-lg">
        <h2 className="text-lg font-semibold text-lightSilver mb-4">
          Google Drive Configuration
        </h2>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        {saveSuccess && (
          <div
            className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/50 text-green-300 text-sm"
            role="status"
          >
            Settings saved successfully.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="driveStoragePath" className="block text-sm font-medium text-lightSilver mb-1">
              Storage Path
            </label>
            <input
              id="driveStoragePath"
              type="text"
              value={driveStoragePath}
              onChange={(e) => setDriveStoragePath(e.target.value)}
              placeholder="/My Drive/WattLocker/Storage"
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-lg bg-steelBlue/50 border border-steelBlue text-pureWhite placeholder-softFog focus:outline-none focus:ring-2 focus:ring-electricBlue focus:border-transparent transition disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-softFog">
              Path to the Google Drive folder where workout files are stored.
            </p>
          </div>

          <div>
            <label htmlFor="driveInboxPath" className="block text-sm font-medium text-lightSilver mb-1">
              Inbox Path
            </label>
            <input
              id="driveInboxPath"
              type="text"
              value={driveInboxPath}
              onChange={(e) => setDriveInboxPath(e.target.value)}
              placeholder="/My Drive/WattLocker/Inbox"
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-lg bg-steelBlue/50 border border-steelBlue text-pureWhite placeholder-softFog focus:outline-none focus:ring-2 focus:ring-electricBlue focus:border-transparent transition disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-softFog">
              Path to the Google Drive folder where new files are dropped for ingestion.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-lg bg-electricBlue text-pureWhite font-semibold hover:bg-brightCyan focus:outline-none focus:ring-2 focus:ring-brightCyan focus:ring-offset-2 focus:ring-offset-midnightBlue disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* User Administration */}
      <div className="bg-midnightBlue/80 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-lightSilver mb-4">
          User Administration
        </h2>
        <p className="text-softFog text-sm">
          User administration coming soon. This section will allow you to manage user accounts, roles, and permissions.
        </p>
      </div>
    </div>
  );
}
