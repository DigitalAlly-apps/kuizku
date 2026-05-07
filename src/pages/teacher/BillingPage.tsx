import type { CSSProperties } from 'react';
import { CheckCircle, CreditCard, Crown, MessageCircle, RefreshCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ADMIN_WHATSAPP = '62895397265635';

export default function BillingPage() {
  const { currentTeacher, subscription, featureAccess, refreshBilling } = useApp();

  const planLabel = featureAccess.isPro ? 'Pro' : 'Free';
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `Halo Admin Ujianly, saya ingin upgrade ke Pro.\n\nNama: ${currentTeacher?.name ?? '-'}\nEmail akun: ${currentTeacher?.email ?? '-'}\nPaket saat ini: ${planLabel}`,
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${text}`, '_blank');
  };

  return (
    <div className="page-content" style={{ maxWidth: 1040 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1>Paket & Billing</h1>
          <p>Kelola paket Ujianly Anda. Untuk beta, upgrade Pro diproses manual oleh admin.</p>
        </div>
        <button className="btn btn-secondary" onClick={refreshBilling}>
          <RefreshCcw size={15} /> Refresh Status
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: 'var(--sp-5)', marginBottom: 'var(--sp-8)' }} className="billing-overview-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div style={styles.iconBox}><CreditCard size={20} /></div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Paket Aktif</div>
              <h2 style={{ margin: 0 }}>{planLabel}</h2>
            </div>
          </div>
          <div style={{ padding: 'var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
            <strong style={{ color: featureAccess.isPro ? 'var(--success)' : 'var(--text-primary)' }}>
              {featureAccess.isPro ? 'Aktif' : 'Free'}
            </strong>
            {periodEnd && <p style={{ fontSize: '0.82rem', marginTop: 6 }}>Aktif sampai {periodEnd}</p>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
            <UsageMini label="Ujian Aktif" value={featureAccess.usage.activeExams} limit={featureAccess.limits.activeExams} />
            <UsageMini label="Jawaban/Bulan" value={featureAccess.usage.monthlySubmissions} limit={featureAccess.limits.monthlySubmissions} />
            <UsageMini label="Bank Soal" value={featureAccess.usage.bankQuestions} limit={featureAccess.limits.bankQuestions} />
          </div>
        </div>

        <div className="card" style={{ borderColor: featureAccess.isPro ? 'var(--success)' : 'var(--primary)', boxShadow: featureAccess.isPro ? 'var(--shadow-sm)' : 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <div>
              <span className="badge badge-success">Early Adopter</span>
              <h2 style={{ marginTop: 10 }}>Pro Manual</h2>
              <p style={{ fontSize: '0.9rem' }}>Untuk guru yang rutin memberi tugas, latihan, dan ujian online.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Mulai dari</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>Rp29.000</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>/bulan beta</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }} className="billing-benefit-grid">
            {['Import Excel/Word', 'Export rekap Excel', 'Countdown/timer ujian', 'Share WhatsApp, link, QR', 'Feedback ke murid', '2.000 pengumpulan jawaban/bulan'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <CheckCircle size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>

          <div style={{ padding: 'var(--sp-4)', background: 'var(--primary-light)', borderRadius: 'var(--r-lg)', border: '1px solid rgba(37,99,235,0.2)', marginBottom: 'var(--sp-5)' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>Cara upgrade manual</strong>
            <p style={{ fontSize: '0.86rem' }}>Klik tombol WhatsApp, admin akan mengirim instruksi pembayaran. Setelah pembayaran diverifikasi, paket Pro akan diaktifkan manual.</p>
          </div>

          <div style={{ padding: 'var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', marginBottom: 'var(--sp-5)' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>Catatan admin beta</strong>
            <p style={{ fontSize: '0.82rem' }}>Setelah bukti pembayaran valid, update subscription user ke <code>pro_manual</code> dan set masa aktif 30 hari di Supabase.</p>
          </div>

          <button className="btn btn-primary btn-lg" style={{ justifyContent: 'center', width: '100%' }} onClick={openWhatsApp}>
            {featureAccess.isPro ? <Crown size={18} /> : <MessageCircle size={18} />}
            {featureAccess.isPro ? 'Hubungi Admin Billing' : 'Upgrade Pro via WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsageMini({ label, value, limit }: { label: string; value: number; limit: number }) {
  return (
    <div style={{ padding: 'var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)' }}>
      <div style={{ fontSize: '1rem', fontWeight: 800 }}>{value}/{limit}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 'var(--r-md)',
    background: 'var(--primary-light)',
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
