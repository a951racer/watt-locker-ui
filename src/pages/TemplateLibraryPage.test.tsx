import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TemplateLibraryPage from './TemplateLibraryPage';
import * as workoutsApi from '../api/workouts';
import type { Template } from '../api/workouts';

vi.mock('../api/workouts', () => ({
  listTemplates: vi.fn(),
  deleteWorkout: vi.fn(),
}));

const mockListTemplates = vi.mocked(workoutsApi.listTemplates);
const mockDeleteWorkout = vi.mocked(workoutsApi.deleteWorkout);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'tmpl-1',
    activityType: 'ride',
    template: true,
    status: null,
    title: 'Endurance Ride',
    plannedDurationSeconds: 3600,
    plannedDistanceMeters: 40000,
    plannedTss: 65,
    plannedIf: 0.72,
    segments: [
      { type: 'warmup', durationSeconds: 600 },
      { type: 'interval', durationSeconds: 1200, powerMin: 250, powerMax: 280 },
      { type: 'cooldown', durationSeconds: 600 },
    ],
    tags: ['endurance'],
    ...overrides,
  };
}

const defaultResponse = {
  items: [createTemplate()],
  pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
};

function renderPage(route = '/templates') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/templates" element={<TemplateLibraryPage />} />
        <Route path="/activities/plan" element={<div>Plan Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TemplateLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTemplates.mockResolvedValue(defaultResponse);
  });

  // --- Basic Rendering ---

  it('renders the template library page', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('template-library-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('page-title')).toHaveTextContent('Template Library');
  });

  it('shows loading state initially', () => {
    mockListTemplates.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('shows empty state when no templates', async () => {
    mockListTemplates.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 12, totalItems: 0, totalPages: 0 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    mockListTemplates.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  // --- Template Cards ---

  it('displays template cards with correct data', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('template-title')).toHaveTextContent('Endurance Ride');
    expect(screen.getByTestId('template-activity-type')).toHaveTextContent('Ride');
    expect(screen.getByTestId('template-duration')).toHaveTextContent('1:00:00');
    expect(screen.getByTestId('template-distance')).toHaveTextContent('24.9 mi');
    expect(screen.getByTestId('template-tss')).toHaveTextContent('TSS: 65');
    expect(screen.getByTestId('template-if')).toHaveTextContent('IF: 0.72');
    expect(screen.getByTestId('template-segments')).toHaveTextContent('3 segments');
  });

  it('displays "Untitled Template" when title is missing', async () => {
    mockListTemplates.mockResolvedValue({
      items: [createTemplate({ title: undefined })],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('template-title')).toHaveTextContent('Untitled Template');
    });
  });

  it('does not show optional fields when not present', async () => {
    mockListTemplates.mockResolvedValue({
      items: [createTemplate({ plannedDurationSeconds: undefined, plannedDistanceMeters: undefined, plannedTss: undefined, plannedIf: undefined, segments: undefined })],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('template-duration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-distance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-tss')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-if')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-segments')).not.toBeInTheDocument();
  });

  // --- Search ---

  it('calls listTemplates with search term after debounce', async () => {
    vi.useFakeTimers();
    renderPage();

    // Wait for initial load by flushing promises
    await act(async () => { await vi.runAllTimersAsync(); });

    const searchInput = screen.getByTestId('template-search-input');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'threshold' } });
    });

    // Advance past debounce
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });

    expect(mockListTemplates).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'threshold' })
    );

    vi.useRealTimers();
  });

  // --- Activity Type Filter ---

  it('calls listTemplates with activity type filter', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('template-activity-filter'), { target: { value: 'run' } });

    await waitFor(() => {
      expect(mockListTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ activityType: 'run' })
      );
    });
  });

  // --- Pagination ---

  it('shows pagination info', async () => {
    mockListTemplates.mockResolvedValue({
      items: [createTemplate()],
      pagination: { page: 1, pageSize: 12, totalItems: 25, totalPages: 3 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 3');
    });
  });

  it('disables Previous button on first page', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('pagination-prev')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pagination-prev')).toBeDisabled();
  });

  it('disables Next button on last page', async () => {
    mockListTemplates.mockResolvedValue({
      items: [createTemplate()],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pagination-next')).toBeDisabled();
  });

  it('calls listTemplates with next page on Next click', async () => {
    mockListTemplates.mockResolvedValue({
      items: [createTemplate()],
      pagination: { page: 1, pageSize: 12, totalItems: 25, totalPages: 3 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('pagination-next')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('pagination-next'));

    await waitFor(() => {
      expect(mockListTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  // --- Use Template Navigation ---

  it('navigates to plan page with template data on Use Template click', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('use-template-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('use-template-button'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/activities/plan',
      expect.objectContaining({
        state: expect.objectContaining({
          template: expect.objectContaining({
            id: 'tmpl-1',
            activityType: 'ride',
            title: 'Endurance Ride',
          }),
        }),
      })
    );
  });

  it('preserves date param when navigating with template', async () => {
    render(
      <MemoryRouter initialEntries={['/templates?date=2024-07-01']}>
        <Routes>
          <Route path="/templates" element={<TemplateLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('use-template-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('use-template-button'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/activities/plan?date=2024-07-01',
      expect.objectContaining({ state: expect.any(Object) })
    );
  });

  // --- Multiple templates ---

  it('renders multiple template cards', async () => {
    mockListTemplates.mockResolvedValue({
      items: [
        createTemplate({ id: 'tmpl-1', title: 'Template A' }),
        createTemplate({ id: 'tmpl-2', title: 'Template B' }),
        createTemplate({ id: 'tmpl-3', title: 'Template C' }),
      ],
      pagination: { page: 1, pageSize: 12, totalItems: 3, totalPages: 1 },
    });
    renderPage();
    await waitFor(() => {
      const cards = screen.getAllByTestId('template-card');
      expect(cards).toHaveLength(3);
    });
  });

  // --- Duration formatting ---

  it('formats short durations correctly (no hours)', async () => {
    mockListTemplates.mockResolvedValue({
      items: [createTemplate({ plannedDurationSeconds: 1800 })],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('template-duration')).toHaveTextContent('30:00');
    });
  });

  // --- Segment count display ---

  it('shows singular segment text for one segment', async () => {
    mockListTemplates.mockResolvedValue({
      items: [createTemplate({ segments: [{ type: 'steady', durationSeconds: 3600 }] })],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('template-segments')).toHaveTextContent('1 segment');
    });
  });
});


describe('TemplateLibraryPage — Template CRUD (PLAN-034)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTemplates.mockResolvedValue({
      items: [
        createTemplate({ id: 'tmpl-1', title: 'Sweet Spot', activityType: 'ride', segments: [{ type: 'interval', durationSeconds: 1200, powerMin: 88, powerMax: 95 }] }),
        createTemplate({ id: 'tmpl-2', title: 'Recovery Spin', activityType: 'ride' }),
      ],
      pagination: { page: 1, pageSize: 12, totalItems: 2, totalPages: 1 },
    });
    mockDeleteWorkout.mockResolvedValue(undefined);
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/templates']}>
        <Routes>
          <Route path="/templates" element={<TemplateLibraryPage />} />
          <Route path="/templates/new" element={<div data-testid="new-template-page">New Template</div>} />
          <Route path="/templates/:id/edit" element={<div data-testid="edit-template-page">Edit Template</div>} />
          <Route path="/activities/plan" element={<div data-testid="plan-activity-page">Plan Activity</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('shows + New Template button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('new-template-btn')).toBeInTheDocument();
    });
  });

  it('clicking + New Template navigates to /templates/new', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('new-template-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('new-template-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/templates/new');
  });

  it('each template card has Edit button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('edit-template-button')).toHaveLength(2);
    });
  });

  it('clicking Edit navigates to /templates/:id/edit', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('edit-template-button')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByTestId('edit-template-button')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/templates/tmpl-1/edit');
  });

  it('each template card has Delete button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('delete-template-button')).toHaveLength(2);
    });
  });

  it('clicking Delete opens confirmation dialog', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('delete-template-button')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByTestId('delete-template-button')[0]);
    expect(screen.getByTestId('delete-template-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('delete-template-name')).toHaveTextContent('Sweet Spot');
  });

  it('Cancel in delete dialog does not call API', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('delete-template-button')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByTestId('delete-template-button')[0]);
    fireEvent.click(screen.getByTestId('delete-template-cancel-btn'));
    expect(screen.queryByTestId('delete-template-dialog')).not.toBeInTheDocument();
    expect(mockDeleteWorkout).not.toHaveBeenCalled();
  });

  it('Confirm delete calls deleteWorkout with correct ID', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('delete-template-button')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByTestId('delete-template-button')[0]);
    fireEvent.click(screen.getByTestId('delete-template-confirm-btn'));
    await waitFor(() => {
      expect(mockDeleteWorkout).toHaveBeenCalledWith('tmpl-1');
    });
  });

  it('successful delete removes template from the list', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('template-card')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByTestId('delete-template-button')[0]);
    fireEvent.click(screen.getByTestId('delete-template-confirm-btn'));
    await waitFor(() => {
      expect(mockDeleteWorkout).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('template-card')).toHaveLength(1);
    });
  });

  it('failed delete leaves template intact and shows error', async () => {
    mockDeleteWorkout.mockRejectedValue(new Error('Server error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('delete-template-button')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByTestId('delete-template-button')[0]);
    fireEvent.click(screen.getByTestId('delete-template-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('delete-template-error')).toHaveTextContent('Server error');
    });
    // Template still present
    expect(screen.getAllByTestId('template-card')).toHaveLength(2);
  });

  it('Use Template still works', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTestId('use-template-button')).toHaveLength(2);
    });
    fireEvent.click(screen.getAllByTestId('use-template-button')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/activities/plan', expect.objectContaining({ state: expect.any(Object) }));
  });
});
