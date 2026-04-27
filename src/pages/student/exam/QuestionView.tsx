// QuestionView — renders PG or Essay question and handles answer input
import { useCallback } from 'react';
import type { Question, StudentAnswer } from '../../../types';

interface Props {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  currentAnswer?: StudentAnswer;
  onAnswer: (answer: StudentAnswer) => void;
  perQRemaining?: number;
  perQUrgency?: string;
}

const OPTION_LETTERS = 'ABCDEF';

export default function QuestionView({
  question, questionNumber,
  currentAnswer, onAnswer, perQUrgency,
}: Props) {

  const handleSelectOption = useCallback((optionId: string) => {
    onAnswer({
      questionId: question.id,
      questionType: 'MULTIPLE_CHOICE',
      selectedOptionId: optionId,
    });
  }, [question.id, onAnswer]);

  const handleEssayChange = useCallback((text: string) => {
    onAnswer({
      questionId: question.id,
      questionType: 'ESSAY',
      essayText: text,
    });
  }, [question.id, onAnswer]);

  const selectedId = currentAnswer?.selectedOptionId;
  const essayText = currentAnswer?.essayText ?? '';

  return (
    <div key={question.id} style={{ animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
      {/* Question number + type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--sp-5)' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.875rem', color: 'white', flexShrink: 0,
        }}>
          {questionNumber}
        </div>
        <div>
          <span className={`badge ${question.type === 'MULTIPLE_CHOICE' ? 'badge-pg' : 'badge-essay'}`}>
            {question.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Bobot: <strong style={{ color: 'var(--text-primary)' }}>{question.weight}</strong> poin
        </div>
      </div>

      {/* Question text */}
      <div style={{
        fontSize: '1rem',
        color: 'var(--text-primary)',
        lineHeight: 1.7,
        marginBottom: 'var(--sp-6)',
        padding: 'var(--sp-5)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        fontWeight: 500,
      }}>
        {question.text}
      </div>

      {/* Multiple Choice Options */}
      {question.type === 'MULTIPLE_CHOICE' && question.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {question.options.map((opt, idx) => {
            const isSelected = selectedId === opt.id;
            return (
              <button
                key={opt.id}
                id={`opt-${opt.id}`}
                type="button"
                onClick={() => handleSelectOption(opt.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
                  padding: 'var(--sp-4) var(--sp-5)',
                  background: isSelected ? 'var(--primary-light)' : 'var(--surface)',
                  border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--r-lg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  boxShadow: isSelected ? '0 0 0 1px var(--primary)' : 'none',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              >
                {/* Letter circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: isSelected ? 'var(--primary)' : 'var(--surface-2)',
                  border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-strong)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.78rem',
                  color: isSelected ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}>
                  {OPTION_LETTERS[idx]}
                </div>
                <span style={{
                  flex: 1, fontSize: '0.9rem', lineHeight: 1.6,
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 600 : 400,
                  paddingTop: 2,
                }}>
                  {opt.text}
                </span>
                {/* Selected indicator */}
                {isSelected && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--primary)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
                  }}>
                    <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>
                  </div>
                )}
              </button>
            );
          })}

          {selectedId && (
            <button
              type="button"
              onClick={() => onAnswer({ questionId: question.id, questionType: 'MULTIPLE_CHOICE', selectedOptionId: undefined })}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', padding: '4px 0' }}>
              × Hapus pilihan
            </button>
          )}
        </div>
      )}

      {/* Essay Input */}
      {question.type === 'ESSAY' && (
        <div>
          <textarea
            id={`essay-${question.id}`}
            className="form-textarea"
            rows={8}
            placeholder="Tulis jawaban Anda di sini..."
            value={essayText}
            onChange={e => handleEssayChange(e.target.value)}
            style={{
              fontSize: '0.95rem',
              lineHeight: 1.7,
              resize: 'vertical',
              minHeight: 180,
              borderColor: essayText.trim() ? 'var(--success)' : undefined,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>{essayText.trim() ? '✓ Jawaban tersimpan otomatis' : 'Belum dijawab'}</span>
            <span>{essayText.length} karakter</span>
          </div>
        </div>
      )}

      {/* Urgency pulse for per-question */}
      {perQUrgency === 'critical' && (
        <div style={{
          marginTop: 'var(--sp-4)', padding: '8px 14px',
          background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--r-md)', fontSize: '0.8rem', color: 'var(--danger)',
          animation: 'pulse 1s infinite', textAlign: 'center', fontWeight: 600,
        }}>
          ⚠️ Waktu hampir habis! Soal akan berpindah otomatis.
        </div>
      )}
    </div>
  );
}
