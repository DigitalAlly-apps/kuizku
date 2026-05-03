import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AppContext';
import { Spinner } from '../../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email dan password wajib diisi'); return; }
    setLoading(true);
    setError('');
    const res = await login(email, password);
    setLoading(false);
    if (res.success) navigate('/guru/dashboard', { replace: true });
    else setError(res.error || 'Email atau password salah');
  };

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>⚡</div>
          <span style={styles.logoText}>Ujianly</span>
        </div>

        <h1 style={styles.title}>Selamat Datang Kembali</h1>
        <p style={styles.subtitle}>Masuk ke akun guru Anda</p>

        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={styles.inputIcon} />
              <input id="login-email" type="email" className="form-input" placeholder="guru@sekolah.ac.id"
                style={{ paddingLeft: 40 }} value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={styles.inputIcon} />
              <input id="login-password" type={showPass ? 'text' : 'password'} className="form-input"
                placeholder="••••••••" style={{ paddingLeft: 40, paddingRight: 40 }}
                value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" style={styles.eyeBtn} onClick={() => setShowPass(!showPass)} tabIndex={-1}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}
            style={{ marginTop: 8, justifyContent: 'center' }}>
            {loading ? <Spinner /> : 'Masuk'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--sp-5)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Belum punya akun?{' '}
          <Link to="/daftar" style={{ color: 'var(--primary)', fontWeight: 600 }}>Daftar sekarang</Link>
        </p>

        {/* Demo hint */}
        <div style={styles.demoHint}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Belum ada akun?{' '}
            <Link to="/daftar" style={{ color: 'var(--accent)' }}>Buat akun baru</Link> untuk mulai memakai Ujianly.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--sp-4)',
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,110,247,0.15), transparent), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(124,58,237,0.1), transparent)',
    zIndex: 0,
  },
  card: {
    position: 'relative',
    zIndex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--r-xl)',
    padding: 'var(--sp-10)',
    width: '100%',
    maxWidth: 440,
    boxShadow: 'var(--shadow-lg)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--sp-8)', justifyContent: 'center' },
  logoIcon: {
    width: 40, height: 40,
    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.2rem',
  },
  logoText: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 800,
    fontSize: '1.4rem',
    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  title: { textAlign: 'center', fontSize: '1.4rem', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--sp-6)' },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px',
    background: 'var(--danger-light)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--r-md)',
    color: 'var(--danger)',
    fontSize: '0.875rem',
    marginBottom: 'var(--sp-5)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' },
  inputIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' },
  eyeBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' },
  demoHint: { marginTop: 'var(--sp-5)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border)' },
};
