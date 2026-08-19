import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listTemplates, deleteWorkout } from '../api/workouts';
import type { Template, TemplateListResponse } from '../api/workouts';

const ACTIVITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'ride', label: 'Ride' },
  { value: 'virtual_ride', label: 'Virtual Ride' },
  { value: 'mountain_ride', label: 'Mountain Ride' },
  { value: 'gravel_ride', label: 'Gravel Ride' },
  { value: 'run', label: 'Run' },
  { value: 'swim', label: 'Swim' },
  { value: 'walk', label: 'Walk' },
  { value: 'strength', label: 'Strength' },
  { value: 'other', label: 'Other' },
];

function getActivityLabel(type: string): string {
  const found = ACTIVITY_TYPES.find((a) => a.value === type);
  return found ? found.label : type;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return `${miles.toFixed(1)} mi`;
}

function formatSegmentSummary(segments: Template['segments']): string {
  if (!segments || segments.length === 0) return '';
  return `${segments.length} segment${segments.length !== 1 ? 's' : ''}`;
}

export default function TemplateLibraryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, totalItems: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [activityType, setActivityType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchTemplates = useCallback(async (page: number, searchTerm: string, type: string) => {
    setLoading(true);
    setError(null);
    try {
      const result: TemplateListResponse = await listTemplates({
        page,
        pageSize: 12,
        search: searchTerm || undefined,
        activityType: type || undefined,
      });
      setTemplates(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchTemplates(1, debouncedSearch, activityType);
  }, [debouncedSearch, activityType, fetchTemplates]);

  const handlePageChange = (newPage: number) => {
    fetchTemplates(newPage, debouncedSearch, activityType);
  };

  const handleUseTemplate = (template: Template) => {
    const deepCopy = JSON.parse(JSON.stringify(template));
    // Preserve date from current search params if available
    const dateParam = searchParams.get('date');
    const path = dateParam ? `/activities/plan?date=${dateParam}` : '/activities/plan';
    navigate(path, { state: { template: deepCopy } });
  };

  const handleEditTemplate = (template: Template) => {
    navigate(`/templates/${template.id}/edit`);
  };

  const openDeleteConfirm = (template: Template) => {
    setDeleteTarget(template);
    setDeleteError(null);
  };

  const closeDeleteConfirm = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteWorkout(deleteTarget.id);
      setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id));
      closeDeleteConfirm();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="template-library-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-pureWhite" data-testid="page-title">
          Template Library
        </h1>
        <button
          onClick={() => navigate('/templates/new')}
          className="px-4 py-2 bg-electricBlue text-pureWhite rounded hover:bg-brightCyan transition-colors font-medium text-sm"
          data-testid="new-template-btn"
        >
          + New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6" data-testid="template-filters">
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded bg-charcoalGray text-pureWhite border border-steelBlue placeholder-lightSilver focus:outline-none focus:border-electricBlue"
          data-testid="template-search-input"
        />
        <select
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          className="px-4 py-2 rounded bg-charcoalGray text-pureWhite border border-steelBlue focus:outline-none focus:border-electricBlue"
          data-testid="template-activity-filter"
        >
          {ACTIVITY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-lightSilver" data-testid="loading-state">
          Loading templates...
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-12 text-red-400" data-testid="error-state">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && templates.length === 0 && (
        <div className="text-center py-12 text-lightSilver" data-testid="empty-state">
          No templates found.
        </div>
      )}

      {/* Template grid */}
      {!loading && !error && templates.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="template-grid">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-charcoalGray rounded-lg p-4 border border-steelBlue hover:border-electricBlue transition-colors"
                data-testid="template-card"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-pureWhite font-semibold truncate" data-testid="template-title">
                    {template.title || 'Untitled Template'}
                  </h3>
                  <span className="text-xs text-lightSilver bg-deepNavy px-2 py-1 rounded ml-2 whitespace-nowrap" data-testid="template-activity-type">
                    {getActivityLabel(template.activityType)}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-softFog mb-3">
                  {template.plannedDurationSeconds && (
                    <div data-testid="template-duration">
                      Duration: {formatDuration(template.plannedDurationSeconds)}
                    </div>
                  )}
                  {template.plannedDistanceMeters && (
                    <div data-testid="template-distance">
                      Distance: {formatDistance(template.plannedDistanceMeters)}
                    </div>
                  )}
                  {template.plannedTss && (
                    <div data-testid="template-tss">TSS: {template.plannedTss}</div>
                  )}
                  {template.plannedIf && (
                    <div data-testid="template-if">IF: {template.plannedIf.toFixed(2)}</div>
                  )}
                  {template.segments && template.segments.length > 0 && (
                    <div data-testid="template-segments">
                      {formatSegmentSummary(template.segments)}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleUseTemplate(template)}
                  className="w-full px-4 py-2 bg-electricBlue text-pureWhite rounded hover:bg-brightCyan transition-colors font-medium"
                  data-testid="use-template-button"
                >
                  Use Template
                </button>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="flex-1 px-3 py-1.5 bg-steelBlue text-pureWhite rounded hover:bg-gray-600 transition-colors text-sm"
                    data-testid="edit-template-button"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(template)}
                    className="flex-1 px-3 py-1.5 bg-red-700 text-pureWhite rounded hover:bg-red-600 transition-colors text-sm"
                    data-testid="delete-template-button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-4 mt-6" data-testid="pagination">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 bg-charcoalGray text-pureWhite rounded border border-steelBlue disabled:opacity-50 disabled:cursor-not-allowed hover:border-electricBlue transition-colors"
              data-testid="pagination-prev"
            >
              Previous
            </button>
            <span className="text-lightSilver" data-testid="pagination-info">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 bg-charcoalGray text-pureWhite rounded border border-steelBlue disabled:opacity-50 disabled:cursor-not-allowed hover:border-electricBlue transition-colors"
              data-testid="pagination-next"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Delete Template Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="delete-template-backdrop">
          <div className="absolute inset-0 bg-black/50" onClick={closeDeleteConfirm} />
          <div
            className="relative bg-charcoalGray rounded-lg p-5 shadow-xl border border-steelBlue w-80"
            role="dialog"
            aria-label="Delete template"
            data-testid="delete-template-dialog"
          >
            <h3 className="text-pureWhite font-semibold text-sm mb-2">Delete Template?</h3>
            <p className="text-lightSilver text-sm mb-4" data-testid="delete-template-name">
              {deleteTarget.title || 'Untitled Template'}
            </p>
            <p className="text-softFog text-xs mb-4">
              This will permanently delete this template.
            </p>
            {deleteError && (
              <p className="text-red-400 text-xs mb-3" data-testid="delete-template-error">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="px-3 py-1.5 rounded bg-steelBlue text-pureWhite hover:bg-gray-600 transition-colors text-sm"
                data-testid="delete-template-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTemplate}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded bg-red-600 text-pureWhite hover:bg-red-500 transition-colors text-sm disabled:opacity-50"
                data-testid="delete-template-confirm-btn"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
