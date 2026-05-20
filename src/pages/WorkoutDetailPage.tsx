import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { formatDate, formatDuration, formatDistance, formatPower } from '../utils/formatting';

function formatSpeed(mps: number | undefined): string {
  if (mps == null) return 'N/A';
  const mph = mps * 2.23694;
  return `${mph.toFixed(1)} mph`;
}

function formatHeartRate(bpm: number | undefined): string {
  if (bpm == null) return 'N/A';
  return `${Math.round(bpm)} bpm`;
}

function formatCadence(rpm: number | undefined): string {
  if (rpm == null) return 'N/A';
  return `${Math.round(rpm)} rpm`;
}

function formatElevation(meters: number | undefined): string {
  if (meters == null) return 'N/A';
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

function formatTemp(celsius: number | undefined): string {
  if (celsius == null) return 'N/A';
  const fahrenheit = celsius * 9 / 5 + 32;
  return `${Math.round(fahrenheit)}°F (${Math.round(celsius)}°C)`;
}

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkout, isLoading, error, fetchWorkout, updateWorkout } = useWorkoutStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editComment, setEditComment] = useState('');

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
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!currentWorkout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-lightSilver text-lg">Workout not found</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const workout = currentWorkout;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-brightCyan hover:text-pureWhite transition-colors text-sm"
        >
          ← Back
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
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
          <span className="text-2xl font-bold text-pureWhite">
            {formatDate(workout.startTime)}
          </span>
        </div>
        {workout.description && (
          <p className="text-softFog text-sm">{workout.description}</p>
        )}
        <div className="flex gap-2 flex-wrap mt-2 items-center">
          {(workout.tags ?? []).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-steelBlue text-lightSilver text-xs"
            >
              {tag}
              <button
                onClick={async () => {
                  const updatedTags = (workout.tags ?? []).filter((t) => t !== tag);
                  await updateWorkout(workout.id, { tags: updatedTags });
                }}
                className="text-softFog hover:text-red-400 transition ml-0.5"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <form
            className="inline-flex items-center gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmed = newTag.trim();
              if (!trimmed) return;
              if ((workout.tags ?? []).includes(trimmed)) {
                setNewTag('');
                return;
              }
              await updateWorkout(workout.id, { tags: [...(workout.tags ?? []), trimmed] });
              setNewTag('');
            }}
          >
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tag..."
              className="px-2 py-0.5 rounded bg-steelBlue/50 border border-steelBlue text-pureWhite text-xs placeholder-softFog focus:outline-none focus:ring-1 focus:ring-electricBlue w-24"
            />
            <button
              type="submit"
              className="text-xs px-2 py-0.5 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition"
            >
              +
            </button>
          </form>
        </div>
      </div>

      {/* Comment section */}
      <div className="rounded-lg bg-midnightBlue/60 border border-steelBlue/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold text-softFog uppercase tracking-wide">Comment</h2>
          {!isEditingComment && (
            <button
              onClick={() => {
                setEditComment(workout.comment || '');
                setIsEditingComment(true);
              }}
              className="text-softFog hover:text-lightSilver transition text-sm"
              aria-label="Edit comment"
            >
              ✏️
            </button>
          )}
        </div>
        {isEditingComment ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await updateWorkout(workout.id, { comment: editComment });
              setIsEditingComment(false);
            }}
          >
            <textarea
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-steelBlue/50 border border-steelBlue text-pureWhite placeholder-softFog text-sm focus:outline-none focus:ring-2 focus:ring-electricBlue resize-y"
              placeholder="Add a comment about this workout..."
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className="text-sm px-3 py-1 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingComment(false)}
                className="text-sm px-3 py-1 rounded bg-steelBlue text-lightSilver hover:bg-softFog transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-lightSilver whitespace-pre-wrap">
            {workout.comment || <span className="text-softFog italic">No comment</span>}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DetailCard title="Activity">
          <DetailItem label="Type" value={workout.activityType} />
          {workout.subActivityType && <DetailItem label="Sub-Type" value={workout.subActivityType} />}
          <DetailItem label="Data Source" value={workout.dataSource} />
          {workout.calories != null && <DetailItem label="Calories" value={`${workout.calories} kcal`} />}
        </DetailCard>

        <DetailCard title="Timing">
          <DetailItem label="Start" value={formatDate(workout.startTime)} />
          <DetailItem label="End" value={formatDate(workout.endTime)} />
          <DetailItem label="Duration (Elapsed)" value={formatDuration(workout.durationSeconds)} />
          {workout.movingTimeSeconds != null && <DetailItem label="Moving Time" value={formatDuration(workout.movingTimeSeconds)} />}
        </DetailCard>

        <DetailCard title="Distance & Elevation">
          <DetailItem label="Distance" value={formatDistance(workout.distanceMeters)} />
          <DetailItem label="Elevation Gain" value={formatElevation(workout.elevationGainMeters)} />
          {workout.elevationLossMeters != null && <DetailItem label="Elevation Loss" value={formatElevation(workout.elevationLossMeters)} />}
          <DetailItem label="Avg Speed" value={formatSpeed(workout.avgSpeedMps)} />
          {workout.maxSpeedMps != null && <DetailItem label="Max Speed" value={formatSpeed(workout.maxSpeedMps)} />}
        </DetailCard>

        <DetailCard title="Power">
          <DetailItem label="Avg Power" value={formatPower(workout.avgPowerWatts)} />
          <DetailItem label="Normalized Power" value={formatPower(workout.normalizedPowerWatts)} />
          <DetailItem label="Max Power" value={formatPower(workout.maxPowerWatts)} />
          {workout.totalWorkKj != null && <DetailItem label="Total Work" value={`${workout.totalWorkKj} kJ`} />}
          {workout.ftpUsed != null && <DetailItem label="FTP (Used)" value={`${workout.ftpUsed} W`} />}
          {workout.ftpWatts != null && workout.ftpWatts !== workout.ftpUsed && <DetailItem label="FTP (Device)" value={`${workout.ftpWatts} W`} />}
          {workout.intensityFactor != null && <DetailItem label="Intensity Factor" value={workout.intensityFactor.toFixed(3)} />}
          <DetailItem label="TSS" value={workout.tss != null ? `${workout.tss}` : 'N/A'} />
        </DetailCard>

        <DetailCard title="Heart Rate">
          <DetailItem label="Avg Heart Rate" value={formatHeartRate(workout.avgHeartRateBpm)} />
          <DetailItem label="Max Heart Rate" value={formatHeartRate(workout.maxHeartRateBpm)} />
          <DetailItem label="Pw:Hr (Decoupling)" value={workout.aerobicDecoupling != null ? `${workout.aerobicDecoupling}%` : 'N/A'} />
        </DetailCard>

        <DetailCard title="Cadence">
          <DetailItem label="Avg Cadence" value={formatCadence(workout.avgCadenceRpm)} />
          {workout.maxCadenceRpm != null && <DetailItem label="Max Cadence" value={formatCadence(workout.maxCadenceRpm)} />}
          {workout.totalPedalRevolutions != null && <DetailItem label="Total Revolutions" value={workout.totalPedalRevolutions.toLocaleString()} />}
        </DetailCard>

        {(workout.avgTemperatureCelsius != null || workout.maxTemperatureCelsius != null) && (
          <DetailCard title="Temperature">
            <DetailItem label="Avg Temperature" value={formatTemp(workout.avgTemperatureCelsius)} />
            <DetailItem label="Max Temperature" value={formatTemp(workout.maxTemperatureCelsius)} />
          </DetailCard>
        )}

        {(workout.aerobicTrainingEffect != null || workout.anaerobicTrainingEffect != null) && (
          <DetailCard title="Training Effect">
            {workout.aerobicTrainingEffect != null && <DetailItem label="Aerobic" value={workout.aerobicTrainingEffect.toFixed(1)} />}
            {workout.anaerobicTrainingEffect != null && <DetailItem label="Anaerobic" value={workout.anaerobicTrainingEffect.toFixed(1)} />}
          </DetailCard>
        )}
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

      {/* Delete Workout */}
      <div className="pt-4 border-t border-steelBlue/30">
        <button
          onClick={async () => {
            if (!window.confirm('Are you sure you want to delete this workout? This cannot be undone.')) return;
            try {
              const { deleteWorkout } = await import('../api/workouts');
              await deleteWorkout(workout.id, false);
              navigate(-1);
            } catch {
              // Error handling — could show a toast
            }
          }}
          className="px-4 py-2 rounded bg-red-600/80 text-pureWhite text-sm font-medium hover:bg-red-500 transition"
        >
          Delete Workout
        </button>
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
