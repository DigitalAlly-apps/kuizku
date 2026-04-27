import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import TeacherLayout from './components/layout/TeacherLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/teacher/DashboardPage';
import ExamListPage from './pages/teacher/ExamListPage';
import CreateExamPage from './pages/teacher/CreateExamPage';
import QuestionBankPage from './pages/teacher/QuestionBankPage';
import ResultsPage from './pages/teacher/ResultsPage';
import SettingsPage from './pages/teacher/SettingsPage';
// Student pages (no auth required)
import JoinExamPage from './pages/student/JoinExamPage';
import InstructionsPage from './pages/student/InstructionsPage';
import ExamTakingPage from './pages/student/ExamTakingPage';
import { ToastContainer } from './components/ui';

import LandingPage from './pages/LandingPage';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/daftar" element={<RegisterPage />} />

          {/* Student (public — no auth required) */}
          <Route path="/ujian" element={<JoinExamPage />} />
          <Route path="/ujian/:code/instruksi" element={<InstructionsPage />} />
          <Route path="/ujian/:code/kerjakan" element={<ExamTakingPage />} />

          {/* Teacher (protected by TeacherLayout) */}
          <Route path="/guru" element={<TeacherLayout />}>
            <Route index element={<Navigate to="/guru/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="ujian" element={<ExamListPage />} />
            <Route path="ujian/baru" element={<CreateExamPage />} />
            <Route path="bank-soal" element={<QuestionBankPage />} />
            <Route path="hasil" element={<ResultsPage />} />
            <Route path="pengaturan" element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
