import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { formatDate, formatDuration, formatDistance, formatPower } from '../utils/formatting';

function formatSpeed(mps: number | undefined): string {
  if (mps == null) return 'N/A';
  const kmh = mps * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

function formatHeartRate(bpm: number | undefined): string {
  if (bpm == null) return 'N/A';
  return `${Math.round(bpm)} bpm`;
}

function formatCadence(rpm: number | undefined): string {
  if (rpm == null) return 'N/A';
  return `${Math.round(rpm)} rpm`;
}

function formatElevation(meters: number): string {
  if (meters == null) return 'N/A';
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentWorkout, isLoading, error, fetchWorkout, updateWorkout } = useWorkoutStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    if (id) {
      fetchWorkout(id);
    }
  }, [id, fetchWorkout]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg">Loading workout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <Link
          to="/dashboard"
          className="px-4 py-2 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!currentWorkout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-lightSilver text-lg">Workout not found</p>
        <Link
          to="/dashboard"
          className="px-4 py-2 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const workout = currentWorkout;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard"
          className="text-brightCyan hover:text-pureWhite transition-colors text-sm"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <form
              className="flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await updateWorkout(workout.id, { title: editTitle });
                setIsEditingTitle(false);
              }}
            >
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-bold bg-steelBlue/50 border border-steelBlue text-pureWhite rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-electricBlue"
                autoFocus
              />
              <button
                type="submit"
                className="text-sm px-3 py-1 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="text-sm px-3 py-1 rounded bg-steelBlue text-lightSilver hover:bg-softFog transition"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-pureWhite">
                {workout.title || workout.activityType}
              </h1>
              <button
                onClick={() => {
                  setEditTitle(workout.title || '');
                  setIsEditingTitle(true);
                }}
                className="text-softFog hover:text-lightSilver transition text-sm"
                aria-label="Edit title"
              >
                ✏️
              </button>
            </>
          )}
        </div>
        {workout.description && (
          <p className="text-softFog text-sm">{workout.description}</p>
        )}
        {workout.tags && workout.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-2">
            {workout.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded bg-steelBlue text-lightSilver text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DetailCard title="Activity">
          <DetailItem label="Type" value={workout.activityType} />
          <DetailItem label="Data Source" value={workout.dataSource} />
        </DetailCard>

        <DetailCard title="Timing">
          <DetailItem label="Start" value={formatDate(workout.startTime)} />
          <DetailItem label="End" value={formatDate(workout.endTime)} />
          <DetailItem label="Duration" value={formatDuration(workout.durationSeconds)} />
        </DetailCard>

        <DetailCard title="Distance & Elevation">
          <DetailItem label="Distance" value={formatDistance(workout.distanceMeters)} />
          <DetailItem label="Elevation Gain" value={formatElevation(workout.elevationGainMeters)} />
          <DetailItem label="Avg Speed" value={formatSpeed(workout.avgSpeedMps)} />
        </DetailCard>

        <DetailCard title="Power">
          <DetailItem label="Avg Power" value={formatPower(workout.avgPowerWatts)} />
          <DetailItem label="Normalized Power" value={formatPower(workout.normalizedPowerWatts)} />
          <DetailItem label="Max Power" value={formatPower(workout.maxPowerWatts)} />
          <DetailItem label="TSS" value={workout.tss != null ? `${workout.tss}` : 'N/A'} />
        </DetailCard>

        <DetailCard title="Heart Rate">
          <DetailItem label="Avg Heart Rate" value={formatHeartRate(workout.avgHeartRateBpm)} />
          <DetailItem label="Max Heart Rate" value={formatHeartRate(workout.maxHeartRateBpm)} />
          <DetailItem label="Pw:Hr (Decoupling)" value={workout.aerobicDecoupling != null ? `${workout.aerobicDecoupling}%` : 'N/A'} />
        </DetailCard>

        <DetailCard title="Cadence">
          <DetailItem label="Avg Cadence" value={formatCadence(workout.avgCadenceRpm)} />
        </DetailCard>
      </div>

      <div className="rounded-lg bg-midnightBlue border border-steelBlue p-4 space-y-2">
        <h2 className="text-sm font-semibold text-softFog uppercase tracking-wide">Metadata</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <DetailItem label="Workout ID" value={workout.id} />
          <DetailItem label="User ID" value={workout.userId} />
          <DetailItem label="Created" value={formatDate(workout.createdAt)} />
          <DetailItem label="Updated" value={formatDate(workout.updatedAt)} />
        </div>
      </div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-midnightBlue border border-steelBlue p-4 space-y-2">
      <h2 className="text-sm font-semibold text-softFog uppercase tracking-wide">{title}</h2>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <dt className="text-softFog text-sm">{label}</dt>
      <dd className="text-pureWhite text-sm font-medium">{value}</dd>
    </div>
  );
}
