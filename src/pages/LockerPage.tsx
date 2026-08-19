import { useState, useRef, type ChangeEvent } from 'react';
import { uploadWorkout, uploadBulk, ingestFromInbox } from '../api/workouts';

interface UploadStatus {
  type: 'success' | 'error';
  message: string;
}

export default function LockerPage() {
  const [singleLoading, setSingleLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [singleStatus, setSingleStatus] = useState<UploadStatus | null>(null);
  const [bulkStatus, setBulkStatus] = useState<UploadStatus | null>(null);
  const [inboxStatus, setInboxStatus] = useState<UploadStatus | null>(null);

  const singleInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const handleSingleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSingleLoading(true);
    setSingleStatus(null);
    try {
      const result = await uploadWorkout(file);
      if (result.duplicate) {
        setSingleStatus({ type: 'success', message: `"${file.name}" has already been imported.` });
      } else {
        setSingleStatus({ type: 'success', message: `"${file.name}" uploaded successfully.` });
      }
    } catch {
      setSingleStatus({ type: 'error', message: `Failed to upload "${file.name}".` });
    } finally {
      setSingleLoading(false);
      if (singleInputRef.current) singleInputRef.current.value = '';
    }
  };

  const handleBulkUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setBulkLoading(true);
    setBulkStatus(null);
    try {
      const result = await uploadBulk(Array.from(files));
      setBulkStatus({
        type: 'success',
        message: `Processed ${result.processed} file(s). ${result.failed > 0 ? `${result.failed} failed.` : ''}`,
      });
    } catch {
      setBulkStatus({ type: 'error', message: 'Bulk upload failed.' });
    } finally {
      setBulkLoading(false);
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    }
  };

  const handleInboxIngestion = async () => {
    setInboxLoading(true);
    setInboxStatus(null);
    try {
      const result = await ingestFromInbox();
      setInboxStatus({
        type: 'success',
        message: `Ingested ${result.processed} workout(s) from inbox. ${result.failed > 0 ? `${result.failed} failed.` : ''}`,
      });
    } catch {
      setInboxStatus({ type: 'error', message: 'Inbox ingestion failed.' });
    } finally {
      setInboxLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-pureWhite">Locker</h1>
      <p className="text-lightSilver">Load workout files into your locker.</p>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Single File Upload */}
        <div className="bg-midnightBlue rounded-xl p-6 border border-steelBlue/50 space-y-4">
          <h2 className="text-lg font-semibold text-pureWhite">Single Upload</h2>
          <p className="text-sm text-softFog">Upload one workout file.</p>
          <label
            className={`block w-full text-center py-2.5 rounded-lg font-semibold transition cursor-pointer ${
              singleLoading
                ? 'bg-steelBlue text-softFog cursor-not-allowed'
                : 'bg-electricBlue text-pureWhite hover:bg-brightCyan'
            }`}
          >
            {singleLoading ? 'Uploading...' : 'Choose File'}
            <input
              ref={singleInputRef}
              type="file"
              className="hidden"
              onChange={handleSingleUpload}
              disabled={singleLoading}
              accept=".fit,.gpx,.tcx,.zip,.gz"
              aria-label="Single file upload"
            />
          </label>
          {singleStatus && (
            <StatusMessage status={singleStatus} />
          )}
        </div>

        {/* Bulk Upload */}
        <div className="bg-midnightBlue rounded-xl p-6 border border-steelBlue/50 space-y-4">
          <h2 className="text-lg font-semibold text-pureWhite">Bulk Upload</h2>
          <p className="text-sm text-softFog">Upload multiple workout files at once.</p>
          <label
            className={`block w-full text-center py-2.5 rounded-lg font-semibold transition cursor-pointer ${
              bulkLoading
                ? 'bg-steelBlue text-softFog cursor-not-allowed'
                : 'bg-electricBlue text-pureWhite hover:bg-brightCyan'
            }`}
          >
            {bulkLoading ? 'Uploading...' : 'Choose Files'}
            <input
              ref={bulkInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleBulkUpload}
              disabled={bulkLoading}
              accept=".fit,.gpx,.tcx,.zip,.gz"
              aria-label="Bulk file upload"
            />
          </label>
          {bulkStatus && (
            <StatusMessage status={bulkStatus} />
          )}
        </div>

        {/* Inbox Ingestion */}
        <div className="bg-midnightBlue rounded-xl p-6 border border-steelBlue/50 space-y-4">
          <h2 className="text-lg font-semibold text-pureWhite">Inbox Ingestion</h2>
          <p className="text-sm text-softFog">Pull workouts from your configured Google Drive inbox.</p>
          <button
            onClick={handleInboxIngestion}
            disabled={inboxLoading}
            className={`w-full py-2.5 rounded-lg font-semibold transition ${
              inboxLoading
                ? 'bg-steelBlue text-softFog cursor-not-allowed'
                : 'bg-electricBlue text-pureWhite hover:bg-brightCyan'
            }`}
          >
            {inboxLoading ? 'Ingesting...' : 'Ingest from Inbox'}
          </button>
          {inboxStatus && (
            <StatusMessage status={inboxStatus} />
          )}
        </div>
      </div>
    </div>
  );
}

function StatusMessage({ status }: { status: UploadStatus }) {
  const isSuccess = status.type === 'success';
  return (
    <div
      className={`p-3 rounded-lg text-sm ${
        isSuccess
          ? 'bg-green-500/20 border border-green-500/50 text-green-300'
          : 'bg-red-500/20 border border-red-500/50 text-red-300'
      }`}
      role="alert"
    >
      {status.message}
    </div>
  );
}
