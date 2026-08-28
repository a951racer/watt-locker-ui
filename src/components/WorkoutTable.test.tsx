import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import WorkoutTable from './WorkoutTable';
import type { WorkoutTableRow } from '../types/workout';

const mockWorkouts: WorkoutTableRow[] = [
  {
    id: '1',
    date: '2024-03-15',
    dateRaw: '2024-03-15T08:00:00Z',
    name: 'Morning Ride',
    duration: '1h 30m',
    durationRaw: 5400,
    distance: '40.2 km',
    distanceRaw: 40200,
    avgSpeed: '15.3 mph',
    avgSpeedRaw: 6.84,
    avgPower: '220 W',
    avgPowerRaw: 220,
    normalizedPower: '235 W',
    normalizedPowerRaw: 235,
  },
  {
    id: '2',
    date: '2024-03-14',
    dateRaw: '2024-03-14T09:00:00Z',
    name: 'Interval Session',
    duration: '0h 45m',
    durationRaw: 2700,
    distance: '20.1 km',
    distanceRaw: 20100,
    avgSpeed: '16.1 mph',
    avgSpeedRaw: 7.2,
    avgPower: '280 W',
    avgPowerRaw: 280,
    normalizedPower: '310 W',
    normalizedPowerRaw: 310,
  },
];

function renderTable(props?: Partial<React.ComponentProps<typeof WorkoutTable>>) {
  const defaultProps = {
    workouts: mockWorkouts,
    sortBy: 'date',
    sortOrder: 'desc' as const,
    onSort: vi.fn(),
    onRowClick: vi.fn(),
  };

  return render(
    <MemoryRouter>
      <WorkoutTable {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe('WorkoutTable', () => {
  it('renders all column headers', () => {
    renderTable();

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Moving Time')).toBeInTheDocument();
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('Avg Power')).toBeInTheDocument();
    expect(screen.getByText('Normalized Power')).toBeInTheDocument();
  });

  it('renders workout data rows', () => {
    renderTable();

    expect(screen.getByText('Morning Ride')).toBeInTheDocument();
    expect(screen.getByText('Interval Session')).toBeInTheDocument();
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByText('40.2 km')).toBeInTheDocument();
    expect(screen.getByText('220 W')).toBeInTheDocument();
  });

  it('calls onSort when a column header is clicked', () => {
    const onSort = vi.fn();
    renderTable({ onSort });

    fireEvent.click(screen.getByText('Title'));
    expect(onSort).toHaveBeenCalledWith('name');

    fireEvent.click(screen.getByText('Moving Time'));
    expect(onSort).toHaveBeenCalledWith('duration');
  });

  it('displays sort indicator on the active sort column', () => {
    renderTable({ sortBy: 'date', sortOrder: 'desc' });

    const dateHeader = screen.getByText('Date').closest('th');
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    expect(dateHeader?.textContent).toContain('▼');
  });

  it('displays ascending sort indicator', () => {
    renderTable({ sortBy: 'name', sortOrder: 'asc' });

    const nameHeader = screen.getByText('Title').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(nameHeader?.textContent).toContain('▲');
  });

  it('renders Name column as clickable links to workout detail', () => {
    renderTable();

    const morningRideLink = screen.getByText('Morning Ride');
    expect(morningRideLink.closest('a')).toHaveAttribute('href', '/workouts/1');

    const intervalLink = screen.getByText('Interval Session');
    expect(intervalLink.closest('a')).toHaveAttribute('href', '/workouts/2');
  });

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });

    const row = screen.getByText('Morning Ride').closest('tr');
    fireEvent.click(row!);
    expect(onRowClick).toHaveBeenCalledWith('1');
  });

  it('does not call onRowClick when the Name link is clicked', () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });

    const link = screen.getByText('Morning Ride');
    fireEvent.click(link);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('has overflow-x-auto for horizontal scrolling', () => {
    const { container } = renderTable();
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('overflow-x-auto');
  });
});
