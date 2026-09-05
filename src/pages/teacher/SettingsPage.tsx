import { useMemo, useState } from 'react';
import { User, Building, BookOpen, Save, Loader2, Mail, Shield, Palette, CheckCircle2, Info, Moon, Sun } from 'lucide-react';
import { useAuth, useToast } from '../../context/AppContext';
import { storage } from '../../utils/storage';
import { useTheme } from '../../context/theme';

export default function SettingsPage() {
  const { currentTeacher } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState(currentTeacher?.name ?? '');
  const [subject, setSubject] = useState(currentTeacher?.subject ?? '');
  const [institution, setInstitution] = useState(currentTeacher?.institution ?? '');
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const { theme, setTheme } = useTheme();

  const profileCompletion = useMemo(() => {
    const fields = [name, subject, institution];
    return Math.round((fields.filter(value => value.trim()).length / fields.length) * 100);
  }, [name, subject, institution]);

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
    <div className="page-content settings-page">
      <div className="page-header settings-page-header">
        <div><div className="settings-eyebrow">PREFERENSI GURU</div><h1>Akun & Tampilan</h1><p>Satu tempat untuk identitas guru, tema aplikasi, dan pemulihan akun.</p></div>
        <div className="settings-header-status"><CheckCircle2 size={16} /> Akun aktif</div>
      </div>

      <div className="settings-account-layout">
        <section className="settings-profile-area" aria-labelledby="profile-heading">
          <div className="settings-profile-banner">
            <div className="settings-profile-identity">
              <div className="settings-avatar">{name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'}</div>
              <div><h2>{name || 'Nama Guru'}</h2><p>{currentTeacher?.email}</p><span>Guru / Pengelola ujian</span></div>
            </div>
            <div className="settings-completion"><div><span>Profil lengkap</span><strong>{profileCompletion}%</strong></div><div className="settings-progress"><i style={{ width: `${profileCompletion}%` }} /></div><small>Lengkapi agar identitas ujian lebih jelas.</small></div>
          </div>

          <div className="settings-section-heading"><div><h2 id="profile-heading">Profil publik</h2><p>Informasi ini dapat muncul pada identitas dan hasil ujian yang Anda kelola.</p></div><span className="settings-required-note">* Wajib diisi</span></div>
          <div className="settings-profile-form">
            <div className="form-group settings-field-wide"><label className="form-label" htmlFor="settings-name">Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span></label><div className="settings-input-wrap"><User size={16} /><input id="settings-name" className="form-input" value={name} onChange={e => setName(e.target.value)} /></div></div>
            <div className="form-group"><label className="form-label" htmlFor="settings-subject">Mata Pelajaran</label><div className="settings-input-wrap"><BookOpen size={16} /><input id="settings-subject" className="form-input" placeholder="Contoh: Matematika" value={subject} onChange={e => setSubject(e.target.value)} /></div></div>
            <div className="form-group"><label className="form-label" htmlFor="settings-inst">Institusi</label><div className="settings-input-wrap"><Building size={16} /><input id="settings-inst" className="form-input" placeholder="Nama sekolah/lembaga" value={institution} onChange={e => setInstitution(e.target.value)} /></div></div>
          </div>
          <div className="settings-form-footer"><span>Perubahan profil hanya berlaku setelah disimpan.</span><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Menyimpan...</> : <><Save size={16} /> Simpan Perubahan</>}</button></div>
        </section>

        <aside className="settings-side-area">
          <section className="settings-side-section" aria-labelledby="account-info-heading"><div className="settings-section-icon"><Info size={18} /></div><div className="settings-side-content"><h2 id="account-info-heading">Informasi Akun</h2><p>Data login dikelola oleh Kuizku.</p><div className="settings-info-list">{[['Email login', currentTeacher?.email ?? '—'], ['ID Akun', (currentTeacher?.id.slice(0, 8) ?? '—') + '...']].map(([label, val]) => <div key={label}><span>{label}</span><strong>{val}</strong></div>)}</div></div></section>
          <section className="settings-side-section" aria-labelledby="appearance-heading"><div className="settings-section-icon"><Palette size={18} /></div><div className="settings-side-content"><h2 id="appearance-heading">Tema aplikasi</h2><p>Preferensi ini berlaku di seluruh area guru pada perangkat ini.</p><div className="settings-theme-list">{([['light', Sun, 'Mode terang'], ['dark', Moon, 'Mode gelap']] as const).map(([value, Icon, label]) => <button className="settings-theme-option" key={value} type="button" onClick={() => setTheme(value)} aria-pressed={theme === value}><Icon size={17} /><span>{label}</span>{theme === value && <CheckCircle2 size={16} />}</button>)}</div></div></section>
        </aside>
      </div>

      <section className="settings-security-area" aria-labelledby="security-heading"><div className="settings-security-copy"><div className="settings-section-icon"><Shield size={18} /></div><div><h2 id="security-heading">Keamanan & Pemulihan</h2><p>Kirim tautan reset password ke email akun Anda. Sesi login tetap aktif sampai Anda keluar sendiri.</p></div></div><button className="btn btn-secondary" onClick={handleResetPassword} disabled={sendingReset}>{sendingReset ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Mengirim...</> : <><Mail size={16} /> Kirim Email Reset Password</>}</button></section>
    </div>
  );
}
