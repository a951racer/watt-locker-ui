/**
 * PLAN-059: Template tray + insertion tests (on the real PlanActivityPage).
 *
 * Verifies the left tray renders, collapses/reopens, lists Step + Block
 * Templates, handles loading/empty/error, and that clicking a template inserts
 * ordinary canonical segments into the existing planner (rendered by the
 * existing StepEditor / RepeatBlockEditor) and flows through the existing
 * create/save path.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PlanActivityPage from './PlanActivityPage';
import * as workoutsApi from '../api/workouts';
import * as settingsApi from '../api/settings';
import * as stepApi from '../api/stepTemplates';
import * as blockApi from '../api/blockTemplates';

vi.mock('../api/workouts', () => ({
  createActivity: vi.fn(),
  getWorkout: vi.fn(),
  updateWorkout: vi.fn(),
  createTemplate: vi.fn(),
}));
vi.mock('../api/settings', () => ({ getSettings: vi.fn() }));
vi.mock('../api/stepTemplates', () => ({ listStepTemplates: vi.fn() }));
vi.mock('../api/blockTemplates', () => ({ listBlockTemplates: vi.fn() }));

const mockCreateActivity = vi.mocked(workoutsApi.createActivity);
const mockGetSettings = vi.mocked(settingsApi.getSettings);
const mockListStep = vi.mocked(stepApi.listStepTemplates);
const mockListBlock = vi.mocked(blockApi.listBlockTemplates);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const sweetSpotStep = {
  id: 'st-1', userId: 'u1', name: 'Sweet Spot 10',
  step: { name: 'Sweet Spot', type: 'interval', durationType: 'time', durationSeconds: 600, intensityMetric: 'power_ftp', powerMin: 88, powerMax: 92 },
  createdAt: '2024-06-01', updatedAt: '2024-06-02',
};
const sweetSpotBlock = {
  id: 'bt-1', userId: 'u1', name: '3x Sweet Spot', repeatCount: 3,
  steps: [
    { type: 'warmup', durationType: 'time', durationSeconds: 300 },
    { type: 'interval', durationType: 'time', durationSeconds: 600, intensityMetric: 'power_ftp', powerMin: 88, powerMax: 92 },
  ],
  createdAt: '2024-06-01', updatedAt: '2024-06-02',
};

function renderPlanner() {
  return render(
    <MemoryRouter initialEntries={['/activities/plan?date=2024-06-15']}>
      <Routes>
        <Route path="/activities/plan" element={<PlanActivityPage />} />
        <Route path="/calendar" element={<div>Calendar</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    userId: 'u1', driveStoragePath: '/u', driveInboxPath: '/i', connectedSources: [],
    ftpHistory: [{ effectiveDate: '2024-01-01', ftpWatts: 250 }], timezone: 'America/Chicago', updatedAt: '2024-01-01',
  } as never);
  mockCreateActivity.mockResolvedValue({ id: 'a1', date: '2024-06-15', status: 'planned', activityType: 'ride' } as never);
  mockListStep.mockResolvedValue([sweetSpotStep] as never);
  mockListBlock.mockResolvedValue([sweetSpotBlock] as never);
});

describe('PlanActivityPage — template tray & insertion', () => {
  it('renders the tray and lists step + block templates', async () => {
    renderPlanner();
    await waitFor(() => expect(mockListStep).toHaveBeenCalled());
    expect(screen.getByTestId('template-tray')).toBeInTheDocument();
    expect(await screen.findByTestId('tray-step-st-1')).toHaveTextContent('Sweet Spot 10');
    expect(await screen.findByTestId('tray-block-bt-1')).toHaveTextContent('3x Sweet Spot');
  });

  it('collapses and reopens the tray', async () => {
    renderPlanner();
    await waitFor(() => expect(mockListStep).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('template-tray-collapse-btn'));
    expect(screen.getByTestId('template-tray-collapsed')).toBeInTheDocument();
    expect(screen.queryByTestId('template-tray')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('template-tray-expand-btn'));
    expect(screen.getByTestId('template-tray')).toBeInTheDocument();
  });

  it('shows empty states when the user has no templates', async () => {
    mockListStep.mockResolvedValue([] as never);
    mockListBlock.mockResolvedValue([] as never);
    renderPlanner();
    expect(await screen.findByTestId('tray-step-templates-empty')).toBeInTheDocument();
    expect(await screen.findByTestId('tray-block-templates-empty')).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    mockListStep.mockRejectedValue(new Error('boom'));
    mockListBlock.mockRejectedValue(new Error('boom'));
    renderPlanner();
    expect(await screen.findByTestId('template-tray-error')).toBeInTheDocument();
  });

  it('clicking a Step Template inserts one standalone step into the planner', async () => {
    renderPlanner();
    fireEvent.click(await screen.findByTestId('tray-step-st-1'));
    // A single step card appears (rendered by the existing StepEditor machinery).
    expect(await screen.findByTestId('segment-0')).toBeInTheDocument();
    expect(screen.queryByTestId('segment-1')).not.toBeInTheDocument();
    // Inserted values are visible in the existing planner UI (expanded on insert).
    const card = screen.getByTestId('segment-0');
    expect(within(card).getByTestId('segment-0-name')).toHaveValue('Sweet Spot');
    // It is NOT a repeat block.
    expect(screen.queryByTestId(/^repeat-block-/)).not.toBeInTheDocument();
  });

  it('clicking a Block Template inserts a repeat block using the default repeat count', async () => {
    renderPlanner();
    fireEvent.click(await screen.findByTestId('tray-block-bt-1'));
    // Two child steps appear.
    expect(await screen.findByTestId('segment-0')).toBeInTheDocument();
    expect(screen.getByTestId('segment-1')).toBeInTheDocument();
    // A repeat block wrapper is rendered with the template's default count (3).
    const block = document.querySelector('[data-testid^="repeat-block-"]');
    expect(block).not.toBeNull();
    const countInput = block!.querySelector('[data-testid^="repeat-block-count-"]') as HTMLInputElement;
    expect(countInput.value).toBe('3');
  });

  it('inserted block flows through the existing create/save path as ordinary segments', async () => {
    renderPlanner();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('tray-block-bt-1'));
    await screen.findByTestId('segment-1');

    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => expect(mockCreateActivity).toHaveBeenCalled());
    const payload = mockCreateActivity.mock.calls[0][0] as { segments?: Array<Record<string, unknown>> };
    expect(payload.segments).toHaveLength(2);
    // Both steps share one repeatId and carry repeatCount 3; no template reference.
    const rid0 = payload.segments![0].repeatId;
    expect(rid0).toBeTruthy();
    expect(payload.segments![1].repeatId).toBe(rid0);
    expect(payload.segments![0].repeatCount).toBe(3);
    expect(payload.segments![0].stepTemplateId).toBeUndefined();
    expect(payload.segments![0].blockTemplateId).toBeUndefined();
  });

  it('existing manual add-step still works alongside the tray', async () => {
    renderPlanner();
    await waitFor(() => expect(mockListStep).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    expect(await screen.findByTestId('segment-0')).toBeInTheDocument();
  });
});
