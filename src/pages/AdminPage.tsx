import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { recalculateWorkouts, recalculateSpeed } from '../api/workouts';
import { getGoogleAuthUrl } from '../api/settings';

export default function AdminPage() {
  const { settings, isLoading, error, fetchSettings, updateSettings } = useSettingsStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [driveStoragePath, setDriveStoragePath] = useState('');
  const [driveInboxPath, setDriveInboxPath] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Google Drive connection state
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveAuthResult, setDriveAuthResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // FTP History state
  const [ftpHistory, setFtpHistory] = useState<Array<{ effectiveDate: string; ftpWatts: number }>>([]);
  const [newFtpDate, setNewFtpDate] = useState('');
  const [newFtpWatts, setNewFtpWatts] = useState('');
  const [ftpSaveSuccess, setFtpSaveSuccess] = useState(false);

  // Recalculate state
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<string | null>(null);
  const [isRecalcSpeed, setIsRecalcSpeed] = useState(false);
  const [recalcSpeedResult, setRecalcSpeedResult] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle OAuth callback redirect result
  useEffect(() => {
    const authResult = searchParams.get('driveAuth');
    if (authResult === 'success') {
      setDriveAuthResult({ type: 'success', message: 'Google Drive connected successfully.' });
      searchParams.delete('driveAuth');
      setSearchParams(searchParams, { replace: true });
      fetchSettings(); // Refresh to show updated connection state
    } else if (authResult === 'error') {
      const reason = searchParams.get('reason') || 'Connection failed';
      setDriveAuthResult({ type: 'error', message: reason });
      searchParams.delete('driveAuth');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectDrive = async () => {
    setDriveConnecting(true);
    setDriveAuthResult(null);
    try {
      const authUrl = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch {
      setDriveAuthResult({ type: 'error', message: 'Failed to initiate Google Drive connection.' });
      setDriveConnecting(false);
    }
  };

  const isDriveConnected = settings?.connectedSources?.some(
    (s) => s.connected && s.provider === 'manual' && s.connectedAt
  ) ?? false;

  useEffect(() => {
    if (settings) {
      setDriveStoragePath(settings.driveStoragePath);
      setDriveInboxPath(settings.driveInboxPath);
      setTimezone(settings.timezone ?? 'America/Chicago');
      setFtpHistory(settings.ftpHistory ?? []);
    }
  }, [settings]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    try {
      await updateSettings({ driveStoragePath, driveInboxPath, timezone });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error is set in the store
    }
  };

  const handleAddFtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFtpDate || !newFtpWatts) return;
    const watts = parseInt(newFtpWatts, 10);
    if (isNaN(watts) || watts <= 0) return;

    const updated = [...ftpHistory, { effectiveDate: newFtpDate, ftpWatts: watts }]
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

    try {
      await updateSettings({ ftpHistory: updated });
      setFtpHistory(updated);
      setNewFtpDate('');
      setNewFtpWatts('');
      setFtpSaveSuccess(true);
      setTimeout(() => setFtpSaveSuccess(false), 3000);
    } catch {
      // Error handled by store
    }
  };

  const handleDeleteFtp = async (index: number) => {
    const updated = ftpHistory.filter((_, i) => i !== index);
    try {
      await updateSettings({ ftpHistory: updated });
      setFtpHistory(updated);
    } catch {
      // Error handled by store
    }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setRecalcResult(null);
    try {
      const result = await recalculateWorkouts();
      setRecalcResult(`${result.updated} workouts updated, ${result.failed} failed`);
    } catch {
      setRecalcResult('Recalculation failed');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRecalculateSpeed = async () => {
    setIsRecalcSpeed(true);
    setRecalcSpeedResult(null);
    try {
      const result = await recalculateSpeed();
      setRecalcSpeedResult(`${result.updated} workouts updated, ${result.failed} failed`);
    } catch {
      setRecalcSpeedResult('Recalculation failed');
    } finally {
      setIsRecalcSpeed(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-pureWhite">Admin Settings</h1>

      {/* Google Drive Connection */}
      <div className="bg-midnightBlue/80 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-lightSilver mb-4">
          Google Drive
        </h2>
        <p className="text-softFog text-sm mb-4">
          Source workout files are archived to your Google Drive for durable storage.
        </p>

        {driveAuthResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${driveAuthResult.type === 'success' ? 'bg-green-500/20 border border-green-500/50 text-green-300' : 'bg-red-500/20 border border-red-500/50 text-red-300'}`} role="alert">
            {driveAuthResult.message}
          </div>
        )}

        {isDriveConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-green-300 text-sm font-medium">Connected</span>
            </div>
            <p className="text-softFog text-sm">
              Source files will be archived to: <span className="text-lightSilver">{settings?.driveStoragePath || 'WattLocker'}</span>
            </p>
            <button
              onClick={handleConnectDrive}
              disabled={driveConnecting}
              className="px-4 py-2 rounded-lg bg-steelBlue text-lightSilver text-sm font-medium hover:bg-softFog disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {driveConnecting ? 'Reconnecting...' : 'Reconnect'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-red-300 text-sm font-medium">Not connected</span>
            </div>
            <p className="text-softFog text-sm">
              Connect Google Drive to enable source file archival.
            </p>
            <button
              onClick={handleConnectDrive}
              disabled={driveConnecting}
              className="px-6 py-2.5 rounded-lg bg-electricBlue text-pureWhite font-semibold hover:bg-brightCyan disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {driveConnecting ? 'Connecting...' : 'Connect Google Drive'}
            </button>
          </div>
        )}
      </div>

      {/* Google Drive Configuration */}
      <div className="bg-midnightBlue/80 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-lightSilver mb-4">
          Google Drive Configuration
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm" role="alert">
            {error}
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/50 text-green-300 text-sm" role="status">
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
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-lightSilver mb-1">
              Timezone
            </label>
            <input
              id="timezone"
              type="text"
              list="timezone-options"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Search timezones..."
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-lg bg-steelBlue/50 border border-steelBlue text-pureWhite placeholder-softFog focus:outline-none focus:ring-2 focus:ring-electricBlue focus:border-transparent transition disabled:opacity-50"
            />
            <datalist id="timezone-options">
              {Intl.supportedValuesOf('timeZone').map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            <p className="text-xs text-softFog mt-1">Start typing to search (e.g., &quot;Chicago&quot;, &quot;New_York&quot;, &quot;London&quot;)</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-lg bg-electricBlue text-pureWhite font-semibold hover:bg-brightCyan disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* FTP History */}
      <div className="bg-midnightBlue/80 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-lightSilver mb-4">
          FTP History
        </h2>
        <p className="text-softFog text-sm mb-4">
          Manage your FTP history. The correct FTP is used to compute TSS and Intensity Factor for each workout.
        </p>

        {ftpSaveSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/50 text-green-300 text-sm">
            FTP history updated.
          </div>
        )}

        {/* Add new entry */}
        <form onSubmit={handleAddFtp} className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs text-softFog mb-1">Effective Date</label>
            <input
              type="date"
              value={newFtpDate}
              onChange={(e) => setNewFtpDate(e.target.value)}
              className="px-3 py-1.5 rounded bg-steelBlue/50 border border-steelBlue text-pureWhite text-sm focus:outline-none focus:ring-1 focus:ring-electricBlue"
            />
          </div>
          <div>
            <label className="block text-xs text-softFog mb-1">FTP (watts)</label>
            <input
              type="number"
              value={newFtpWatts}
              onChange={(e) => setNewFtpWatts(e.target.value)}
              placeholder="270"
              min="50"
              max="500"
              className="px-3 py-1.5 rounded bg-steelBlue/50 border border-steelBlue text-pureWhite text-sm focus:outline-none focus:ring-1 focus:ring-electricBlue w-24"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-electricBlue text-pureWhite text-sm font-medium hover:bg-brightCyan transition"
          >
            Add
          </button>
        </form>

        {/* History table */}
        {ftpHistory.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-steelBlue/50">
            <table className="w-full text-sm text-left">
              <thead className="bg-steelBlue/30 text-softFog uppercase text-xs">
                <tr>
                  <th className="px-4 py-2">Effective Date</th>
                  <th className="px-4 py-2">FTP (W)</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steelBlue/30">
                {ftpHistory.map((entry, idx) => (
                  <tr key={`${entry.effectiveDate}-${entry.ftpWatts}`} className="text-lightSilver">
                    <td className="px-4 py-2">
                      {new Date(entry.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-2">{entry.ftpWatts} W</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleDeleteFtp(idx)}
                        className="text-red-400 hover:text-red-300 text-xs transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-softFog text-sm italic">No FTP history entries. Add one above.</p>
        )}

        {/* Recalculate */}
        <div className="mt-6 pt-4 border-t border-steelBlue/30">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="px-4 py-2 rounded bg-steelBlue text-lightSilver text-sm font-medium hover:bg-softFog disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isRecalculating ? 'Recalculating...' : 'Recalculate TSS/IF'}
            </button>
            {recalcResult && (
              <span className="text-sm text-lightSilver">{recalcResult}</span>
            )}
          </div>
          <p className="text-xs text-softFog mt-2">
            Recomputes TSS and Intensity Factor for all workouts using the current FTP history.
          </p>
          <div className="flex items-center gap-4 flex-wrap mt-4">
            <button
              onClick={handleRecalculateSpeed}
              disabled={isRecalcSpeed}
              className="px-4 py-2 rounded bg-steelBlue text-lightSilver text-sm font-medium hover:bg-softFog disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isRecalcSpeed ? 'Recalculating...' : 'Recalculate Avg Speed'}
            </button>
            {recalcSpeedResult && (
              <span className="text-sm text-lightSilver">{recalcSpeedResult}</span>
            )}
          </div>
          <p className="text-xs text-softFog mt-2">
            Recomputes average speed for all workouts using distance / moving time.
          </p>
        </div>
      </div>

      {/* User Administration */}
      <div className="bg-midnightBlue/80 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-lightSilver mb-4">
          User Administration
        </h2>
        <p className="text-softFog text-sm">
          User administration coming soon.
        </p>
      </div>
    </div>
  );
}
