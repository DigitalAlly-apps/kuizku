import { useEffect, useMemo, useState } from 'react';
import { User, Building, BookOpen, Save, Loader2, Mail, Shield, Palette, CheckCircle2, Info, Moon, Sun } from 'lucide-react';
import { useAuth, useToast } from '../../context/AppContext';
import { storage } from '../../utils/storage';

export default function SettingsPage() {
  const { currentTeacher } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState(currentTeacher?.name ?? '');
  const [subject, setSubject] = useState(currentTeacher?.subject ?? '');
  const [institution, setInstitution] = useState(currentTeacher?.institution ?? '');
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
  }, []);

  const profileCompletion = useMemo(() => {
    const fields = [name, subject, institution];
    return Math.round((fields.filter(value => value.trim()).length / fields.length) * 100);
  }, [name, subject, institution]);

  const changeTheme = (nextTheme: 'light' | 'dark') => {
    setTheme(nextTheme);
    localStorage.setItem('app-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleSave = async () => {
    if (!currentTeacher) return;
    if (!name.trim()) { addToast({ type: 'error', title: 'Nama tidak boleh kosong' }); return; }
    setSaving(true);
    const { error } = await storage.updateTeacher(currentTeacher.id, { name: name.trim(), subject, institution });
    setSaving(false);
    if (error) {
      addToast({ type: 'error', title: 'Gagal menyimpan', message: error });
    } else {
      addToast({ type: 'success', title: 'Profil berhasil disimpan!', message: 'Data guru telah diperbarui.' });
    }
  };

  const handleResetPassword = async () => {
    if (!currentTeacher?.email) return;
    setSendingReset(true);
    const { error } = await storage.requestPasswordReset(currentTeacher.email);
    setSendingReset(false);
    if (error) {
      addToast({ type: 'error', title: 'Gagal kirim email reset', message: error });
      return;
    }
    addToast({ type: 'success', title: 'Email reset terkirim', message: `Cek inbox/spam untuk ${currentTeacher.email}.` });
  };

  return (
    <div className="page-content" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <h1>Pengaturan Akun</h1>
        <p>Kelola profil, tampilan, dan keamanan akun Kuizku Anda.</p>
      </div>

      <div className="card">
        <div className="settings-profile-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)', padding: 'var(--sp-5)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>
            {name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{name || 'Nama Guru'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{currentTeacher?.email}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 7, color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}><CheckCircle2 size={14} /> Akun aktif</div>
          </div>
          </div>
          <div style={{ minWidth: 150 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 7 }}><span>Profil</span><strong style={{ color: 'var(--text-primary)' }}>{profileCompletion}%</strong></div>
            <div style={{ height: 7, borderRadius: 99, background: 'var(--border)' }}><div style={{ width: `${profileCompletion}%`, height: '100%', borderRadius: 99, background: 'var(--primary)', transition: 'width 180ms ease' }} /></div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>Lengkapi agar identitas ujian lebih jelas.</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-name">Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input id="settings-name" className="form-input" style={{ paddingLeft: 40 }}
                value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-subject">Mata Pelajaran</label>
            <div style={{ position: 'relative' }}>
              <BookOpen size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input id="settings-subject" className="form-input" style={{ paddingLeft: 40 }}
                placeholder="Contoh: Matematika, Bahasa Indonesia..."
                value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-inst">Institusi</label>
            <div style={{ position: 'relative' }}>
              <Building size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input id="settings-inst" className="form-input" style={{ paddingLeft: 40 }}
                value={institution} onChange={e => setInstitution(e.target.value)} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }} disabled={saving}>
            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Menyimpan...</> : <><Save size={16} /> Simpan Perubahan</>}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          <Info size={19} style={{ color: 'var(--primary)', marginTop: 2 }} />
          <div><h3 style={{ marginBottom: 4 }}>Informasi Akun</h3><p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>Informasi ini dikelola oleh sistem login Kuizku.</p></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {[['Email login', currentTeacher?.email ?? '—'], ['ID Akun', (currentTeacher?.id.slice(0, 8) ?? '—') + '...'], ['Peran', 'Guru / Pengelola ujian']].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--sp-3) 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          <Palette size={19} style={{ color: 'var(--primary)', marginTop: 2 }} />
          <div><h3 style={{ marginBottom: 4 }}>Preferensi Tampilan</h3><p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>Pilih tampilan yang nyaman digunakan. Pengaturan ini hanya berlaku di perangkat ini.</p></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sp-3)' }}>
          {([['light', Sun, 'Mode terang', 'Cocok untuk ruangan terang'], ['dark', Moon, 'Mode gelap', 'Lebih nyaman untuk malam hari']] as const).map(([value, Icon, label, description]) => (
            <button key={value} type="button" onClick={() => changeTheme(value)} aria-pressed={theme === value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minHeight: 64, padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--r-md)', border: `1px solid ${theme === value ? 'var(--primary)' : 'var(--border)'}`, background: theme === value ? 'var(--primary-light)' : 'var(--surface)', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>
              <Icon size={19} style={{ color: theme === value ? 'var(--primary)' : 'var(--text-muted)' }} />
              <span><strong style={{ display: 'block', fontSize: '0.88rem' }}>{label}</strong><small style={{ color: 'var(--text-muted)' }}>{description}</small></span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-4)' }}>
        <h3 style={{ marginBottom: 'var(--sp-4)' }}>Keamanan & Pemulihan</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
            <Shield size={18} style={{ color: 'var(--primary)', marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Reset password via email</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sistem akan mengirim tautan pemulihan ke email akun Anda.</div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={handleResetPassword} disabled={sendingReset} style={{ alignSelf: 'flex-start' }}>
            {sendingReset ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Mengirim...</> : <><Mail size={16} /> Kirim Email Reset Password</>}
          </button>
        </div>
      </div>
    </div>
  );
}
