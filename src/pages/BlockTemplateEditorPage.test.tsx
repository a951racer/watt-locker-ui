/**
 * PLAN-058: BlockTemplateEditorPage tests — create/edit flows, repeat count,
 * step add/edit/remove/reorder, add-from-Step-Template COPY + independence,
 * and reuse of the canonical StepEditor.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BlockTemplateEditorPage from './BlockTemplateEditorPage';
import * as blockApi from '../api/blockTemplates';
import * as stepApi from '../api/stepTemplates';
import * as settingsApi from '../api/settings';

vi.mock('../api/blockTemplates', () => ({
  createBlockTemplate: vi.fn(),
  getBlockTemplate: vi.fn(),
  updateBlockTemplate: vi.fn(),
  deleteBlockTemplate: vi.fn(),
  listBlockTemplates: vi.fn(),
}));
vi.mock('../api/stepTemplates', () => ({
  listStepTemplates: vi.fn(),
}));
vi.mock('../api/settings', () => ({ getSettings: vi.fn() }));

const mockCreate = vi.mocked(blockApi.createBlockTemplate);
const mockGet = vi.mocked(blockApi.getBlockTemplate);
const mockUpdate = vi.mocked(blockApi.updateBlockTemplate);
const mockListStep = vi.mocked(stepApi.listStepTemplates);
const mockGetSettings = vi.mocked(settingsApi.getSettings);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/templates/blocks/new']}>
      <Routes>
        <Route path="/templates/blocks/new" element={<BlockTemplateEditorPage />} />
        <Route path="/templates/blocks/:id/edit" element={<BlockTemplateEditorPage />} />
        <Route path="/templates" element={<div>Library</div>} />
      </Routes>
    </MemoryRouter>,
  );
}
function renderEdit(id = 'blk-1') {
  return render(
    <MemoryRouter initialEntries={[`/templates/blocks/${id}/edit`]}>
      <Routes>
        <Route path="/templates/blocks/:id/edit" element={<BlockTemplateEditorPage />} />
        <Route path="/templates" element={<div>Library</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    userId: 'user-1', driveStoragePath: '/u', driveInboxPath: '/i', connectedSources: [],
    ftpHistory: [{ effectiveDate: '2024-01-01', ftpWatts: 250 }], timezone: 'America/Chicago', updatedAt: '2024-01-01',
  } as never);
  mockCreate.mockResolvedValue({ id: 'new-1' } as never);
  mockListStep.mockResolvedValue([]);
});

describe('BlockTemplateEditorPage', () => {
  it('renders name + repeat count + Add Step; no steps initially', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    expect(screen.getByTestId('template-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('repeat-count-input')).toBeInTheDocument();
    expect(screen.getByTestId('add-step-btn')).toBeInTheDocument();
    expect(screen.getByTestId('no-steps')).toBeInTheDocument();
  });

  it('requires a name and at least one step (submit disabled)', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    const submit = screen.getByTestId('submit-btn') as HTMLButtonElement;
    expect(submit.disabled).toBe(true); // no name, no steps
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: '3x Sweet Spot' } });
    expect((screen.getByTestId('submit-btn') as HTMLButtonElement).disabled).toBe(true); // still no steps
  });

  it('adds a blank step and edits it', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('add-step-btn'));
    fireEvent.click(screen.getByTestId('add-blank-step'));
    expect(screen.getByTestId('segment-0')).toBeInTheDocument();
    // Edit duration (step 0 is collapsed by default → expand)
    fireEvent.click(screen.getByTestId('segment-0'));
    expect(screen.getByTestId('segment-0-duration')).toBeInTheDocument();
  });

  it('creates a block with name, repeat count, and one step', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: '3x Sweet Spot' } });
    fireEvent.change(screen.getByTestId('repeat-count-input'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('add-step-btn'));
    fireEvent.click(screen.getByTestId('add-blank-step'));

    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.name).toBe('3x Sweet Spot');
    expect(payload.repeatCount).toBe(3);
    expect(payload.steps).toHaveLength(1);
    expect(payload.steps[0].durationType).toBe('time');
    expect(mockNavigate).toHaveBeenCalledWith('/templates');
  });

  it('removes a step', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('add-step-btn'));
    fireEvent.click(screen.getByTestId('add-blank-step'));
    expect(screen.getByTestId('segment-0')).toBeInTheDocument();
    // Collapsed card exposes a remove (✕) button.
    fireEvent.click(screen.getByTestId('segment-0-remove'));
    expect(screen.queryByTestId('segment-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-steps')).toBeInTheDocument();
  });

  it('reorders steps (move down swaps order)', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'B' } });
    // Add two blank steps and differentiate by type.
    fireEvent.click(screen.getByTestId('add-step-btn'));
    fireEvent.click(screen.getByTestId('add-blank-step'));
    fireEvent.click(screen.getByTestId('add-step-btn'));
    fireEvent.click(screen.getByTestId('add-blank-step'));
    // Expand step 0 and set its type to warmup, step 1 to cooldown.
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-type'), { target: { value: 'warmup' } });
    fireEvent.click(screen.getByTestId('segment-0')); // collapse
    fireEvent.click(screen.getByTestId('segment-1'));
    fireEvent.change(screen.getByTestId('segment-1-type'), { target: { value: 'cooldown' } });
    fireEvent.click(screen.getByTestId('segment-1')); // collapse
    // Move step 0 down.
    fireEvent.click(screen.getByTestId('segment-0-move-down'));

    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.steps.map((s) => s.type)).toEqual(['cooldown', 'warmup']);
  });

  it('adds a step FROM a Step Template by COPY, then editing it does not affect the source', async () => {
    mockListStep.mockResolvedValue([
      {
        id: 'st-1', userId: 'user-1', name: 'Sweet Spot',
        step: { name: 'Sweet Spot', type: 'interval', durationType: 'time', durationSeconds: 600, intensityMetric: 'power_ftp', powerMin: 88, powerMax: 92 },
        createdAt: '2024-06-01', updatedAt: '2024-06-02',
      },
    ] as never);

    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'From ST' } });

    fireEvent.click(screen.getByTestId('add-step-btn'));
    fireEvent.click(screen.getByTestId('add-from-step-template'));
    await waitFor(() => expect(mockListStep).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('step-template-option-st-1'));

    // The copied step is added and expanded for immediate editing.
    const card = await screen.findByTestId('segment-0');
    expect(within(card).getByTestId('segment-0-name')).toBeInTheDocument();
    // Edit the copied step's power min.
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '90' } });

    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const payload = mockCreate.mock.calls[0][0];
    // Block stores the EDITED copy (90), independent of the source template (88).
    expect(payload.steps[0].powerMin).toBe(90);
    expect(payload.steps[0].name).toBe('Sweet Spot');
    // No stepTemplateId reference is stored.
    expect((payload.steps[0] as unknown as Record<string, unknown>).stepTemplateId).toBeUndefined();
  });

  it('edit mode loads a block and saves updates', async () => {
    mockGet.mockResolvedValue({
      id: 'blk-1', userId: 'user-1', name: 'Original', repeatCount: 2,
      steps: [{ type: 'interval', durationType: 'time', durationSeconds: 300, intensityMetric: 'power_ftp', powerMin: 88, powerMax: 92 }],
      createdAt: '2024-06-01', updatedAt: '2024-06-02',
    } as never);
    mockUpdate.mockResolvedValue({ id: 'blk-1' } as never);

    renderEdit('blk-1');
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('blk-1'));
    const nameInput = screen.getByTestId('template-name-input') as HTMLInputElement;
    await waitFor(() => expect(nameInput.value).toBe('Original'));
    expect((screen.getByTestId('repeat-count-input') as HTMLInputElement).value).toBe('2');
    expect(screen.getByTestId('segment-0')).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Updated' } });
    fireEvent.change(screen.getByTestId('repeat-count-input'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][0]).toBe('blk-1');
    expect(mockUpdate.mock.calls[0][1].name).toBe('Updated');
    expect(mockUpdate.mock.calls[0][1].repeatCount).toBe(4);
    expect(mockNavigate).toHaveBeenCalledWith('/templates');
  });
});
