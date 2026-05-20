import { Link } from 'react-router-dom';
import type { WorkoutTableRow } from '../types/workout';

interface WorkoutTableProps {
  workouts: WorkoutTableRow[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  onRowClick: (id: string) => void;
}

const columns: { key: string; label: string; sortable: boolean }[] = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'name', label: 'Title', sortable: true },
  { key: 'tags', label: 'Tags', sortable: false },
  { key: 'duration', label: 'Moving Time', sortable: true },
  { key: 'distance', label: 'Distance', sortable: true },
  { key: 'avgSpeed', label: 'Avg Speed', sortable: true },
  { key: 'avgPower', label: 'Avg Power', sortable: true },
  { key: 'normalizedPower', label: 'Normalized Power', sortable: true },
];

function SortIndicator({ column, sortBy, sortOrder }: { column: string; sortBy: string; sortOrder: 'asc' | 'desc' }) {
  if (column !== sortBy) return null;
  return (
    <span className="ml-1 inline-block" aria-label={sortOrder === 'asc' ? 'sorted ascending' : 'sorted descending'}>
      {sortOrder === 'asc' ? '▲' : '▼'}
    </span>
  );
}

export default function WorkoutTable({ workouts, sortBy, sortOrder, onSort, onRowClick }: WorkoutTableProps) {
  const isSortable = !!onSort;

  return (
    <div className="overflow-x-auto rounded-lg border border-steelBlue">
      <table className="w-full min-w-[750px] text-sm text-left">
        <thead className="bg-midnightBlue text-softFog uppercase text-xs">
          <tr>
            {columns.map(({ key, label, sortable }) => {
              const canSort = isSortable && sortable;
              return (
                <th
                  key={key}
                  className={`px-4 py-3 whitespace-nowrap ${canSort ? 'cursor-pointer select-none hover:text-lightSilver transition-colors' : ''}`}
                  onClick={canSort ? () => onSort!(key) : undefined}
                  aria-sort={canSort && sortBy === key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {label}
                  {canSort && sortBy && sortOrder && (
                    <SortIndicator column={key} sortBy={sortBy} sortOrder={sortOrder} />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-steelBlue">
          {workouts.map((workout) => (
            <tr
              key={workout.id}
              className="bg-deepNavy hover:bg-midnightBlue transition-colors cursor-pointer"
              onClick={() => onRowClick(workout.id)}
            >
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.date}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <Link
                  to={`/workouts/${workout.id}`}
                  className="text-brightCyan hover:text-electricBlue underline transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {workout.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  {(workout.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded bg-steelBlue text-lightSilver text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.duration}</td>
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.distance}</td>
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.avgSpeed}</td>
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.avgPower}</td>
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.normalizedPower}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
