import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Step1Setup from './wizard/Step1Setup';
import Step2Format from './wizard/Step2Format';
import Step3Questions from './wizard/Step3Questions';
import Step4Review from './wizard/Step4Review';
import Step5Publish from './wizard/Step5Publish';
import { useApp, useToast } from '../../context/AppContext';
import { generateId, generateExamCode } from '../../utils/helpers';
import { storage } from '../../utils/storage';
import type { Exam, ExamFormat, ExamSettings, ExamType, PreloadedStudent, Question } from '../../types';

const STEPS = [
  { num: 1, label: 'Pengaturan' },
  { num: 2, label: 'Format' },
  { num: 3, label: 'Soal' },
  { num: 4, label: 'Review' },
  { num: 5, label: 'Publikasi' },
];

const DRAFT_KEY = 'kuizku_wizard_draft';

type WizardData = {
  title: string;
  description: string;
  subject: string;
  className?: string;
  examType: ExamType;
  activeFrom: string;
  activeTo: string;
  settings: ExamSettings;
  format: ExamFormat;
  questions: Question[];
  preloadedStudents: PreloadedStudent[];
};

type WizardDraft = Partial<WizardData> & {
  data?: Partial<WizardData>;
  step?: number;
};

const IMPORT_SESSION_KEY = 'kuizku_import_in_progress';
const defaultSettings: ExamSettings = {
  timerMode: 'NONE',
  wholExamTimerSeconds: 3600,
  perQuestionDefaultSeconds: 60,
  maxAttempts: 1,
  showScoreAfterSubmit: true,
  showAnswerKeyAfterSubmit: false,
  releaseResultsAfterGrading: false,
  shuffleQuestions: false,
  shuffleOptions: false,
  antiCheatSensitivity: 'MEDIUM',
  passingScore: 70,
  navigationMode: 'FREE',
  scoreReleaseMode: 'IMMEDIATE',
  answerKeyReleaseMode: 'NEVER',
  explanationReleaseMode: 'NEVER',
  showRankingAfterSubmit: false,
  autoSubmitOnTimeUp: true,
};

const emptyWizardData: WizardData = {
  title: '', description: '', subject: '', className: '', activeFrom: '', activeTo: '',
  examType: 'UJIAN', settings: defaultSettings, format: 'PG_ONLY', questions: [], preloadedStudents: [],
};

function readWizardDraft(): { data: WizardData; step: 1 | 2 | 3 | 4 } {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return { data: emptyWizardData, step: 1 };

    const parsed = JSON.parse(saved) as WizardDraft;
    const savedData: Partial<WizardData> = parsed.data ?? parsed;
    const savedStep = typeof parsed.step === 'number' ? parsed.step : 1;

    return {
      data: {
        ...emptyWizardData,
        ...savedData,
        settings: { ...defaultSettings, ...(savedData.settings ?? {}) },
        questions: Array.isArray(savedData.questions) ? savedData.questions : [],
        preloadedStudents: Array.isArray(savedData.preloadedStudents) ? savedData.preloadedStudents : [],
      },
      step: Math.min(4, Math.max(1, savedStep)) as 1 | 2 | 3 | 4,
    };
  } catch {
    return { data: emptyWizardData, step: 1 };
  }
}

