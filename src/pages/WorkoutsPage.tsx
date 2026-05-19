import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import WorkoutTable from '../components/WorkoutTable';
import Pagination from '../components/Pagination';
import { toWorkoutTableRow } from '../utils/formatting';
import { sortWorkouts } from '../utils/sorting';
import { computeTotalPages } from '../utils/pagination';
import { exportWorkoutsCsv, importWorkoutsCsv } from '../api/workouts';
import type { WorkoutTableRow } from '../types/workout';

export default function WorkoutsPage() {
  const navigate = useNavigate();
  const { workouts, isLoading, error, fetchWorkouts } = useWorkoutStore();

  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTitle, setFilterTitle] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const pageSize = 40;

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const handleSort = (column: string) => {
    if (column === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleRowClick = (id: string) => {
    navigate(`/workouts/${id}`);
  };

  const handleExport = async () => {
    try {
      const csv = await exportWorkoutsCsv({
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workouts-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setImportStatus('Export failed');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    setIsImporting(true);
    try {
      const text = await file.text();
      const result = await importWorkoutsCsv(text);
      const msg = `${result.updated} updated, ${result.skipped} skipped, ${result.failed.length} failed`;
      setImportStatus(msg);
      if (result.updated > 0) fetchWorkouts();
    } catch {
      setImportStatus('Import failed');
    } finally {
      setIsImporting(false);
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  // Apply filters
  const filteredWorkouts = workouts.filter((w) => {
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      if (new Date(w.startTime) < from) return false;
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(w.startTime) > to) return false;
    }
    if (filterTitle) {
      const title = (w.title || w.activityType || '').toLowerCase();
      if (!title.includes(filterTitle.toLowerCase())) return false;
    }
    if (filterTag && !(w.tags ?? []).includes(filterTag)) return false;
    return true;
  });

  // Convert to table rows, sort, and paginate
  const tableRows: WorkoutTableRow[] = filteredWorkouts.map(toWorkoutTableRow);
  const sortedRows = sortWorkouts(tableRows, sortBy as keyof WorkoutTableRow, sortOrder);
  const totalPages = computeTotalPages(sortedRows.length, pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedRows = sortedRows.slice(startIdx, startIdx + pageSize);

  // Get unique tags for filter dropdown
  const allTags = [...new Set(workouts.flatMap((w) => w.tags ?? []))].sort();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg">Loading workouts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <button
          className="px-4 py-2 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors"
          onClick={() => fetchWorkouts()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-pureWhite">Workouts</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="text-sm px-4 py-2 rounded bg-steelBlue text-lightSilver hover:bg-softFog transition"
          >
            Export CSV
          </button>
          <label className={`text-sm px-4 py-2 rounded transition ${isImporting ? 'bg-steelBlue/50 text-softFog cursor-not-allowed' : 'bg-steelBlue text-lightSilver hover:bg-softFog cursor-pointer'}`}>
            {isImporting ? 'Importing...' : 'Import CSV'}
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
              disabled={isImporting}
            />
          </label>
        </div>
      </div>

      {importStatus && (
        <div className="p-3 rounded-lg bg-electricBlue/20 border border-electricBlue/50 text-lightSilver text-sm">
          {importStatus}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-midnightBlue/60 rounded-lg p-4 border border-steelBlue/50">
        <div>
          <label className="block text-xs text-softFog mb-1">From</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded bg-steelBlue/50 border border-steelBlue text-pureWhite text-sm focus:outline-none focus:ring-1 focus:ring-electricBlue"
          />
        </div>
        <div>
          <label className="block text-xs text-softFog mb-1">To</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded bg-steelBlue/50 border border-steelBlue text-pureWhite text-sm focus:outline-none focus:ring-1 focus:ring-electricBlue"
          />
        </div>
        <div>
          <label className="block text-xs text-softFog mb-1">Title</label>
          <input
            type="text"
            value={filterTitle}
            onChange={(e) => { setFilterTitle(e.target.value); setCurrentPage(1); }}
            placeholder="Search..."
            className="px-3 py-1.5 rounded bg-steelBlue/50 border border-steelBlue text-pureWhite text-sm placeholder-softFog focus:outline-none focus:ring-1 focus:ring-electricBlue w-40"
          />
        </div>
        <div>
          <label className="block text-xs text-softFog mb-1">Tag</label>
          <select
            value={filterTag}
            onChange={(e) => { setFilterTag(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 rounded bg-steelBlue/50 border border-steelBlue text-pureWhite text-sm focus:outline-none focus:ring-1 focus:ring-electricBlue"
          >
            <option value="">All</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
        {(filterDateFrom || filterDateTo || filterTitle || filterTag) && (
          <button
            onClick={() => {
              setFilterDateFrom('');
              setFilterDateTo('');
              setFilterTitle('');
              setFilterTag('');
              setCurrentPage(1);
            }}
            className="text-sm px-3 py-1.5 rounded bg-steelBlue text-lightSilver hover:bg-softFog transition"
          >
            Clear Filters
          </button>
        )}
      </div>

      <p className="text-sm text-softFog">
        {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''} found
      </p>

      <WorkoutTable
        workouts={paginatedRows}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={handleRowClick}
      />

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
