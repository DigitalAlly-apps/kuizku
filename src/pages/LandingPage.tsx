import { Link } from 'react-router-dom';
import { GraduationCap, BookOpen, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--sp-6)',
      background: 'radial-gradient(circle at top, var(--surface-3) 0%, var(--bg) 100%)'
    }}>
      <div style={{ maxWidth: 800, width: '100%', animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-12)' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: 'var(--sp-2)', background: 'linear-gradient(135deg, #F0F2FF, #9AA3C2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Ujianly
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
            Platform ujian dan kuis online paling responsif. Silakan pilih peran Anda untuk melanjutkan.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-6)' }}>
          
          {/* Student Card */}
          <Link to="/ujian" style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: 'var(--sp-8)',
              border: '2px solid var(--border-strong)',
              cursor: 'pointer',
              background: 'var(--surface)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--secondary)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(124, 58, 237, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: 'var(--r-xl)', background: 'var(--secondary-light)',
                color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 'var(--sp-6)'
              }}>
                <GraduationCap size={32} />
              </div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--sp-2)' }}>Saya Murid</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-8)', flex: 1 }}>
                Punya kode ujian dari guru Anda? Masuk ke sini untuk mulai mengerjakan ujian.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--secondary)', fontWeight: 600 }}>
                Mulai Ujian <ArrowRight size={16} />
              </div>
            </div>
          </Link>

          {/* Teacher Card */}
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: 'var(--sp-8)',
              border: '2px solid var(--border-strong)',
              cursor: 'pointer',
              background: 'var(--surface)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(79, 110, 247, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: 'var(--r-xl)', background: 'var(--primary-light)',
                color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 'var(--sp-6)'
              }}>
                <BookOpen size={32} />
              </div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--sp-2)' }}>Saya Guru</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-8)', flex: 1 }}>
                Masuk ke dashboard untuk membuat soal, mengatur ujian, dan melihat rekap nilai.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 600 }}>
                Masuk Dashboard <ArrowRight size={16} />
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}
