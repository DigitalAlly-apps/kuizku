import type { PreloadedStudent, Submission } from '../types';

function normalize(value?: string): string {
  return (value ?? '').trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');
}

/** Matches every roster entry to at most one completed submission. */
export function matchRosterToCompletedSubmissions(
  roster: PreloadedStudent[],
  submissions: Submission[],
): Array<Submission | undefined> {
  const completed = submissions.filter(submission => submission.isComplete && !submission.isReturned);
  const claimed = new Set<string>();

  const matches = roster.map(student => {
    if (!student.participantId) return undefined;
    const match = completed.find(submission => !claimed.has(submission.id) && submission.participantId === student.participantId);
    if (match) claimed.add(match.id);
    return match;
  });

  return roster.map((student, index) => {
    if (matches[index]) return matches[index];
    const match = completed.find(submission => {
      if (claimed.has(submission.id)) return false;
      if (student.nis?.trim() && submission.nis?.trim() === student.nis.trim()) return true;
      return normalize(submission.studentName) === normalize(student.name);
    });
    if (match) claimed.add(match.id);
    return match;
  });
}
