import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { PersonalExamProvider } from './features/personal-exam/PersonalExamContext';
import TeacherLayout from './components/layout/TeacherLayout';
import { ToastContainer, PageLoader, NetworkStatusBanner, ErrorBoundary } from './components/ui';

// ---- Lazy-loaded pages (code splitting) ----
const LandingPage      = lazy(() => import('./pages/LandingPage'));
const LoginPage        = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage     = lazy(() => import('./pages/auth/RegisterPage'));

// Teacher
const DashboardPage    = lazy(() => import('./pages/teacher/DashboardPage'));
const ExamListPage     = lazy(() => import('./pages/teacher/ExamListPage'));
const CreateExamPage   = lazy(() => import('./pages/teacher/CreateExamPage'));
const EditExamQuestionsPage = lazy(() => import('./pages/teacher/EditExamQuestionsPage'));
const PreviewExamPage  = lazy(() => import('./pages/teacher/PreviewExamPage'));
const QuestionBankPage = lazy(() => import('./pages/teacher/QuestionBankPage'));
const ResultsPage      = lazy(() => import('./pages/teacher/ResultsPage'));
const ExamWorkspacePage = lazy(() => import('./pages/teacher/ExamWorkspacePage'));
const ExamGradingRedirect = lazy(() => import('./pages/teacher/ExamGradingRedirect'));
const SettingsPage     = lazy(() => import('./pages/teacher/SettingsPage'));

// Student
const JoinExamPage        = lazy(() => import('./pages/student/JoinExamPage'));
const InstructionsPage    = lazy(() => import('./pages/student/InstructionsPage'));
const ExamTakingPage      = lazy(() => import('./pages/student/ExamTakingPage'));
const StudentHistoryPage  = lazy(() => import('./pages/student/StudentHistoryPage'));
const StudentRankingPage  = lazy(() => import('./pages/student/StudentRankingPage'));

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider><AppProvider>
        <PersonalExamProvider><BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Landing */}
            <Route path="/" element={<LandingPage />} />

            {/* Auth */}
            <Route path="/login"  element={<LoginPage />} />
            <Route path="/daftar" element={<RegisterPage />} />

            {/* Student (public — no auth required) */}
            <Route path="/ujian"                    element={<JoinExamPage />} />
            <Route path="/ujian/:code"              element={<JoinExamPage />} />
            <Route path="/ujian/:code/instruksi"    element={<InstructionsPage />} />
            <Route path="/ujian/:code/siap"         element={<InstructionsPage />} />
            <Route path="/ujian/:code/kerjakan"     element={<ExamTakingPage />} />
            <Route path="/ujian/:code/ranking"      element={<StudentRankingPage />} />
            <Route path="/riwayat"                  element={<StudentHistoryPage />} />

            {/* Teacher (protected by TeacherLayout) */}
            <Route path="/guru" element={<TeacherLayout />}>
              <Route index element={<Navigate to="/guru/dashboard" replace />} />
              <Route path="dashboard"  element={<DashboardPage />} />
              <Route path="ujian"      element={<ExamListPage />} />
              <Route path="ujian/baru" element={<CreateExamPage />} />
              <Route path="ujian/:id" element={<ExamWorkspacePage />} />
              <Route path="ujian/:id/soal" element={<ExamWorkspacePage />} />
              <Route path="ujian/:id/peserta" element={<ExamWorkspacePage />} />
              <Route path="ujian/:id/hasil" element={<ExamWorkspacePage />} />
              <Route path="ujian/:id/koreksi" element={<ExamGradingRedirect />} />
              <Route path="ujian/:id/pengaturan" element={<ExamWorkspacePage />} />
              <Route path="ujian/:id/edit-soal" element={<EditExamQuestionsPage />} />
              <Route path="ujian/:id/preview" element={<PreviewExamPage />} />
              <Route path="bank-soal"  element={<QuestionBankPage />} />
              <Route path="hasil"      element={<ResultsPage />} />
              <Route path="pengaturan" element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          <NetworkStatusBanner />
          <ToastContainer />
        </BrowserRouter></PersonalExamProvider>
      </AppProvider></ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
