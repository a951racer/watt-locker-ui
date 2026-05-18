import { Link } from 'react-router-dom';
import type { WorkoutTableRow } from '../types/workout';

interface WorkoutTableProps {
  workouts: WorkoutTableRow[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
  onRowClick: (id: string) => void;
}

const columns: { key: keyof WorkoutTableRow; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Title' },
  { key: 'duration', label: 'Duration' },
  { key: 'distance', label: 'Distance' },
  { key: 'avgPower', label: 'Avg Power' },
  { key: 'normalizedPower', label: 'Normalized Power' },
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
  return (
    <div className="overflow-x-auto rounded-lg border border-steelBlue">
      <table className="w-full min-w-[700px] text-sm text-left">
        <thead className="bg-midnightBlue text-softFog uppercase text-xs">
          <tr>
            {columns.map(({ key, label }) => (
              <th
                key={key}
                className="px-4 py-3 cursor-pointer select-none hover:text-lightSilver transition-colors whitespace-nowrap"
                onClick={() => onSort(key)}
                aria-sort={sortBy === key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                {label}
                <SortIndicator column={key} sortBy={sortBy} sortOrder={sortOrder} />
              </th>
            ))}
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
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.duration}</td>
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.distance}</td>
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.avgPower}</td>
              <td className="px-4 py-3 text-lightSilver whitespace-nowrap">{workout.normalizedPower}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
