import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AppContext';
import { PageLoader } from '../ui';
import { Home, FileText, BarChart2, MoreHorizontal, BookOpen, Settings, LogOut, Sun, Moon, X, Plus } from 'lucide-react';
import { APP_CONFIG } from '../../lib/appConfig';

export default function TeacherLayout() {
  const { currentTeacher, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('app-theme') || 'light';
    setTheme(saved as 'light' | 'dark');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('app-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  if (isLoading) return <PageLoader />;
  if (!currentTeacher) return <Navigate to="/login" replace />;

  const pageTitle = location.pathname.includes('/hasil') ? 'Hasil' : location.pathname.includes('/bank-soal') ? 'Bank Soal' : location.pathname.includes('/pengaturan') ? 'Pengaturan' : location.pathname.includes('/ujian') ? 'Ujian' : 'Beranda';
  const go = (path: string) => { setMoreOpen(false); setSidebarOpen(false); navigate(path); };
  const handleLogout = async () => { setMoreOpen(false); await logout(); navigate('/login'); };

  return (
    <div className="app-layout">
      <div className="mobile-header">
        <div><div className="mobile-header-kicker">{APP_CONFIG.name}</div><strong>{pageTitle}</strong></div>
        <button className="teacher-mobile-create" onClick={() => go('/guru/ujian/baru')} aria-label="Buat ujian"><Plus size={18} /></button>
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} toggleTheme={toggleTheme} theme={theme} />
      
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main-content">
        <Outlet />
      </div>

      <nav className="teacher-mobile-bottom-nav" aria-label="Navigasi guru">
        {([
          ['/guru/dashboard', Home, 'Beranda'], ['/guru/ujian', FileText, 'Ujian'], ['/guru/hasil', BarChart2, 'Hasil'],
        ] as const).map(([path, Icon, label]) => {
          const active = location.pathname === path || (path === '/guru/ujian' && location.pathname.startsWith('/guru/ujian/'));
          return <button key={String(path)} className={active ? 'active' : ''} onClick={() => go(String(path))}><Icon size={19} /><span>{label}</span></button>;
        })}
        <button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen(value => !value)}><MoreHorizontal size={19} /><span>Lainnya</span></button>
      </nav>

      {moreOpen && <div className="teacher-mobile-more-overlay" onClick={() => setMoreOpen(false)}>
        <div className="teacher-mobile-more" onClick={event => event.stopPropagation()}>
          <div className="teacher-mobile-more-header"><strong>Lainnya</strong><button className="btn btn-ghost btn-icon" onClick={() => setMoreOpen(false)} aria-label="Tutup"><X size={18} /></button></div>
          <button onClick={() => go('/guru/bank-soal')}><BookOpen size={18} /> Bank Soal</button>
          <button onClick={() => go('/guru/pengaturan')}><Settings size={18} /> Pengaturan</button>
          <button onClick={toggleTheme}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />} {theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}</button>
          <button className="danger" onClick={() => void handleLogout()}><LogOut size={18} /> Keluar</button>
        </div>
      </div>}
    </div>
  );
}
