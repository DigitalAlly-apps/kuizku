// Edit Soal Ujian — reuse Step3Questions + save langsung
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Step3Questions from './wizard/Step3Questions';
import { useApp, useToast } from '../../context/AppContext';
import { storage } from '../../utils/storage';
import { PageLoader } from '../../components/ui';
import type { Question } from '../../types';

export default function EditExamQuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const { exams, refreshExams } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  const exam = exams.find(e => e.id === id);

  useEffect(() => {
    if (!exam && exams.length > 0) navigate('/guru/ujian');
    else if (exam) setReady(true);
  }, [exam, exams]);

  if (!ready || !exam) return <PageLoader />;

  const handleSave = async (questions: Question[]) => {
    setSaving(true);
    const updated = { ...exam, questions };
    const { error } = await storage.saveExam(updated);
    if (error) {
      addToast({ type: 'error', title: 'Gagal menyimpan soal', message: error });
      setSaving(false);
      return;
    }
    await refreshExams();
    setSaving(false);
    addToast({ type: 'success', title: 'Soal berhasil disimpan!' });
    navigate('/guru/ujian');
  };

  return (
    <div className="page-content" style={{ maxWidth: 860 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/guru/ujian')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1>Edit Soal — {exam.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>Format: {exam.format === 'PG_ONLY' ? 'PG' : exam.format === 'ESSAY_ONLY' ? 'Essay' : 'PG + Essay'} • {exam.questions.length} soal</p>
        </div>
      </div>

      <div className="card">
        <Step3Questions
          format={exam.format}
          subject={exam.subject}
          initial={exam.questions}
          onNext={handleSave}
          onBack={() => navigate('/guru/ujian')}
        />
        {saving && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--sp-4)', color: 'var(--primary)' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Menyimpan...
          </div>
        )}
      </div>
    </div>
  );
}
