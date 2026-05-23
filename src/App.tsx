import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import PlanEditorPage from './pages/PlanEditorPage';
import PlansListPage from './pages/PlansListPage';
import PlanDetailPage from './pages/PlanDetailPage';
import JournalPage from './pages/JournalPage';
import TradeEntryPage from './pages/TradeEntryPage';
import PortfolioPage from './pages/PortfolioPage';
import PortfolioDashboardPage from './pages/PortfolioDashboardPage';
import RemindersPage from './pages/RemindersPage';
import DailyNotesPage from './pages/DailyNotesPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UpdatePasswordPage from './pages/UpdatePasswordPage';
import ReminderNotification from './components/reminders/ReminderNotification';
import { useAuthStore } from './stores/authStore';

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
  { path: 'login', element: <LoginPage /> },
  { path: 'signup', element: <SignupPage /> },
  { path: 'reset-password', element: <ResetPasswordPage /> },
  { path: 'update-password', element: <UpdatePasswordPage /> },

  // Protected routes (wrapped in ProtectedRoute)
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'plans', element: <PlansListPage /> },
      { path: 'plans/new', element: <PlanEditorPage /> },
      { path: 'plans/:id/edit', element: <PlanEditorPage /> },
      { path: 'plans/:id', element: <PlanDetailPage /> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'journal/new', element: <TradeEntryPage /> },
      { path: 'journal/:id/edit', element: <TradeEntryPage /> },
      { path: 'daily-notes', element: <DailyNotesPage /> },
      { path: 'portfolios', element: <PortfolioPage /> },
      { path: 'portfolios/:id', element: <PortfolioDashboardPage /> },
      { path: 'reminders', element: <RemindersPage /> },
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
