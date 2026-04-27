import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AppContext';
import { PageLoader } from '../ui';

export default function TeacherLayout() {
  const { currentTeacher, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!currentTeacher) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
