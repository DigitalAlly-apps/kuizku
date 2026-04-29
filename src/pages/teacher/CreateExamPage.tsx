import { useState } from 'react';
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
import type { Exam, ExamFormat, ExamSettings, Question } from '../../types';

const STEPS = [
  { num: 1, label: 'Pengaturan' },
  { num: 2, label: 'Format' },
  { num: 3, label: 'Soal' },
  { num: 4, label: 'Review' },
  { num: 5, label: 'Publikasi' },
];

type WizardData = {
  title: string;
  description: string;
  subject: string;
  className?: string;
  activeFrom: string;
  activeTo: string;
  settings: ExamSettings;
  format: ExamFormat;
  questions: Question[];
};

const defaultSettings: ExamSettings = {
  timerMode: 'NONE',
  wholExamTimerSeconds: 3600,
  maxAttempts: 1,
  showScoreAfterSubmit: true,
  showAnswerKeyAfterSubmit: false,
  shuffleQuestions: false,
  shuffleOptions: false,
};

export default function CreateExamPage() {
  const { currentTeacher, exams, refreshExams } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    title: '', description: '', subject: '', className: '', activeFrom: '', activeTo: '',
    settings: defaultSettings, format: 'PG_ONLY', questions: [],
  });
  const [createdExam, setCreatedExam] = useState<Exam | null>(null);

  const update = (partial: Partial<WizardData>) => setData(d => ({ ...d, ...partial }));

  const handleStep1Next = (d: Pick<WizardData, 'title' | 'description' | 'subject' | 'activeFrom' | 'activeTo' | 'settings'>) => {
    update(d);
    setStep(2);
  };

  const handleStep2Next = (format: ExamFormat) => {
    // If format changed and we have incompatible questions, warn/clear
    const hasIncompat = data.questions.some(q => {
      if (format === 'PG_ONLY' && q.type === 'ESSAY') return true;
      if (format === 'ESSAY_ONLY' && q.type === 'MULTIPLE_CHOICE') return true;
      return false;
    });
    if (hasIncompat) {
      const filtered = data.questions.filter(q => {
        if (format === 'PG_ONLY') return q.type === 'MULTIPLE_CHOICE';
        if (format === 'ESSAY_ONLY') return q.type === 'ESSAY';
        return true;
      });
      update({ format, questions: filtered });
      addToast({ type: 'warning', title: 'Beberapa soal dihapus', message: 'Soal yang tidak sesuai format baru telah dihapus.' });
    } else {
      update({ format });
    }
    setStep(3);
  };

  const handleStep3Next = (questions: Question[]) => {
    update({ questions });
    setStep(4);
  };

  const handleStep4Next = async (questions: Question[]) => {
    update({ questions });
    setStep(5);

    // Build the full exam object atomically (avoids React state race condition
    // where updateExam(exam.id, { questions }) reads stale state before createExam settles)
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
      format: data.format,
      settings: data.settings,
      activeFrom: data.activeFrom,
      activeTo: data.activeTo,
      code,
      status: 'DRAFT',
      questions,
      preloadedStudents: [],
      createdAt: now,
      updatedAt: now,
    };

    // Save everything in ONE call — exam + questions saved together
    await storage.saveExam(newExam);

    // Refresh local state so ExamListPage reflects the new exam
    await refreshExams();

    setCreatedExam(newExam);
  };

  const handleFinish = () => {
    navigate('/guru/ujian');
  };



  return (
    <div className="page-content" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <h1>Buat Ujian Baru</h1>
        <p>Ikuti langkah berikut untuk membuat ujian yang siap dibagikan ke murid.</p>
      </div>

      {/* Wizard Steps */}
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

      {/* Step Content */}
      <div className="card">
        {step === 1 && (
          <Step1Setup
            initial={{ title: data.title, description: data.description, subject: data.subject, activeFrom: data.activeFrom, activeTo: data.activeTo, settings: data.settings }}
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
            onNext={handleStep3Next}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4Review
            data={data}
            onNext={handleStep4Next}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && createdExam && (
          <Step5Publish exam={createdExam} onFinish={handleFinish} />
        )}
      </div>
    </div>
  );
}
