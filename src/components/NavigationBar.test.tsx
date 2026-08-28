import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import NavigationBar from './NavigationBar';
import { useAuthStore } from '../store/authStore';

describe('NavigationBar', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('renders primary nav items in order: Calendar, Analytics, Locker, Templates, Admin, Logout', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <NavigationBar />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation');
    const list = within(nav).getByRole('list');
    const labels = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent);

    expect(labels).toEqual(['Calendar', 'Analytics', 'Locker', 'Templates', 'Admin', 'Logout']);
  });

  it('exposes Templates as a link to the templates page', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <NavigationBar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Templates' })).toHaveAttribute('href', '/templates');
  });

  it('marks Templates active on the templates route and NOT Analytics', () => {
    render(
      <MemoryRouter initialEntries={['/templates']}>
        <NavigationBar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Templates' })).toHaveClass('text-electricBlue');
    expect(screen.getByRole('link', { name: 'Analytics' })).not.toHaveClass('text-electricBlue');
  });

  it('exposes Analytics as a link to the dashboard landing', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <NavigationBar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });

  it('exposes a Logout control', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <NavigationBar />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it('marks Analytics active on an analytics route', () => {
    render(
      <MemoryRouter initialEntries={['/trends']}>
        <NavigationBar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveClass(
      'text-electricBlue'
    );
  });
});
