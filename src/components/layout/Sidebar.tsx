import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, BookOpen, BarChart2, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AppContext';

const navItems = [
  { to: '/guru/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/guru/ujian', icon: FileText, label: 'Ujian Saya' },
  { to: '/guru/bank-soal', icon: BookOpen, label: 'Bank Soal' },
  { to: '/guru/hasil', icon: BarChart2, label: 'Hasil & Nilai' },
];

export default function Sidebar({ open, onClose, toggleTheme, theme }: { open?: boolean, onClose?: () => void, toggleTheme?: () => void, theme?: string }) {
  const { currentTeacher, logout } = useAuth();
  const navigate = useNavigate();

  const initials = currentTeacher?.name
    .split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() ?? 'GR';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <NavLink to="/guru/dashboard" className="sidebar-logo" onClick={handleNavClick}>
        <div className="sidebar-logo-icon">⚡</div>
        <span className="sidebar-logo-text">Ujianly</span>
      </NavLink>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Menu Utama</span>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`} onClick={handleNavClick}>
            <Icon size={18} />
            <span style={{ flex: 1 }}>{label}</span>
          </NavLink>
        ))}

        <span className="sidebar-section-label" style={{ marginTop: 'var(--sp-4)' }}>Akun</span>
        <NavLink to="/guru/pengaturan" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`} onClick={handleNavClick}>
          <Settings size={18} />
          <span style={{ flex: 1 }}>Pengaturan</span>
        </NavLink>
        
        {/* Desktop Theme Toggle */}
        <button className="sidebar-nav-item desktop-theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          <span style={{ flex: 1 }}>{theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}</span>
        </button>

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
