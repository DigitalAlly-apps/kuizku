import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap, ShieldCheck } from 'lucide-react';
import { APP_CONFIG } from '../lib/appConfig';

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="Kuizku beranda">
          <span className="landing-brand-mark"><BookOpen size={20} aria-hidden="true" /></span>
          <span>{APP_CONFIG.name}</span>
        </Link>
        <Link to="/login" className="btn btn-ghost btn-sm">Masuk Guru</Link>
      </header>
      <section className="landing-main">
        <div className="landing-intro">
          <span className="landing-kicker">UJIAN DAN KUIS UNTUK KELAS</span>
          <h1>Masuk sesuai kebutuhan Anda.</h1>
          <p>Kuizku membantu guru menyiapkan ujian dan murid mengerjakannya dengan alur yang jelas.</p>
        </div>
        <div className="landing-roles">
          <Link to="/ujian" className="landing-role-card landing-role-student">
            <span className="landing-role-icon"><GraduationCap size={28} aria-hidden="true" /></span>
            <span className="landing-role-content"><strong>Saya Murid</strong><small>Masukkan kode dari guru untuk mulai ujian atau melihat ranking.</small></span>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <Link to="/login" className="landing-role-card">
            <span className="landing-role-icon"><BookOpen size={28} aria-hidden="true" /></span>
            <span className="landing-role-content"><strong>Saya Guru</strong><small>Buat ujian, kelola soal, dan pantau hasil peserta.</small></span>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
        <p className="landing-note"><ShieldCheck size={15} aria-hidden="true" /> Guru masuk dengan akun. Murid cukup menggunakan kode ujian.</p>
      </section>
    </main>
  );
}
