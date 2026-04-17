import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './hooks/useAuth';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DevicesPage from './pages/DevicesPage';
import DeviceOverviewPage from './pages/DeviceOverviewPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';
import GenericResourcePage from './pages/GenericResourcePage';
import ToolsPage from './pages/ToolsPage';
import DeviceLogsPage from './pages/DeviceLogsPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Main pages */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:clientId" element={<ClientDetailPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="/audit" element={<AdminRoute><AuditPage /></AdminRoute>} />

        {/* Device-specific pages */}
        <Route path="/devices/:deviceId/overview" element={<DeviceOverviewPage />} />
        <Route path="/devices/:deviceId/logs" element={<DeviceLogsPage />} />

        {/* Tools */}
        <Route path="/devices/:deviceId/tools/ping" element={<ToolsPage />} />
        <Route path="/devices/:deviceId/tools/traceroute" element={<ToolsPage />} />

        {/* Generic RouterOS resource proxy - catches ALL ROS paths */}
        <Route path="/devices/:deviceId/ros/*" element={<GenericResourcePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
