import type { PersonalExamStudent } from '../../types';

/** Keeps saved-roster participants in the order they were first entered. */
export function orderStudentsByAttendance(students: PersonalExamStudent[]) {
  return [...students].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}
