# Requirements Document

## Introduction

Watt Locker UI is a React-based single-page application for a fitness/cycling platform. The application provides workout tracking, data management, performance analytics, and administration capabilities. It features a dark navy-themed design with a login page, registration page, dashboard with sortable/paginated workout tables and performance charts, data loading page (single upload, bulk upload, inbox ingestion), admin settings page, and workout detail views. The UI communicates with the Watt Locker API backend and integrates with Google Drive for file storage.

## Glossary

- **Application**: The Watt Locker UI React single-page application
- **Login_Page**: The authentication page where users enter credentials to access the application
- **Register_Page**: The registration page where new users create an account
- **Dashboard**: The main home page displaying performance charts and a sortable workout table
- **Locker_Page**: The page providing options for loading workout files into the system
- **Admin_Page**: The page for configuring system settings, paths, and user administration
- **Workout_Detail_Page**: The page displaying detailed information about a single workout with editable fields
- **Navigation_Bar**: The persistent navigation component displayed on all authenticated pages
- **Floating_Panel**: A centered, elevated card component on the Login/Register pages containing authentication controls
- **Workout_Table**: The paginated, sortable table on the Dashboard displaying workout records
- **Performance_Charts**: Line and bar charts on the Dashboard showing weekly training metrics
- **Color_Palette**: The defined set of brand colors used throughout the application
- **Wallpaper**: A tile-able background image applied to all pages except the Login/Register pages
- **State_Manager**: The centralized state management solution (Zustand) used across the application
- **NP**: Normalized Power - a weighted average power metric computed from 30-second rolling averages
- **TSS**: Training Stress Score - a measure of workout intensity relative to FTP
- **Aerobic_Decoupling**: The percentage drift between first-half and second-half power:HR ratio

## Requirements

### Requirement 1: Project Setup and Architecture

**User Story:** As a developer, I want the project initialized as a React application with state management and modern styling, so that the codebase is maintainable and follows industry best practices.

#### Acceptance Criteria

1. THE Application SHALL be built using React as the UI framework
2. THE Application SHALL use Zustand for centralized state management
3. THE Application SHALL use Tailwind CSS v4 for utility-based styling
4. THE Application SHALL be initialized as a Git repository in the `watt-locker-ui` folder
5. THE Application SHALL implement client-side routing using React Router v6
6. THE Application SHALL use Vite as the build tool
7. THE Application SHALL use Axios with interceptors for API communication
8. THE Application SHALL support deployment to Heroku as a static site
9. THE Application SHALL use environment variables (VITE_API_URL) for API base URL configuration

### Requirement 2: Color Palette and Theming

**User Story:** As a user, I want a consistent dark navy-themed visual design, so that the application has a professional and cohesive appearance.

#### Acceptance Criteria

