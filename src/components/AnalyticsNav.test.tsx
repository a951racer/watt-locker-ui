import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import AnalyticsNav from './AnalyticsNav';

describe('AnalyticsNav', () => {
  it('renders the 5 analytics items in exact order', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AnalyticsNav />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Analytics' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Dashboard',
      'Workouts',
      'Power',
      'Trends',
      'Training Log',
    ]);
  });

  it('highlights the active item based on the current route', () => {
    render(
      <MemoryRouter initialEntries={['/power']}>
        <AnalyticsNav />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Analytics' });
    expect(within(nav).getByText('Power')).toHaveClass('text-electricBlue');
    expect(within(nav).getByText('Dashboard')).toHaveClass('text-softFog');
  });
});
