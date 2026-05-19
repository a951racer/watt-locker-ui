# Implementation Plan: Watt Locker UI

## Overview

Build a React 18 + TypeScript single-page application using Vite, Zustand, Tailwind CSS, and React Router v6. The implementation proceeds incrementally: project scaffolding → theming → API layer → state management → shared components → pages → testing. Each step produces working, integrated code.

## Tasks

- [x] 1. Initialize project and configure tooling
  - [x] 1.1 Scaffold Vite + React + TypeScript project in `watt-locker-ui/` folder
    - Run `npm create vite@latest watt-locker-ui -- --template react-ts`
    - Install dependencies: `react-router-dom`, `zustand`, `axios`, `tailwindcss`, `postcss`, `autoprefixer`
    - Install dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `fast-check`, `msw`
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 1.2 Configure Tailwind CSS with custom color palette
    - Initialize Tailwind (`npx tailwindcss init -p`)
    - Add custom colors to `tailwind.config.ts`: deepNavy (#061B38), midnightBlue (#0D2A4F), steelBlue (#2E4767), electricBlue (#1E7EF2), brightCyan (#3FA9FF), softFog (#7E93AD), lightSilver (#D9E1EA), pureWhite (#FFFFFF)
    - Configure `index.css` with Tailwind directives and base styles
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 Configure Vitest for testing
    - Create `vitest.config.ts` with jsdom environment and globals
    - Create `src/test/setup.ts` with testing-library matchers
    - _Requirements: 1.1_

  - [x] 1.4 Initialize Git repository
    - Run `git init` in `watt-locker-ui/`
    - Create `.gitignore` for Node/Vite projects
    - Make initial commit
    - _Requirements: 1.4_

- [x] 2. Create type definitions and utility functions
  - [x] 2.1 Define TypeScript interfaces for data models
    - Create `src/types/auth.ts` with `UserProfile` and `AuthResult` interfaces
    - Create `src/types/workout.ts` with `WorkoutRecord`, `WorkoutTableRow`, and `PaginationMeta` interfaces
    - Create `src/types/settings.ts` with `UserSettings` and `ConnectedSource` interfaces
    - _Requirements: 6.3, 7.3_

  - [x] 2.2 Implement formatting utility functions
    - Create `src/utils/formatting.ts` with functions: `formatDate`, `formatDuration`, `formatDistance`, `formatPower`
    - Implement `toWorkoutTableRow(record: WorkoutRecord): WorkoutTableRow` that maps raw records to display rows
    - Ensure all fields produce non-empty strings for valid inputs
    - _Requirements: 6.3_

  - [ ]* 2.3 Write property test for workout formatting (Property 1)
    - **Property 1: Workout record formatting produces complete table rows**
    - Generate arbitrary valid WorkoutRecord objects with fast-check
    - Assert all fields of resulting WorkoutTableRow are non-empty strings
    - Minimum 100 iterations
    - **Validates: Requirements 6.3**

  - [x] 2.4 Implement sorting utility functions
    - Create `src/utils/sorting.ts` with `sortWorkouts(rows: WorkoutTableRow[], column: string, order: 'asc' | 'desc'): WorkoutTableRow[]`
    - Support sorting by all table columns (date, name, duration, distance, avgPower, normalizedPower)
    - _Requirements: 6.4, 6.5_

  - [ ]* 2.5 Write property test for sorting (Property 2)
    - **Property 2: Sorting produces correctly ordered results**
    - Generate arbitrary lists of WorkoutTableRow and arbitrary sort column/direction
    - Assert adjacent pairs are ordered correctly per sort direction
    - Minimum 100 iterations
    - **Validates: Requirements 6.4**

  - [x] 2.6 Implement pagination utility functions
    - Create pagination helpers: `computeTotalPages(totalItems: number, pageSize: number): number` and `getPageBounds(page: number, pageSize: number, totalItems: number): { start: number; end: number }`
    - _Requirements: 6.6, 6.7_

  - [ ]* 2.7 Write property test for pagination (Property 3)
    - **Property 3: Pagination computes correct page boundaries**
    - Generate arbitrary totalItems (N ≥ 0) and verify totalPages = ceil(N/25)
    - For valid page numbers, verify at most 25 items per page and sum across all pages equals N
    - Minimum 100 iterations
    - **Validates: Requirements 6.6**

  - [x] 2.8 Implement navigation active-state resolver
    - Create `src/utils/navigation.ts` with `getActiveNavItem(pathname: string): string | null`
    - Map routes to nav items: /dashboard → 'dashboard', /locker → 'locker', /admin → 'admin', /workouts/:id → null
    - _Requirements: 4.4_

  - [ ]* 2.9 Write property test for navigation state (Property 4)
    - **Property 4: Active navigation state matches current route**
    - Generate arbitrary valid route paths from the set of authenticated routes
    - Assert exactly one active nav item for top-level routes, null for detail routes
    - Minimum 100 iterations
    - **Validates: Requirements 4.4**

- [x] 3. Checkpoint - Verify utilities and property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Build API client layer
  - [x] 4.1 Create Axios instance with interceptors
    - Create `src/api/client.ts` with base URL configuration
    - Add request interceptor to attach Authorization header from auth store
    - Add response interceptor to handle 401 with token refresh and request retry
    - _Requirements: 3.6, 3.9, 3.10_

  - [x] 4.2 Implement API modules
    - Create `src/api/auth.ts` with `login`, `register`, `refreshToken` functions
    - Create `src/api/workouts.ts` with `listWorkouts`, `getWorkout`, `uploadWorkout`, `uploadBulk`, `ingestFromInbox` functions
    - Create `src/api/settings.ts` with `getSettings`, `updateSettings` functions
    - _Requirements: 3.6, 6.2, 8.2_

- [x] 5. Implement Zustand state stores
  - [x] 5.1 Create auth store
    - Create `src/store/authStore.ts` with `AuthState` interface
    - Implement `login`, `register`, `logout`, `refresh` actions
    - Persist tokens to localStorage for session continuity
    - _Requirements: 3.6, 3.10_

  - [x] 5.2 Create workout store
    - Create `src/store/workoutStore.ts` with `WorkoutState` interface
    - Implement `fetchWorkouts`, `fetchWorkout`, `setSort`, `setPage` actions
    - Default sort: date descending, page size: 25
    - _Requirements: 6.2, 6.4, 6.5, 6.6_

  - [x] 5.3 Create settings store
    - Create `src/store/settingsStore.ts` with `SettingsState` interface
    - Implement `fetchSettings`, `updateSettings` actions
    - _Requirements: 9.2, 9.3_

- [x] 6. Build shared components
  - [x] 6.1 Create placeholder assets
    - Create SVG placeholder files in `public/assets/`: `placeholder-login-bg.svg`, `placeholder-logo-rect.svg`, `placeholder-logo-square.svg`, `placeholder-wallpaper.svg`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 6.2 Implement NavigationBar component
    - Create `src/components/NavigationBar.tsx` with square logo, nav links (Dashboard, Locker, Admin)
    - Use `getActiveNavItem` utility to highlight active link
    - Apply Electric Blue accent for active state indicator
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.3 Implement ProtectedRoute component
    - Create `src/components/ProtectedRoute.tsx` that checks auth store
    - Redirect to `/login` if not authenticated
    - _Requirements: 4.1, 4.5_

  - [x] 6.4 Implement AuthenticatedLayout component
    - Create `src/components/AuthenticatedLayout.tsx` wrapping children with NavigationBar and wallpaper background
    - Apply tile-able wallpaper using CSS background-repeat
    - _Requirements: 5.1, 5.3_

  - [x] 6.5 Implement WorkoutTable component
    - Create `src/components/WorkoutTable.tsx` with sortable column headers
    - Display columns: Date, Name, Duration, Distance, Avg Power, Normalized Power
    - Clickable Name column navigates to workout detail
    - Support horizontal scrolling on narrow viewports
    - _Requirements: 6.3, 6.4, 6.8, 11.2_

  - [x] 6.6 Implement Pagination component
    - Create `src/components/Pagination.tsx` with page navigation controls
    - Display current page, total pages, and prev/next buttons
    - _Requirements: 6.6, 6.7_

- [x] 7. Implement page components and routing
  - [x] 7.1 Implement LoginPage
    - Create `src/pages/LoginPage.tsx` with custom background, centered floating panel
    - Include rectangular logo, email input, password input, login button, register link, password reset link
    - Display error messages on invalid credentials
    - Navigate to `/dashboard` on successful login
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.2_

  - [x] 7.2 Implement DashboardPage
    - Create `src/pages/DashboardPage.tsx` that fetches workouts on mount
    - Render WorkoutTable and Pagination components
    - Wire sort and page change handlers to workout store
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 7.3 Implement LockerPage
    - Create `src/pages/LockerPage.tsx` with file upload UI
    - Provide options for single file upload, bulk upload, and inbox ingestion
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 7.4 Implement AdminPage
    - Create `src/pages/AdminPage.tsx` with settings form
    - Include Google Drive path configuration fields
    - Include user administration section
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.5 Implement WorkoutDetailPage
    - Create `src/pages/WorkoutDetailPage.tsx` that fetches workout by route param `:id`
    - Display workout details (all available fields from WorkoutRecord)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 7.6 Configure React Router and App component
    - Create `src/App.tsx` with route definitions
    - Set up routes: `/login`, `/dashboard`, `/locker`, `/admin`, `/workouts/:id`
    - Wrap authenticated routes with ProtectedRoute and AuthenticatedLayout
    - Root `/` redirects to `/dashboard` if authenticated, `/login` otherwise
    - _Requirements: 1.5, 4.1, 6.1_

- [x] 8. Checkpoint - Verify full application renders
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Responsive layout and polish
  - [x] 9.1 Ensure responsive behavior
    - Verify Floating_Panel remains centered on all viewport widths
    - Verify WorkoutTable supports horizontal scrolling on narrow viewports
    - Verify layout renders correctly at 1024px and above
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 9.2 Write unit tests for key components
    - Test LoginPage renders form fields and handles submission
    - Test NavigationBar renders links and highlights active page
    - Test WorkoutTable renders columns and handles sort clicks
    - Test ProtectedRoute redirects unauthenticated users
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 3.9, 4.3, 4.4, 6.3, 6.4_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific component rendering and user interactions
- The API layer uses Axios interceptors for transparent auth token management
- Placeholder SVG assets allow full layout development before final branding assets arrive
