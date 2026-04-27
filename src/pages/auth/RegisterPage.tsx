import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AppContext';
import { Spinner } from '../../components/ui';

// removed duplicated import

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Nama lengkap wajib diisi'); return; }
    if (!form.email.trim()) { setError('Email wajib diisi'); return; }
    if (form.password.length < 8) { setError('Password minimal 8 karakter'); return; }
    if (form.password !== form.confirmPassword) { setError('Konfirmasi password tidak cocok'); return; }
    setLoading(true);
    const res = await register({ name: form.name, email: form.email, password: form.password, subject: '', institution: '' });
    setLoading(false);
    if (res.success) navigate('/guru/dashboard', { replace: true });
    else setError(res.error || 'Email sudah terdaftar. Silakan login.');
  };

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>⚡</div>
          <span style={styles.logoText}>KuizKu</span>
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '1.3rem', marginBottom: 4 }}>Daftar Akun Guru</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--sp-6)' }}>
          Mulai buat ujian dalam 2 menit
        </p>

        {error && (
          <div style={styles.errorBox}><AlertCircle size={15} />{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Nama Lengkap</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={iconStyle} />
              <input id="reg-name" className="form-input" placeholder="Budi Santoso" style={{ paddingLeft: 40 }}
                value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={iconStyle} />
              <input id="reg-email" type="email" className="form-input" placeholder="guru@sekolah.ac.id" style={{ paddingLeft: 40 }}
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>

          {/* Removed Subject and Institution rows */}

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input id="reg-password" type={showPass ? 'text' : 'password'} className="form-input"
                placeholder="Min. 8 karakter" style={{ paddingLeft: 40, paddingRight: 40 }}
                value={form.password} onChange={e => set('password', e.target.value)} />
              <button type="button" style={styles.eyeBtn} onClick={() => setShowPass(!showPass)} tabIndex={-1}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Konfirmasi Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input id="reg-confirm" type="password" className="form-input"
                placeholder="Ulangi password" style={{ paddingLeft: 40 }}
                value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}
            style={{ marginTop: 4, justifyContent: 'center' }}>
            {loading ? <Spinner /> : 'Buat Akun'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--sp-5)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Sudah punya akun?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Masuk</Link>
        </p>
      </div>
    </div>
  );
}

const iconStyle: React.CSSProperties = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-4)', position: 'relative', overflow: 'hidden' },
  bg: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,110,247,0.15), transparent)', zIndex: 0 },
  card: { position: 'relative', zIndex: 1, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-10)', width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-lg)', margin: 'var(--sp-6) auto' },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--sp-6)', justifyContent: 'center' },
  logoIcon: { width: 40, height: 40, background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' },
  logoText: { fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.4rem', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  errorBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-md)', color: 'var(--danger)', fontSize: '0.875rem', marginBottom: 'var(--sp-5)' },
  eyeBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' },
};
