import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import AuthenticatedLayout from './AuthenticatedLayout';
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
];

describe('Responsive Layout - Requirement 11', () => {
  describe('11.1 - Desktop viewport (1024px+)', () => {
    it('AuthenticatedLayout uses flex column with min-h-screen', () => {
      const { container } = render(
        <MemoryRouter>
          <AuthenticatedLayout>
            <div>Content</div>
          </AuthenticatedLayout>
        </MemoryRouter>
      );

      const layoutRoot = container.firstElementChild;
      expect(layoutRoot).toHaveClass('flex', 'flex-col', 'min-h-screen');
    });

    it('NavigationBar uses full width without fixed pixel widths', () => {
      render(
        <MemoryRouter>
          <AuthenticatedLayout>
            <div>Content</div>
          </AuthenticatedLayout>
        </MemoryRouter>
      );

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('w-full');
    });

    it('main content area uses flex-1 to fill remaining space', () => {
      const { container } = render(
        <MemoryRouter>
          <AuthenticatedLayout>
            <div>Content</div>
          </AuthenticatedLayout>
        </MemoryRouter>
      );

      const main = container.querySelector('main');
      expect(main).toHaveClass('flex-1');
    });
  });

  describe('11.2 - WorkoutTable horizontal scrolling', () => {
    it('table wrapper has overflow-x-auto for horizontal scrolling', () => {
      const { container } = render(
        <MemoryRouter>
          <WorkoutTable
            workouts={mockWorkouts}
            sortBy="date"
            sortOrder="desc"
            onSort={() => {}}
            onRowClick={() => {}}
          />
        </MemoryRouter>
      );

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('overflow-x-auto');
    });

    it('table has min-width to trigger scrolling on narrow viewports', () => {
      const { container } = render(
        <MemoryRouter>
          <WorkoutTable
            workouts={mockWorkouts}
            sortBy="date"
            sortOrder="desc"
            onSort={() => {}}
            onRowClick={() => {}}
          />
        </MemoryRouter>
      );

      const table = container.querySelector('table');
      expect(table).toHaveClass('min-w-[700px]');
    });
  });

  describe('11.3 - Floating Panel centering', () => {
    it('LoginPage container uses flex centering for the floating panel', async () => {
      // We test the LoginPage structure by importing it directly
      const { default: LoginPage } = await import('../pages/LoginPage');
      const { container } = render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      const outerContainer = container.firstElementChild;
      expect(outerContainer).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');
    });

    it('Floating panel has max-width and horizontal margin for narrow viewports', async () => {
      const { default: LoginPage } = await import('../pages/LoginPage');
      const { container } = render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      );

      const outerContainer = container.firstElementChild;
      const panel = outerContainer?.firstElementChild;
      expect(panel).toHaveClass('w-full', 'max-w-md', 'mx-4');
    });
  });
});
