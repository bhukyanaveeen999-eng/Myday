# MyDay – Personal Productivity & Reminder Web Application

MyDay is a clean, minimal, responsive personal productivity and task scheduling web application built with React, Vite, TypeScript, Tailwind CSS, and Supabase.

---

## 1. Features

- **Authentication**: Public email/password sign-up and login powered by Supabase Auth with persistent sessions, session expiry management, and protected routes.
- **Task Management (Full CRUD)**:
  - Create tasks with title, description, scheduled date, scheduled time, and priority (`low`, `medium`, `high`).
  - Edit existing tasks.
  - Delete tasks with confirmation dialog.
  - Quick toggle for task completion directly from Dashboard or Tasks list.
  - Filter tasks by status: `all`, `pending`, `completed`.
- **Personal Notes (Full CRUD)**:
  - Create notes with title and multiline content.
  - Edit notes and search through notes in real time.
  - Delete notes with confirmation dialog.
  - View saved notes sorted by last updated timestamp.
- **Dashboard**:
  - Live summary metrics: Total Tasks, Pending Tasks, Completed Tasks.
  - Upcoming & pending tasks list with direct status toggling.
  - Quick-action shortcuts to create new tasks or notes.
- **Cross-Device Responsive Design**:
  - Optimized for both desktop and mobile/touch devices (including Android).
  - Sticky header navigation with mobile drawer menu and fixed mobile bottom navigation bar.
- **Strict Database Security**:
  - PostgreSQL Row Level Security (RLS) policies enforcing `auth.uid() = user_id` on all CRUD operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
  - Foreign key constraints referencing `auth.users(id)` with cascading deletes.

---

## 2. Technology Stack

- **Frontend**: React 18, Vite 6, TypeScript 5, Tailwind CSS 4 (`@tailwindcss/vite`), React Router 7, Lucide React
- **Backend**: Supabase (PostgreSQL 15, Supabase Auth, Row Level Security)
- **Database Migrations**: Supabase CLI migration-first workflow

---

## 3. Project Structure

```text
MYday/
├── dist/                          # Production build output
├── public/                        # Public assets
├── src/
│   ├── components/                # Reusable UI components
│   │   ├── ConfirmationModal.tsx  # Confirmation modal for destructive actions
│   │   └── ProtectedRoute.tsx     # Route protection guard
│   ├── context/
│   │   └── AuthContext.tsx        # Supabase auth session & user context
│   ├── layouts/
│   │   └── AppLayout.tsx          # Responsive layout (Desktop nav & mobile bottom bar)
│   ├── pages/
│   │   ├── DashboardPage.tsx      # Dashboard with metrics and upcoming tasks
│   │   ├── LoginPage.tsx          # User sign-in
│   │   ├── NotesPage.tsx          # Note management (CRUD & search)
│   │   ├── RegisterPage.tsx       # User sign-up
│   │   └── TasksPage.tsx          # Task management (CRUD & filtering)
│   ├── services/
│   │   ├── authService.ts         # Supabase Auth methods
│   │   ├── noteService.ts         # Supabase Note CRUD operations
│   │   ├── supabase.ts            # Supabase JS client configuration
│   │   └── taskService.ts         # Supabase Task CRUD operations
│   ├── types/
│   │   ├── database.types.ts      # TypeScript interfaces for Supabase schema
│   │   └── index.ts               # Type exports
│   ├── utils/
│   │   └── dateUtils.ts           # Date/time formatting with Asia/Kolkata timezone
│   ├── App.tsx                    # React router route definitions
│   ├── index.css                  # Tailwind CSS root stylesheet
│   ├── main.tsx                   # React root entry point
│   └── vite-env.d.ts              # Vite environment declarations
├── supabase/
│   ├── migrations/
│   │   └── 20261117173323_create_initial_schema.sql # Initial database migration
│   └── config.toml                # Supabase CLI project configuration
├── test/
│   ├── dateUtils.test.js          # Unit tests for date and timezone utilities
│   └── schema.test.js             # Automated schema and RLS verification tests
├── .env                           # Local environment variables (git-ignored)
├── .env.example                   # Example environment variables template
├── .gitignore                     # Git ignore rules
├── index.html                     # HTML entry point
├── package.json                   # Dependencies and scripts
├── postcss.config.js              # PostCSS configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript compiler configuration
└── vite.config.ts                 # Vite bundler configuration
```

---

## 4. Setup & Running Locally

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

### Step 3: Link Supabase & Apply Database Migrations
Link your remote Supabase project:
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```
Push the migration to your Supabase database:
```bash
npx supabase db push
```

### Step 4: Run the Development Server
```bash
npm run dev
```

### Step 5: Run Unit & Schema Tests
```bash
npm test
```

### Step 6: Build for Production
```bash
npm run build
```

---

## 5. Database Schema & RLS Architecture

The initial schema is defined in `supabase/migrations/20261117173323_create_initial_schema.sql`.

### Tasks Table (`public.tasks`)
- `id`: UUID (Primary Key, `gen_random_uuid()`)
- `user_id`: UUID (References `auth.users(id)` ON DELETE CASCADE)
- `title`: TEXT (Required)
- `description`: TEXT (Optional)
- `scheduled_at`: TIMESTAMPTZ (Nullable)
- `timezone`: TEXT (Default `'Asia/Kolkata'`)
- `priority`: TEXT (`low`, `medium`, `high`, Default `'medium'`)
- `status`: TEXT (`pending`, `completed`, `cancelled`, Default `'pending'`)
- `created_at`: TIMESTAMPTZ (Default UTC now)
- `updated_at`: TIMESTAMPTZ (Default UTC now, updated via trigger)

### Notes Table (`public.notes`)
- `id`: UUID (Primary Key, `gen_random_uuid()`)
- `user_id`: UUID (References `auth.users(id)` ON DELETE CASCADE)
- `title`: TEXT (Default `''`)
- `content`: TEXT (Default `''`)
- `created_at`: TIMESTAMPTZ (Default UTC now)
- `updated_at`: TIMESTAMPTZ (Default UTC now, updated via trigger)

### Row Level Security
Both tables strictly enforce isolation with Row Level Security:
- `auth.uid() = user_id` on `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- The frontend never dictates user identity; `auth.uid()` guarantees database-level isolation.

---

## 6. Future Notification Architecture

The database and application architecture are decoupled to support future notification systems:
- Task scheduling stores `scheduled_at` and `timezone` independently of delivery mechanism.
- Planned future extensions:
  - Local browser alarms via Web Notification API when app is active.
  - Background notifications via Web Push API, Service Worker, and VAPID keys.
  - Supabase Cron & Edge Functions to trigger push deliveries.
  - Delivery logging table to prevent duplicate notifications.

