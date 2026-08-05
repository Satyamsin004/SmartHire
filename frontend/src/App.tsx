import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { InterviewConfig } from './pages/interview/InterviewConfig';
import { InterviewLobby } from './pages/interview/InterviewLobby';
import { LiveInterviewRoom } from './pages/interview/LiveInterviewRoom';
import { ProcessingScreen } from './pages/interview/ProcessingScreen';
import { ResultsScreen } from './pages/interview/ResultsScreen';
import { ResumeAnalyzerPage } from './pages/ResumeAnalyzerPage';
import { ReportDetailsPage } from './pages/ReportDetailsPage';
import { RecruiterDashboard } from './pages/RecruiterDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { SettingsPage } from './pages/SettingsPage';
import { JobsPage } from './pages/JobsPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';
import { OffersPage } from './pages/OffersPage';
import { CandidateAnalyticsPage } from './pages/CandidateAnalyticsPage';
import { CandidateProfilePage } from './pages/CandidateProfilePage';
import { PostedJobsPage } from './pages/PostedJobsPage';
import { PracticeHubPage } from './pages/practice/PracticeHubPage';
import { AssessmentExamRoom } from './pages/practice/AssessmentExamRoom';
import { RecruiterAssessmentsPage } from './pages/recruiter/RecruiterAssessmentsPage';
import { AppLayout } from './components/layout/AppLayout';

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



const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  const homePath = getHomePathForRole(user?.role);

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={homePath} replace /> : <LoginPage />} />
      <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to={homePath} replace /> : <SignupPage />} />
      
      {/* Routes WITH Global Layout */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute allowedRoles={['candidate']}><MyApplicationsPage /></ProtectedRoute>} />
        <Route path="/offers" element={<ProtectedRoute allowedRoles={['candidate']}><OffersPage /></ProtectedRoute>} />
        
        {/* Unified Candidate AI Practice Hub (Contains Practice Assessment, Practice Interview, History, Reports, Progress Analytics) */}
        <Route path="/practice" element={<ProtectedRoute allowedRoles={['candidate']}><PracticeHubPage /></ProtectedRoute>} />
        
        {/* Reports & Analytics Routes */}
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['candidate', 'recruiter', 'admin']}><ReportDetailsPage /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute allowedRoles={['candidate', 'recruiter', 'admin']}><ReportDetailsPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<Navigate to="/practice?tab=analytics" replace />} />
        <Route path="/progress" element={<Navigate to="/practice?tab=analytics" replace />} />
        <Route path="/interview/mock-history" element={<Navigate to="/practice?tab=history" replace />} />

        {/* Recruiter Assessment & Management Routes */}
        <Route path="/recruiter/assessments" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterAssessmentsPage /></ProtectedRoute>} />
        <Route path="/recruiter/reports" element={<ProtectedRoute allowedRoles={['recruiter', 'admin']}><ReportDetailsPage /></ProtectedRoute>} />

        {/* AI Interview Workflow Screens */}
        <Route path="/interview/config" element={<ProtectedRoute allowedRoles={['candidate']}><InterviewConfig /></ProtectedRoute>} />
        <Route path="/interview/lobby" element={<ProtectedRoute allowedRoles={['candidate']}><InterviewLobby /></ProtectedRoute>} />
        <Route path="/interview/processing" element={<ProtectedRoute allowedRoles={['candidate']}><ProcessingScreen /></ProtectedRoute>} />
        <Route path="/interview/results" element={<ProtectedRoute allowedRoles={['candidate']}><ResultsScreen /></ProtectedRoute>} />
        <Route path="/interview" element={<Navigate to="/interview/config" replace />} />

        <Route path="/resume" element={<ProtectedRoute allowedRoles={['candidate']}><ResumeAnalyzerPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><CandidateProfilePage /></ProtectedRoute>} />
        <Route path="/jobs" element={<ProtectedRoute allowedRoles={['candidate', 'recruiter', 'admin']}><JobsPage /></ProtectedRoute>} />
        
        {/* Recruiter Portal Routes */}
        <Route path="/recruiter" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
        <Route path="/recruiter/candidates" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="candidates" /></ProtectedRoute>} />
        <Route path="/recruiter/posted-jobs" element={<ProtectedRoute allowedRoles={['recruiter']}><PostedJobsPage /></ProtectedRoute>} />
        <Route path="/recruiter/shortlisted" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="shortlisted" /></ProtectedRoute>} />
        <Route path="/recruiter/applications" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="applications" /></ProtectedRoute>} />
        <Route path="/recruiter/interviews" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="evaluations" /></ProtectedRoute>} />
        <Route path="/recruiter/analytics" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="requisitions" /></ProtectedRoute>} />
        <Route path="/recruiter/offers" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="requisitions" /></ProtectedRoute>} />
        <Route path="/recruiter/company" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      </Route>

      {/* Routes WITHOUT Global Layout (Full Screen) */}
      <Route path="/interview/live" element={<ProtectedRoute allowedRoles={['candidate']}><LiveInterviewRoom /></ProtectedRoute>} />
      <Route path="/assessment/exam" element={<ProtectedRoute allowedRoles={['candidate', 'recruiter']}><AssessmentExamRoom /></ProtectedRoute>} />
      
      <Route path="/interview/*" element={<Navigate to="/interview/config" replace />} />
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

