import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ReminderProvider } from './context/ReminderContext';
import { ReminderAlertOverlay } from './components/ReminderAlertOverlay';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { NotesPage } from './pages/NotesPage';
import { SettingsPage } from './pages/SettingsPage';
import { loadAppState } from './utils/appStateStorage';

const RestoreLastRoute: React.FC = () => {
  const { user } = useAuth();
  const { lastRoute } = loadAppState(user?.id);
  return <Navigate to={lastRoute || '/dashboard'} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ReminderProvider>
          <ReminderAlertOverlay />
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Application Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RestoreLastRoute />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Catch-all route restores last visited section */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ReminderProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
