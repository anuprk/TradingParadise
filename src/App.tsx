import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import ReminderNotification from './components/reminders/ReminderNotification';
import { useAuthStore } from './stores/authStore';

/**
 * Wrapper around lazy() that retries on chunk load failure by reloading the page.
 * This handles the case where a new deploy invalidates old chunk filenames.
 */
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType }>) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      // If chunk failed to load, reload the page to get fresh index.html
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (
        msg.includes('dynamically imported module') ||
        msg.includes('loading chunk') ||
        msg.includes('failed to fetch')
      ) {
        window.location.reload();
        // Return a dummy component while reload happens
        return { default: () => null };
      }
      throw error;
    }
  });
}

// Lazy-loaded page components (route-based code splitting)
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
const PlanEditorPage = lazyWithRetry(() => import('./pages/PlanEditorPage'));
const PlansListPage = lazyWithRetry(() => import('./pages/PlansListPage'));
const PlanDetailPage = lazyWithRetry(() => import('./pages/PlanDetailPage'));
const JournalPage = lazyWithRetry(() => import('./pages/JournalPage'));
const TradeEntryPage = lazyWithRetry(() => import('./pages/TradeEntryPage'));
const PortfolioPage = lazyWithRetry(() => import('./pages/PortfolioPage'));
const PortfolioDashboardPage = lazyWithRetry(() => import('./pages/PortfolioDashboardPage'));
const RemindersPage = lazyWithRetry(() => import('./pages/RemindersPage'));
const DailyNotesPage = lazyWithRetry(() => import('./pages/DailyNotesPage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const SignupPage = lazyWithRetry(() => import('./pages/SignupPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));
const UpdatePasswordPage = lazyWithRetry(() => import('./pages/UpdatePasswordPage'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-500 dark:text-gray-400">Loading...</div>
    </div>
  );
}

function AppLayout() {
  return (
    <>
      <ReminderNotification />
      <AppShell />
    </>
  );
}

const router = createBrowserRouter([
  // Public routes (no guard)
  {
    path: 'login',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: 'signup',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <SignupPage />
      </Suspense>
    ),
  },
  {
    path: 'reset-password',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },
  {
    path: 'update-password',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <UpdatePasswordPage />
      </Suspense>
    ),
  },

  // Protected routes (wrapped in ProtectedRoute)
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'plans',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PlansListPage />
          </Suspense>
        ),
      },
      {
        path: 'plans/new',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PlanEditorPage />
          </Suspense>
        ),
      },
      {
        path: 'plans/:id/edit',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PlanEditorPage />
          </Suspense>
        ),
      },
      {
        path: 'plans/:id',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PlanDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'journal',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <JournalPage />
          </Suspense>
        ),
      },
      {
        path: 'journal/new',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <TradeEntryPage />
          </Suspense>
        ),
      },
      {
        path: 'journal/:id/edit',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <TradeEntryPage />
          </Suspense>
        ),
      },
      {
        path: 'daily-notes',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <DailyNotesPage />
          </Suspense>
        ),
      },
      {
        path: 'portfolios',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PortfolioPage />
          </Suspense>
        ),
      },
      {
        path: 'portfolios/:id',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <PortfolioDashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'reminders',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <RemindersPage />
          </Suspense>
        ),
      },
    ],
  },
]);

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
