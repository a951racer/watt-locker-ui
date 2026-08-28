/**
 * PLAN-040 Test 5: Frontend shows fallback warning
 *
 * Verifies that the LockerPage correctly distinguishes between:
 * - Successful upload with Drive archival
 * - Successful upload with Drive fallback (degraded archival)
 * - Duplicate detection
 * - Upload failure
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import LockerPage from './LockerPage';

// Mock the workouts API module
vi.mock('../api/workouts', () => ({
  uploadWorkout: vi.fn(),
  uploadBulk: vi.fn(),
  ingestFromInbox: vi.fn(),
}));

import { uploadWorkout } from '../api/workouts';

const mockUploadWorkout = vi.mocked(uploadWorkout);

function createFile(name: string): File {
  return new File(['fake-fit-data'], name, { type: 'application/octet-stream' });
}

describe('PLAN-040 Test 5: LockerPage Drive Fallback Warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows success message when upload succeeds with Drive archival', async () => {
    mockUploadWorkout.mockResolvedValue({
      workoutId: 'w1',
      driveFileId: 'drive-abc',
      summary: { activityType: 'ride', startTime: '2027-03-10T08:00:00Z', durationSeconds: 5400, distanceMeters: 42000 },
      archival: 'drive',
    });

    render(<LockerPage />);

    const input = screen.getByLabelText('Single file upload');
    fireEvent.change(input, { target: { files: [createFile('ride.fit')] } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('"ride.fit" uploaded successfully.');
      // Should NOT mention Drive failure
      expect(alert).not.toHaveTextContent('could not be archived to Google Drive');
    });
  });

  it('shows fallback warning when Drive archival fails but ingestion succeeds', async () => {
    mockUploadWorkout.mockResolvedValue({
      workoutId: 'w2',
      driveFileId: 'local',
      summary: { activityType: 'ride', startTime: '2027-03-10T08:00:00Z', durationSeconds: 5400, distanceMeters: 42000 },
      archival: 'fallback',
    });

    render(<LockerPage />);

    const input = screen.getByLabelText('Single file upload');
    fireEvent.change(input, { target: { files: [createFile('ride.fit')] } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      // Must communicate: ingestion succeeded
      expect(alert).toHaveTextContent('uploaded successfully');
      // Must communicate: Drive archival did not succeed
      expect(alert).toHaveTextContent('could not be archived to Google Drive');
      // Must communicate: source file was retained safely
      expect(alert).toHaveTextContent('retained safely');
    });
  });

  it('fallback warning is NOT displayed as an error', async () => {
    mockUploadWorkout.mockResolvedValue({
      workoutId: 'w3',
      driveFileId: 'local',
      summary: { activityType: 'ride', startTime: '2027-03-10T08:00:00Z', durationSeconds: 5400, distanceMeters: 42000 },
      archival: 'fallback',
    });

    render(<LockerPage />);

    const input = screen.getByLabelText('Single file upload');
    fireEvent.change(input, { target: { files: [createFile('ride.fit')] } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      // The fallback state should use success styling (green), not error styling (red)
      expect(alert.className).toContain('green');
      expect(alert.className).not.toContain('red');
    });
  });

  it('shows duplicate message when source was already imported', async () => {
    mockUploadWorkout.mockResolvedValue({
      workoutId: 'w-existing',
      driveFileId: 'drive-existing',
      summary: { activityType: 'ride', startTime: '2027-03-10T08:00:00Z', durationSeconds: 5400, distanceMeters: 42000 },
      duplicate: true,
    });

    render(<LockerPage />);

    const input = screen.getByLabelText('Single file upload');
    fireEvent.change(input, { target: { files: [createFile('ride.fit')] } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('already been imported');
      // Should NOT show fallback warning
      expect(alert).not.toHaveTextContent('could not be archived to Google Drive');
      // Should NOT show generic success
      expect(alert).not.toHaveTextContent('uploaded successfully');
    });
  });

  it('shows error message when upload truly fails', async () => {
    mockUploadWorkout.mockRejectedValue(new Error('Network error'));

    render(<LockerPage />);

    const input = screen.getByLabelText('Single file upload');
    fireEvent.change(input, { target: { files: [createFile('ride.fit')] } });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Failed to upload');
      // Error styling
      expect(alert.className).toContain('red');
    });
  });
});
