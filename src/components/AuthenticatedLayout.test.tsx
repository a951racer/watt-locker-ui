import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import AuthenticatedLayout from './AuthenticatedLayout';
import { useAuthStore } from '../store/authStore';

describe('AuthenticatedLayout - Analytics secondary rail', () => {
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

  it('renders the AnalyticsNav rail on an analytics route', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthenticatedLayout>
          <div>Content</div>
        </AuthenticatedLayout>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('navigation', { name: 'Analytics' })
    ).toBeInTheDocument();
  });

  it('does not render the AnalyticsNav rail on a non-analytics route', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <AuthenticatedLayout>
          <div>Content</div>
        </AuthenticatedLayout>
      </MemoryRouter>
    );

    expect(
      screen.queryByRole('navigation', { name: 'Analytics' })
    ).not.toBeInTheDocument();
  });

  it('does not render the AnalyticsNav rail on the templates route', () => {
    render(
      <MemoryRouter initialEntries={['/templates']}>
        <AuthenticatedLayout>
          <div>Content</div>
        </AuthenticatedLayout>
      </MemoryRouter>
    );

    expect(
      screen.queryByRole('navigation', { name: 'Analytics' })
    ).not.toBeInTheDocument();
  });
});
