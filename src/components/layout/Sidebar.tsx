import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, BookOpen, BarChart2, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AppContext';

const navItems = [
  { to: '/guru/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/guru/ujian', icon: FileText, label: 'Ujian Saya' },
  { to: '/guru/bank-soal', icon: BookOpen, label: 'Bank Soal' },
  { to: '/guru/hasil', icon: BarChart2, label: 'Hasil & Nilai' },
];

export default function Sidebar() {
  const { currentTeacher, logout } = useAuth();
  const navigate = useNavigate();

  const initials = currentTeacher?.name
    .split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() ?? 'GR';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <NavLink to="/guru/dashboard" className="sidebar-logo">
        <div className="sidebar-logo-icon">⚡</div>
        <span className="sidebar-logo-text">KuizKu</span>
      </NavLink>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Menu Utama</span>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
            <Icon size={18} />
            <span style={{ flex: 1 }}>{label}</span>
          </NavLink>
        ))}

        <span className="sidebar-section-label" style={{ marginTop: 'var(--sp-4)' }}>Akun</span>
        <NavLink to="/guru/pengaturan" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
          <Settings size={18} />
          <span style={{ flex: 1 }}>Pengaturan</span>
        </NavLink>
        <button className="sidebar-nav-item" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
          <LogOut size={18} />
          <span style={{ flex: 1 }}>Keluar</span>
        </button>
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{currentTeacher?.name ?? 'Guru'}</div>
          <div className="sidebar-user-role">{currentTeacher?.subject ?? 'Mata Pelajaran'}</div>
        </div>
      </div>
    </aside>
  );
}
