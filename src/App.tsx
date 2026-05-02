import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import TeacherLayout from './components/layout/TeacherLayout';
import { ToastContainer, PageLoader, NetworkStatusBanner } from './components/ui';

// ---- Lazy-loaded pages (code splitting) ----
const LandingPage      = lazy(() => import('./pages/LandingPage'));
const LoginPage        = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage     = lazy(() => import('./pages/auth/RegisterPage'));

// Teacher
const DashboardPage    = lazy(() => import('./pages/teacher/DashboardPage'));
const ExamListPage     = lazy(() => import('./pages/teacher/ExamListPage'));
const CreateExamPage   = lazy(() => import('./pages/teacher/CreateExamPage'));
const QuestionBankPage = lazy(() => import('./pages/teacher/QuestionBankPage'));
const ResultsPage      = lazy(() => import('./pages/teacher/ResultsPage'));
const SettingsPage     = lazy(() => import('./pages/teacher/SettingsPage'));

// Student
const JoinExamPage        = lazy(() => import('./pages/student/JoinExamPage'));
const InstructionsPage    = lazy(() => import('./pages/student/InstructionsPage'));
const ExamTakingPage      = lazy(() => import('./pages/student/ExamTakingPage'));
const StudentHistoryPage  = lazy(() => import('./pages/student/StudentHistoryPage'));

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Landing */}
            <Route path="/" element={<LandingPage />} />

            {/* Auth */}
            <Route path="/login"  element={<LoginPage />} />
            <Route path="/daftar" element={<RegisterPage />} />

            {/* Student (public — no auth required) */}
            <Route path="/ujian"                    element={<JoinExamPage />} />
            <Route path="/ujian/:code/instruksi"    element={<InstructionsPage />} />
            <Route path="/ujian/:code/kerjakan"     element={<ExamTakingPage />} />
            <Route path="/riwayat"                  element={<StudentHistoryPage />} />

            {/* Teacher (protected by TeacherLayout) */}
            <Route path="/guru" element={<TeacherLayout />}>
              <Route index element={<Navigate to="/guru/dashboard" replace />} />
              <Route path="dashboard"  element={<DashboardPage />} />
              <Route path="ujian"      element={<ExamListPage />} />
              <Route path="ujian/baru" element={<CreateExamPage />} />
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
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