1. THE Application SHALL define a theme using the following colors: Deep Navy Background (#061B38), Midnight Blue (#0D2A4F), Steel Blue (#2E4767), Electric Blue Accent (#1E7EF2), Bright Cyan-Blue Highlight (#3FA9FF), Soft Fog Blue (#7E93AD), Light Silver (#D9E1EA), and Pure White (#FFFFFF)
2. THE Application SHALL apply the Deep Navy Background (#061B38) as the primary background color
3. THE Application SHALL use the Electric Blue Accent (#1E7EF2) for primary interactive elements
4. THE Application SHALL use the Light Silver (#D9E1EA) and Pure White (#FFFFFF) for text content on dark backgrounds

### Requirement 3: Login Page

**User Story:** As a user, I want a login page with authentication fields and account options, so that I can securely access the application.

#### Acceptance Criteria

1. THE Login_Page SHALL display a custom background graphic (Watt-Locker-Login-Background.png)
2. THE Login_Page SHALL display a Floating_Panel centered on the page containing all authentication controls
3. THE Floating_Panel SHALL display a rectangular logo image (Watt-Locker-Logo.png) at the top
4. THE Floating_Panel SHALL display an email input field (type="email")
5. THE Floating_Panel SHALL display a password input field (type="password")
6. THE Floating_Panel SHALL display a login button that submits the credentials
7. THE Floating_Panel SHALL display a registration link navigating to the Register_Page
8. THE Floating_Panel SHALL display a password reset link
9. IF the login credentials are invalid, THEN THE Login_Page SHALL display an error message to the user
10. WHEN the user submits valid credentials, THE Login_Page SHALL navigate the user to the Dashboard

### Requirement 3b: Registration Page

**User Story:** As a new user, I want to create an account so that I can access the application.

#### Acceptance Criteria

1. THE Register_Page SHALL display the same background and floating panel style as the Login_Page
2. THE Register_Page SHALL display email, password, and confirm password fields
3. THE Register_Page SHALL validate that passwords match before submission
4. THE Register_Page SHALL validate minimum password length (8 characters)
5. WHEN registration succeeds, THE Register_Page SHALL navigate the user to the Dashboard
6. THE Register_Page SHALL display a link back to the Login_Page

### Requirement 4: Navigation Bar

**User Story:** As a user, I want a persistent navigation bar on all authenticated pages, so that I can easily move between sections of the application.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL be displayed on all authenticated pages (Dashboard, Locker_Page, Admin_Page, Workout_Detail_Page)
2. THE Navigation_Bar SHALL display a logo image (Watt-Locker-Nav-Logo.png) that fills the nav bar height
3. THE Navigation_Bar SHALL provide navigation links to the Dashboard, Locker_Page, and Admin_Page
4. THE Navigation_Bar SHALL visually indicate the currently active page using Electric Blue accent
5. THE Navigation_Bar SHALL NOT be displayed on the Login_Page or Register_Page
6. THE Navigation_Bar SHALL display a "Watt Locker" label right-justified in bold italics
7. THE Navigation_Bar SHALL provide a Logout option next to the Admin link
8. WHEN the user clicks Logout, THE Application SHALL clear auth tokens and redirect to the Login_Page

### Requirement 5: Page Background

**User Story:** As a user, I want a consistent tile-able wallpaper background on all authenticated pages, so that the application has visual depth and brand consistency.

#### Acceptance Criteria

1. WHILE the user is on any authenticated page, THE Application SHALL display a tile-able wallpaper image (Watt-Locker-Wallpaper.png) as the page background
2. THE Login_Page and Register_Page SHALL use their own custom background graphic instead of the tile-able wallpaper
3. THE Application SHALL tile the wallpaper image seamlessly using CSS background-repeat

### Requirement 6: Dashboard Page

**User Story:** As a user, I want a dashboard displaying performance charts and my workout history in a sortable table, so that I can review and analyze my training data.

#### Acceptance Criteria

1. THE Dashboard SHALL be the default page after successful login
2. THE Dashboard SHALL display two rows of performance charts above the Workout_Table
3. THE first chart row SHALL display: Weekly Miles, Weekly Duration, and Weekly Avg NP (all for previous 8 weeks)
4. THE second chart row SHALL display: Avg NP vs Avg HR, Pw:Hr Decoupling (last 10 workouts), and Weekly TSS
5. THE Workout_Table SHALL display the following columns: Date, Title, Duration, Distance, Avg Power, and Normalized Power
6. THE Workout_Table SHALL support sorting by any column when the column header is clicked
7. THE Workout_Table SHALL sort by raw ISO date values (not formatted display strings) for the Date column
8. THE Workout_Table SHALL default to sorting by Date in descending order (most recent workouts first)
9. THE Workout_Table SHALL paginate records with 25 records per page
10. THE Workout_Table SHALL display pagination controls allowing navigation between pages
11. WHEN the user clicks a workout Title value, THE Workout_Table SHALL navigate the user to the Workout_Detail_Page
12. THE Distance column SHALL display values in miles
13. THE Decoupling chart SHALL display reference lines at 0% (green) and 5% (yellow)
14. THE TSS chart SHALL display as a bar chart

### Requirement 7: Workout Detail Page

**User Story:** As a user, I want to view and edit detailed information about a specific workout, so that I can analyze my performance.

#### Acceptance Criteria

1. THE Workout_Detail_Page SHALL be accessible by clicking a workout title link in the Workout_Table
2. THE Workout_Detail_Page SHALL display the Navigation_Bar and tile-able wallpaper background
3. THE Workout_Detail_Page SHALL display workout details organized in themed cards
4. THE Workout_Detail_Page SHALL display Activity info (type, sub-type, data source, calories)
5. THE Workout_Detail_Page SHALL display Timing info (start, end, elapsed duration, moving time)
6. THE Workout_Detail_Page SHALL display Distance & Elevation (distance in miles, elevation in feet, avg/max speed in mph)
7. THE Workout_Detail_Page SHALL display Power metrics (avg, NP, max, total work, FTP, intensity factor, TSS)
8. THE Workout_Detail_Page SHALL display Heart Rate (avg, max, aerobic decoupling percentage)
9. THE Workout_Detail_Page SHALL display Cadence (avg, max, total pedal revolutions)
10. THE Workout_Detail_Page SHALL display Temperature (avg, max in °F with °C) when available
11. THE Workout_Detail_Page SHALL display Training Effect (aerobic, anaerobic) when available
12. THE Workout_Detail_Page SHALL allow inline editing of the workout Title field
13. THE Workout_Detail_Page SHALL include a "Back to Dashboard" navigation link

### Requirement 8: Locker Page

**User Story:** As a user, I want a dedicated page for loading workout files, so that I can import my training data into the system.

#### Acceptance Criteria

1. THE Locker_Page SHALL be accessible from the Navigation_Bar
2. THE Locker_Page SHALL provide a single file upload option
3. THE Locker_Page SHALL provide a bulk upload option (multiple files)
4. THE Locker_Page SHALL provide an inbox ingestion option (pull from Google Drive inbox folder)
5. THE Locker_Page SHALL display success/error feedback after each upload operation
6. THE Locker_Page SHALL display loading states during upload/ingestion
7. THE Locker_Page SHALL display the Navigation_Bar and tile-able wallpaper background

### Requirement 9: Admin Page

**User Story:** As an administrator, I want a settings page for configuring system paths and managing users, so that I can maintain the application.

#### Acceptance Criteria

1. THE Admin_Page SHALL be accessible from the Navigation_Bar
2. THE Admin_Page SHALL provide input fields for Google Drive Storage Path and Inbox Path
3. THE Admin_Page SHALL save settings via the API with success/error feedback
4. THE Admin_Page SHALL provide a user administration section (placeholder for future implementation)
5. THE Admin_Page SHALL display the Navigation_Bar and tile-able wallpaper background

### Requirement 10: Asset Configuration

**User Story:** As a developer, I want named asset files for branding images, so that the application uses consistent branding.

#### Acceptance Criteria

1. THE Application SHALL use `Watt-Locker-Login-Background.png` for the Login_Page background
2. THE Application SHALL use `Watt-Locker-Logo.png` for the rectangular logo in the Floating_Panel
3. THE Application SHALL use `Watt-Locker-Nav-Logo.png` for the logo in the Navigation_Bar
4. THE Application SHALL use `Watt-Locker-Wallpaper.png` for the tile-able wallpaper
5. THE Application SHALL use `favicon.png` as the browser favicon

### Requirement 11: Responsive Layout

**User Story:** As a user, I want the application to be usable on different screen sizes, so that I can access my workout data from various devices.

#### Acceptance Criteria

1. THE Application SHALL render correctly on desktop viewport widths (1024px and above)
2. THE Workout_Table SHALL support horizontal scrolling when the viewport is too narrow to display all columns
3. THE Floating_Panel SHALL remain centered and readable on all supported viewport widths
4. THE chart grid SHALL collapse to single-column on narrow viewports

### Requirement 12: Deployment

**User Story:** As a developer, I want the application deployable to Heroku, so that it can be accessed publicly.

#### Acceptance Criteria

1. THE Application SHALL include a Procfile for Heroku deployment
2. THE Application SHALL serve the built static files using the `serve` package
3. THE Application SHALL support build-time configuration of the API URL via VITE_API_URL
4. THE Application SHALL include a `heroku-postbuild` script that builds the application during deployment
