import type { Exam, ExamSettings } from '../types';

export const getPassingScore = (settings: ExamSettings): number => {
  const score = Number(settings.passingScore ?? 70);
  return Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 70;
};

export const getNavigationMode = (settings: ExamSettings): 'FREE' | 'SEQUENTIAL' =>
  settings.navigationMode === 'SEQUENTIAL' ? 'SEQUENTIAL' : 'FREE';

export const getScoreReleaseMode = (settings: ExamSettings): NonNullable<ExamSettings['scoreReleaseMode']> => {
  if (settings.scoreReleaseMode) return settings.scoreReleaseMode;
  if (!settings.showScoreAfterSubmit) return 'NEVER';
  return settings.releaseResultsAfterGrading ? 'AFTER_GRADING' : 'IMMEDIATE';
};

export const getAnswerKeyReleaseMode = (settings: ExamSettings): NonNullable<ExamSettings['answerKeyReleaseMode']> => {
  if (settings.answerKeyReleaseMode) return settings.answerKeyReleaseMode;
  return settings.showAnswerKeyAfterSubmit ? 'AFTER_EXAM_END' : 'NEVER';
};

export const isExamEndedForRelease = (exam: Pick<Exam, 'status' | 'activeTo'>): boolean =>
  exam.status === 'ENDED' || (!!exam.activeTo && new Date(exam.activeTo).getTime() <= Date.now());

export const canShowScore = (exam: Exam, hasPendingEssay: boolean): boolean => {
  const mode = getScoreReleaseMode(exam.settings);
  if (mode === 'NEVER' || hasPendingEssay) return false;
  if (mode === 'AFTER_EXAM_END') return isExamEndedForRelease(exam);
  return true;
};

export const canShowAnswerKey = (exam: Exam): boolean => {
  const mode = getAnswerKeyReleaseMode(exam.settings);
  return mode === 'IMMEDIATE' || (mode === 'AFTER_EXAM_END' && isExamEndedForRelease(exam));
};

export const canShowRanking = (exam: Exam, hasPendingEssay: boolean): boolean =>
  exam.settings.showRankingAfterSubmit !== false && canShowScore(exam, hasPendingEssay);

export const shouldAutoSubmitOnTimeUp = (settings: ExamSettings): boolean => settings.autoSubmitOnTimeUp !== false;