export default function CreateExamPage() {
  const { currentTeacher, exams, refreshExams } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [initialDraft] = useState(readWizardDraft);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(initialDraft.step);
  const [data, setData] = useState<WizardData>(initialDraft.data);
  const [createdExam, setCreatedExam] = useState<Exam | null>(null);
  const [saving, setSaving] = useState(false);

  const saveWizardDraft = useCallback((draftData: WizardData, draftStep: 1 | 2 | 3 | 4) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: draftData, step: draftStep }));
    } catch {
      // Storage bisa penuh/terblokir di private mode. Wizard tetap berjalan.
    }
  }, []);

  useEffect(() => {
    if (createdExam) return;
    if (step <= 4) saveWizardDraft(data, step as 1 | 2 | 3 | 4);
  }, [data, step, createdExam, saveWizardDraft]);

  useEffect(() => {
    if (sessionStorage.getItem(IMPORT_SESSION_KEY) !== '1') return;
    sessionStorage.removeItem(IMPORT_SESSION_KEY);
    addToast({ type: 'info', title: 'Draft ujian dipulihkan', message: 'Anda kembali ke langkah terakhir sebelum import file.' });
  }, [addToast]);
  useEffect(() => {
    if (createdExam) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (data.title || data.questions.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [data, createdExam]);

  const update = (partial: Partial<WizardData>) => setData(d => ({ ...d, ...partial }));

  const handleQuestionsChange = (questions: Question[]) => {
    const nextData = { ...data, questions };
    setData(nextData);
    // Ini dipanggil sebelum file picker terbuka, bukan menunggu useEffect.
    saveWizardDraft(nextData, 3);
  };

  const handleStep1Next = (d: Pick<WizardData, 'title' | 'description' | 'subject' | 'className' | 'examType' | 'activeFrom' | 'activeTo' | 'settings' | 'preloadedStudents'>) => {
    update(d);
    setStep(2);
  };

  const handleStep2Next = (format: ExamFormat) => {
    const hasIncompat = data.questions.some(q => {
      if (format === 'PG_ONLY' && q.type === 'ESSAY') return true;
      if (format === 'ESSAY_ONLY' && q.type !== 'ESSAY') return true;
      return false;
    });
    if (hasIncompat) {
      const incompatCount = data.questions.filter(q => {
        if (format === 'PG_ONLY') return q.type === 'ESSAY';
        if (format === 'ESSAY_ONLY') return q.type !== 'ESSAY';
        return false;
      }).length;
      if (!window.confirm(`${incompatCount} soal tidak kompatibel dengan format ini dan akan dihapus. Lanjutkan?`)) {
        return;
      }
      const filtered = data.questions.filter(q => {
        if (format === 'PG_ONLY') return q.type !== 'ESSAY';
        if (format === 'ESSAY_ONLY') return q.type === 'ESSAY';
        return true;
      });
      update({ format, questions: filtered });
      addToast({ type: 'warning', title: `${incompatCount} soal dihapus`, message: 'Soal yang tidak sesuai format baru telah dihapus.' });
    } else {
      update({ format });
    }
    setStep(3);
  };

  const handleStep3Next = (questions: Question[]) => {
    const nextData = { ...data, questions };
    setData(nextData);
    saveWizardDraft(nextData, 4);
    setStep(4);
  };

  const handleStep4Next = async (questions: Question[]) => {
    update({ questions });
    setSaving(true);

    let code = generateExamCode();
    while (exams.some(e => e.code === code)) code = generateExamCode();

    const now = new Date().toISOString();
    const newExam: Exam = {
      id: generateId(),
      teacherId: currentTeacher!.id,
      title: data.title,
      description: data.description,
      subject: data.subject,
      className: data.className,
      examType: data.examType,
      format: data.format,
      settings: data.settings,
      activeFrom: data.activeFrom,
      activeTo: data.activeTo,
      code,
      status: 'DRAFT',
      questions,
      preloadedStudents: data.preloadedStudents,
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await storage.saveExam(newExam);
    if (error) {
      addToast({ type: 'error', title: 'Gagal menyimpan ujian', message: error });
      setSaving(false);
      return;
    }

    await refreshExams();
    setCreatedExam(newExam);
    setSaving(false);
    setStep(5);
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleFinish = () => {
    localStorage.removeItem(DRAFT_KEY);
    navigate('/guru/ujian');
  };

  return (
    <div className="page-content" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <h1>Buat Ujian Baru</h1>
        <p>Ikuti langkah berikut untuk membuat ujian yang siap dibagikan ke murid.</p>
      </div>

      <div className="wizard-steps" style={{ marginBottom: 'var(--sp-10)' }}>
        {STEPS.map((s, i) => (
          <>
            <div key={s.num} className={`wizard-step ${step === s.num ? 'active' : step > s.num ? 'done' : ''}`}>
              <div className="wizard-step-num">
                {step > s.num ? <CheckCircle size={14} /> : s.num}
              </div>
              <span className="wizard-step-label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`wizard-connector ${step > s.num ? 'done' : ''}`} />}
          </>
        ))}
      </div>

      <div className="card">
        {step === 1 && (
          <Step1Setup
            initial={{ title: data.title, description: data.description, subject: data.subject, className: data.className, examType: data.examType, activeFrom: data.activeFrom, activeTo: data.activeTo, settings: data.settings, preloadedStudents: data.preloadedStudents }}
            onNext={handleStep1Next}
          />
        )}
        {step === 2 && (
          <Step2Format
            current={data.format}
            onNext={handleStep2Next}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Questions
            format={data.format}
            subject={data.subject}
            initial={data.questions}
            onQuestionsChange={handleQuestionsChange}
            onNext={handleStep3Next}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4Review
            data={data}
            onNext={handleStep4Next}
            onBack={() => setStep(3)}
            saving={saving}
          />
        )}
        {step === 5 && createdExam && (
          <Step5Publish exam={createdExam} onFinish={handleFinish} />
        )}
      </div>
    </div>
  );
}
