import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { PageLoadingFallback } from './components/ui/PageLoadingFallback';

// Route-level Code Splitting for Sub-Second Load Times
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage })));
const CandidateDashboard = lazy(() => import('./pages/CandidateDashboard').then(m => ({ default: m.CandidateDashboard })));
const InterviewConfig = lazy(() => import('./pages/interview/InterviewConfig').then(m => ({ default: m.InterviewConfig })));
const InterviewLobby = lazy(() => import('./pages/interview/InterviewLobby').then(m => ({ default: m.InterviewLobby })));
const LiveInterviewRoom = lazy(() => import('./pages/interview/LiveInterviewRoom').then(m => ({ default: m.LiveInterviewRoom })));
const ProcessingScreen = lazy(() => import('./pages/interview/ProcessingScreen').then(m => ({ default: m.ProcessingScreen })));
const ResultsScreen = lazy(() => import('./pages/interview/ResultsScreen').then(m => ({ default: m.ResultsScreen })));
const ResumeAnalyzerPage = lazy(() => import('./pages/ResumeAnalyzerPage').then(m => ({ default: m.ResumeAnalyzerPage })));
const ReportDetailsPage = lazy(() => import('./pages/ReportDetailsPage').then(m => ({ default: m.ReportDetailsPage })));
const RecruiterDashboard = lazy(() => import('./pages/RecruiterDashboard').then(m => ({ default: m.RecruiterDashboard })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const JobsPage = lazy(() => import('./pages/JobsPage').then(m => ({ default: m.JobsPage })));
const MyApplicationsPage = lazy(() => import('./pages/MyApplicationsPage').then(m => ({ default: m.MyApplicationsPage })));
const OffersPage = lazy(() => import('./pages/OffersPage').then(m => ({ default: m.OffersPage })));
const CandidateAnalyticsPage = lazy(() => import('./pages/CandidateAnalyticsPage').then(m => ({ default: m.CandidateAnalyticsPage })));
const CandidateProfilePage = lazy(() => import('./pages/CandidateProfilePage').then(m => ({ default: m.CandidateProfilePage })));
const PostedJobsPage = lazy(() => import('./pages/PostedJobsPage').then(m => ({ default: m.PostedJobsPage })));
const PracticeHubPage = lazy(() => import('./pages/practice/PracticeHubPage').then(m => ({ default: m.PracticeHubPage })));
const AssessmentExamRoom = lazy(() => import('./pages/practice/AssessmentExamRoom').then(m => ({ default: m.AssessmentExamRoom })));
const AssessmentReviewPage = lazy(() => import('./pages/practice/AssessmentReviewPage').then(m => ({ default: m.AssessmentReviewPage })));
const RecruiterAssessmentsPage = lazy(() => import('./pages/recruiter/RecruiterAssessmentsPage').then(m => ({ default: m.RecruiterAssessmentsPage })));

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
    <Suspense fallback={<PageLoadingFallback />}>
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
          <Route path="/recruiter/candidates" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="applications" /></ProtectedRoute>} />
          <Route path="/recruiter/posted-jobs" element={<ProtectedRoute allowedRoles={['recruiter']}><PostedJobsPage /></ProtectedRoute>} />
          <Route path="/recruiter/shortlisted" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="shortlisted" /></ProtectedRoute>} />
          <Route path="/recruiter/applications" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="applications" /></ProtectedRoute>} />
          <Route path="/recruiter/ranking" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="ranking" /></ProtectedRoute>} />
          <Route path="/recruiter/comparison" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="comparison" /></ProtectedRoute>} />
          <Route path="/recruiter/interviews" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="evaluations" /></ProtectedRoute>} />
          <Route path="/recruiter/analytics" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="insights" /></ProtectedRoute>} />
          <Route path="/recruiter/offers" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard defaultTab="offers" /></ProtectedRoute>} />
          <Route path="/recruiter/company" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        </Route>

        {/* Routes WITHOUT Global Layout (Full Screen) */}
        <Route path="/interview/live" element={<ProtectedRoute allowedRoles={['candidate']}><LiveInterviewRoom /></ProtectedRoute>} />
        <Route path="/assessment/exam" element={<ProtectedRoute allowedRoles={['candidate', 'recruiter']}><AssessmentExamRoom /></ProtectedRoute>} />
        <Route path="/assessment/review" element={<ProtectedRoute allowedRoles={['candidate', 'recruiter']}><AssessmentReviewPage /></ProtectedRoute>} />
        
        <Route path="/interview/*" element={<Navigate to="/interview/config" replace />} />
        <Route path="*" element={<Navigate to={user ? homePath : "/login"} replace />} />
      </Routes>
    </Suspense>
  );
};

import { ErrorBoundary } from './components/ui/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="SmartHire Application Error">
      <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;

