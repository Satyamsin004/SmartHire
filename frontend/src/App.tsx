import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { MockInterviewRoom } from './pages/MockInterviewRoom';
import { ResumeAnalyzerPage } from './pages/ResumeAnalyzerPage';
import { CodingRoundPage } from './pages/CodingRoundPage';
import { AptitudeRoundPage } from './pages/AptitudeRoundPage';
import { ReportDetailsPage } from './pages/ReportDetailsPage';
import { RecruiterDashboard } from './pages/RecruiterDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { SettingsPage } from './pages/SettingsPage';

const getHomePathForRole = (role?: string) => {
  if (role === 'admin') return '/admin';
  if (role === 'recruiter') return '/recruiter';
  return '/dashboard';
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <>{children}</>;
};

const JobsView: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'recruiter' || user?.role === 'admin') {
    return <RecruiterDashboard />;
  }
  return <CandidateDashboard />;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  const homePath = getHomePathForRole(user?.role);

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={homePath} replace /> : <LoginPage />} />
      <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to={homePath} replace /> : <SignupPage />} />
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
      <Route path="/applications" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
      <Route path="/offers" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
      <Route path="/interview" element={<ProtectedRoute allowedRoles={['candidate']}><MockInterviewRoom /></ProtectedRoute>} />
      <Route path="/interview/*" element={<ProtectedRoute allowedRoles={['candidate']}><MockInterviewRoom /></ProtectedRoute>} />
      <Route path="/resume" element={<ProtectedRoute allowedRoles={['candidate']}><ResumeAnalyzerPage /></ProtectedRoute>} />
      <Route path="/coding" element={<ProtectedRoute allowedRoles={['candidate']}><CodingRoundPage /></ProtectedRoute>} />
      <Route path="/aptitude" element={<ProtectedRoute allowedRoles={['candidate']}><AptitudeRoundPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={['candidate', 'recruiter', 'admin']}><ReportDetailsPage /></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><JobsView /></ProtectedRoute>} />
      <Route path="/recruiter" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/applications" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/evaluations" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/rejected-ats" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/screening" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/interviews" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/candidates" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? homePath : "/login"} replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
};

export default App;
