import type { PreloadedStudent, Submission } from '../types';

function normalize(value?: string): string {
  return (value ?? '').trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');
}

function matchRosterToSubmissions(
  roster: PreloadedStudent[],
  submissions: Submission[],
): Array<Submission | undefined> {
  const claimed = new Set<string>();

  const matches = roster.map(student => {
    if (!student.participantId) return undefined;
    const match = submissions.find(submission => !claimed.has(submission.id) && submission.participantId === student.participantId);
    if (match) claimed.add(match.id);
    return match;
  });

  return roster.map((student, index) => {
    if (matches[index]) return matches[index];
    const match = submissions.find(submission => {
      if (claimed.has(submission.id)) return false;
      if (student.nis?.trim() && submission.nis?.trim() === student.nis.trim()) return true;
      return normalize(submission.studentName) === normalize(student.name);
    });
    if (match) claimed.add(match.id);
    return match;
  });
}

/** Matches every roster entry to at most one completed, non-returned submission. */
export function matchRosterToCompletedSubmissions(
  roster: PreloadedStudent[],
  submissions: Submission[],
): Array<Submission | undefined> {
  return matchRosterToSubmissions(roster, submissions.filter(submission => submission.isComplete && !submission.isReturned));
}

export interface RosterAttendance {
  student: PreloadedStudent;
  completedSubmission?: Submission;
  draftSubmission?: Submission;
}

/**
 * Attendance is based on a completed, non-returned submission. A draft is
 * surfaced only as progress context and never marks a roster participant done.
 */
export function getRosterAttendance(
  roster: PreloadedStudent[],
  submissions: Submission[],
): RosterAttendance[] {
  const completed = matchRosterToCompletedSubmissions(roster, submissions);
  const drafts = matchRosterToSubmissions(roster, submissions.filter(submission => !submission.isComplete && !submission.isReturned));
  return roster.map((student, index) => ({
    student,
    completedSubmission: completed[index],
    draftSubmission: completed[index] ? undefined : drafts[index],
  }));
}
