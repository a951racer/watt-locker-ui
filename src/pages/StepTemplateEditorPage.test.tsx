/**
 * PLAN-057: StepTemplateEditorPage tests — create/edit flows, template name
 * required, and confirmation that the reused StepEditor behaviors work here.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StepTemplateEditorPage from './StepTemplateEditorPage';
import * as stepTemplatesApi from '../api/stepTemplates';
import * as settingsApi from '../api/settings';

vi.mock('../api/stepTemplates', () => ({
  createStepTemplate: vi.fn(),
  getStepTemplate: vi.fn(),
  updateStepTemplate: vi.fn(),
  deleteStepTemplate: vi.fn(),
  listStepTemplates: vi.fn(),
}));

vi.mock('../api/settings', () => ({
  getSettings: vi.fn(),
}));

const mockCreate = vi.mocked(stepTemplatesApi.createStepTemplate);
const mockGet = vi.mocked(stepTemplatesApi.getStepTemplate);
const mockUpdate = vi.mocked(stepTemplatesApi.updateStepTemplate);
const mockGetSettings = vi.mocked(settingsApi.getSettings);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/templates/steps/new']}>
      <Routes>
        <Route path="/templates/steps/new" element={<StepTemplateEditorPage />} />
        <Route path="/templates/steps/:id/edit" element={<StepTemplateEditorPage />} />
        <Route path="/templates" element={<div>Library</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEdit(id = 'tpl-1') {
  return render(
    <MemoryRouter initialEntries={[`/templates/steps/${id}/edit`]}>
      <Routes>
        <Route path="/templates/steps/:id/edit" element={<StepTemplateEditorPage />} />
        <Route path="/templates" element={<div>Library</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StepTemplateEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({
      userId: 'user-1',
      driveStoragePath: '/u',
      driveInboxPath: '/i',
      connectedSources: [],
      ftpHistory: [{ effectiveDate: '2024-01-01', ftpWatts: 250 }],
      timezone: 'America/Chicago',
      updatedAt: '2024-01-01',
    } as never);
    mockCreate.mockResolvedValue({ id: 'new-1' } as never);
  });

  it('renders the new-template editor with a template name field and the StepEditor', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    expect(screen.getByTestId('template-name-input')).toBeInTheDocument();
    // Reused StepEditor renders its canonical fields (step index 0).
    expect(screen.getByTestId('segment-0-name')).toBeInTheDocument();
    expect(screen.getByTestId('segment-0-duration-type')).toBeInTheDocument();
    expect(screen.getByTestId('segment-0-duration')).toBeInTheDocument();
    expect(screen.getByTestId('segment-0-metric')).toBeInTheDocument();
  });

  it('requires a template name (submit disabled / does not create)', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    const submit = screen.getByTestId('submit-btn') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a step template with the template name and canonical step (time)', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'Sweet Spot 10' } });
    // Optional canonical step name (distinct from template name).
    fireEvent.change(screen.getByTestId('segment-0-name'), { target: { value: 'Sweet Spot' } });
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '10:00' } });

    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());

    const payload = mockCreate.mock.calls[0][0];
    expect(payload.name).toBe('Sweet Spot 10');
    expect(payload.step.name).toBe('Sweet Spot');
    expect(payload.step.durationType).toBe('time');
    expect(payload.step.durationSeconds).toBe(600);
    expect(payload.step.distanceMeters).toBeUndefined();
    expect(mockNavigate).toHaveBeenCalledWith('/templates');
  });

  it('supports a distance step; switching time→distance clears the time value', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: '5k Effort' } });
    // Switch to distance and enter miles.
    fireEvent.change(screen.getByTestId('segment-0-duration-type'), { target: { value: 'distance' } });
    fireEvent.change(screen.getByTestId('segment-0-distance'), { target: { value: '1' } });

    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());

    const payload = mockCreate.mock.calls[0][0];
    expect(payload.step.durationType).toBe('distance');
    expect(payload.step.distanceMeters).toBe(1609);
    expect(payload.step.durationSeconds).toBeUndefined();
  });

  it('preserves intensity editing (per-step metric)', async () => {
    renderNew();
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'Watts Step' } });
    fireEvent.change(screen.getByTestId('segment-0-metric'), { target: { value: 'power_watts' } });
    fireEvent.click(screen.getByTestId('submit-btn'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0].step.intensityMetric).toBe('power_watts');
  });

  it('edit mode loads the template and saves updates', async () => {
    mockGet.mockResolvedValue({
      id: 'tpl-1',
      userId: 'user-1',
      name: 'Original',
      step: { type: 'interval', durationType: 'time', durationSeconds: 300, intensityMetric: 'power_ftp', powerMin: 88, powerMax: 92 },
      createdAt: '2024-06-01',
      updatedAt: '2024-06-02',
    } as never);
    mockUpdate.mockResolvedValue({ id: 'tpl-1' } as never);

    renderEdit('tpl-1');
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('tpl-1'));

    const nameInput = screen.getByTestId('template-name-input') as HTMLInputElement;
    await waitFor(() => expect(nameInput.value).toBe('Original'));

    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][0]).toBe('tpl-1');
    expect(mockUpdate.mock.calls[0][1].name).toBe('Updated Name');
    expect(mockNavigate).toHaveBeenCalledWith('/templates');
  });
});
