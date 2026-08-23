import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2, Chrome, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AppContext';
import { Spinner } from '../../components/ui';
import { storage } from '../../utils/storage';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  
  // Login & Forgot states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  
  // Reset Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Common UI states
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const enterRecovery = () => {
      setMode('reset');
      setError('');
      setSuccessMsg('');
    };
    if (window.location.hash.includes('type=recovery')) enterRecovery();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        enterRecovery();
      } else if (event === 'SIGNED_IN' && session?.user) {
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/guru/dashboard', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email dan password wajib diisi'); return; }
    setLoading(true);
    setError('');
    const res = await login(email, password);
    setLoading(false);
    if (res.success) navigate('/guru/dashboard', { replace: true });
    else setError(res.error || 'Email atau password salah');
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const res = await loginWithGoogle();
    if (res.error) { setError(res.error); setLoading(false); }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Masukkan email Anda terlebih dahulu'); return; }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const res = await storage.requestPasswordReset(email);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccessMsg('Link pemulihan password telah dikirim ke email Anda! Silakan cek kotak masuk atau spam.');
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Semua field wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password baru minimal harus 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const res = await storage.updatePassword(newPassword);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccessMsg('Password berhasil diperbarui! Anda akan dialihkan ke Dashboard Guru...');
      setTimeout(() => {
        // Redireksi dan refresh penuh agar AppContext memuat ulang sesi Guru yang baru diperbarui
        window.location.href = '/guru/dashboard';
      }, 1500);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}><BookOpen size={21} strokeWidth={2.25} /></div>
          <span style={styles.logoText}>Kuizku</span>
        </div>

        {mode === 'login' && (
          <>
            <h1 style={styles.title}>Selamat Datang Kembali</h1>
            <p style={styles.subtitle}>Masuk ke akun guru Anda</p>

            {error && (
              <div style={styles.errorBox}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={styles.form}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={styles.inputIcon} />
                  <input id="login-email" type="email" className="form-input" placeholder="guru@sekolah.ac.id"
                    style={{ paddingLeft: 40 }} value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="login-password" style={{ margin: 0 }}>Password</label>
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Lupa password?
                  </button>
                </div>
                <div style={{ position: 'relative', marginTop: 4 }}>
                  <Lock size={16} style={styles.inputIcon} />
                  <input id="login-password" type={showPass ? 'text' : 'password'} className="form-input"
                    placeholder="••••••••" style={{ paddingLeft: 40, paddingRight: 40 }}
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" style={styles.eyeBtn} onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}
                style={{ marginTop: 8, justifyContent: 'center' }}>
                {loading ? <Spinner /> : 'Masuk'}
              </button>
              <button type="button" className="btn btn-secondary w-full btn-lg" disabled={loading} onClick={handleGoogleLogin}
                style={{ justifyContent: 'center' }}>
                <Chrome size={18} /> Masuk dengan Google
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 'var(--sp-5)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Belum punya akun?{' '}
              <Link to="/daftar" style={{ color: 'var(--primary)', fontWeight: 600 }}>Daftar sekarang</Link>
            </p>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h1 style={styles.title}>Lupa Password</h1>
            <p style={styles.subtitle}>Masukkan email terdaftar untuk menerima link reset password</p>

            {error && (
              <div style={styles.errorBox}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            {successMsg ? (
              <div style={{ textAlign: 'center', padding: 'var(--sp-2) 0' }}>
                <div style={{ color: 'var(--success)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 'var(--sp-5)' }}>
                  <CheckCircle2 size={48} style={{ color: 'var(--success)' }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 500, lineHeight: '1.5', margin: 0 }}>
                    {successMsg}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary w-full"
                  onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}>
                  Kembali ke Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={styles.form}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">Email Terdaftar</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={styles.inputIcon} />
                    <input id="forgot-email" type="email" className="form-input" placeholder="guru@sekolah.ac.id"
                      style={{ paddingLeft: 40 }} value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}
                  style={{ marginTop: 8, justifyContent: 'center' }}>
                  {loading ? <Spinner /> : 'Kirim Link Reset'}
                </button>

                <button type="button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer', marginTop: 8, marginInline: 'auto' }}
                  onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}>
                  <ArrowLeft size={16} />
                  Kembali ke Login
                </button>
              </form>
            )}
          </>
        )}

        {mode === 'reset' && (
          <>
            <h1 style={styles.title}>Atur Password Baru</h1>
            <p style={styles.subtitle}>Masukkan password baru untuk akun Guru Anda</p>

            {error && (
              <div style={styles.errorBox}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            {successMsg ? (
              <div style={{ textAlign: 'center', padding: 'var(--sp-2) 0' }}>
                <div style={{ color: 'var(--success)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <CheckCircle2 size={48} style={{ color: 'var(--success)' }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 500, lineHeight: '1.5', margin: 0 }}>
                    {successMsg}
                  </p>
                  <div style={{ marginTop: 8 }}>
                    <Spinner />
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} style={styles.form}>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">Password Baru</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={styles.inputIcon} />
                    <input id="new-password" type={showNewPass ? 'text' : 'password'} className="form-input"
                      placeholder="•••••••• (min 6 karakter)" style={{ paddingLeft: 40, paddingRight: 40 }}
                      value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                    <button type="button" style={styles.eyeBtn} onClick={() => setShowNewPass(!showNewPass)} aria-label={showNewPass ? 'Sembunyikan password baru' : 'Tampilkan password baru'}>
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-password">Konfirmasi Password Baru</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={styles.inputIcon} />
                    <input id="confirm-password" type={showConfirmPass ? 'text' : 'password'} className="form-input"
                      placeholder="••••••••" style={{ paddingLeft: 40, paddingRight: 40 }}
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                    <button type="button" style={styles.eyeBtn} onClick={() => setShowConfirmPass(!showConfirmPass)} aria-label={showConfirmPass ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}>
                      {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}
                  style={{ marginTop: 8, justifyContent: 'center' }}>
                  {loading ? <Spinner /> : 'Simpan Password Baru'}
                </button>
              </form>
            )}
          </>
        )}
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
    background: 'var(--bg)',
  },
  bg: { display: 'none' },
  card: {
    position: 'relative',
    zIndex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: 'var(--sp-8)',
    width: '100%',
    maxWidth: 440,
    boxShadow: 'var(--shadow-sm)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--sp-8)', justifyContent: 'center' },
  logoIcon: {
    width: 40, height: 40,
    background: 'var(--primary-light)',
    color: 'var(--primary)',
    borderRadius: 'var(--r-md)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 800,
    fontSize: '1.4rem',
    color: 'var(--text)',
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
  eyeBtn: { position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', borderRadius: 'var(--r-sm)' },
};
