import { supabase } from '../../lib/supabase';
import type { PersonalExamGroup, PersonalExamStudent, PersonalExamSubject } from '../../types';

const mapSubject = (row: any): PersonalExamSubject => ({ id: row.id, teacherId: row.teacher_id, name: row.name });
const mapGroup = (row: any): PersonalExamGroup => ({ id: row.id, teacherId: row.teacher_id, name: row.name });
const mapStudent = (row: any): PersonalExamStudent => ({ id: row.id, teacherId: row.teacher_id, groupId: row.group_id, name: row.name, sortOrder: Number(row.sort_order ?? 0) });

export const personalExamApi = {
  async enabled(teacherId: string) {
    const { data } = await supabase.from('personal_exam_feature_flags').select('enabled').eq('teacher_id', teacherId).maybeSingle();
    return data?.enabled === true;
  },
  async load(teacherId: string) {
    const [subjects, groups, students] = await Promise.all([
      supabase.from('personal_exam_subjects').select('*').eq('teacher_id', teacherId).order('name'),
      supabase.from('personal_exam_groups').select('*').eq('teacher_id', teacherId).order('name'),
      supabase.from('personal_exam_students').select('*').eq('teacher_id', teacherId).order('sort_order').order('created_at'),
    ]);
    if (subjects.error || groups.error || students.error) throw new Error(subjects.error?.message || groups.error?.message || students.error?.message || 'Gagal memuat data ujian pribadi.');
    return { subjects: (subjects.data ?? []).map(mapSubject), groups: (groups.data ?? []).map(mapGroup), students: (students.data ?? []).map(mapStudent) };
  },
  async saveSubject(teacherId: string, name: string) { const { error } = await supabase.from('personal_exam_subjects').insert({ teacher_id: teacherId, name: name.trim() }); return error?.message; },
  async saveGroup(teacherId: string, name: string) { const { error } = await supabase.from('personal_exam_groups').insert({ teacher_id: teacherId, name: name.trim() }); return error?.message; },
  async nextSortOrder(groupId: string) {
    const { data, error } = await supabase.from('personal_exam_students').select('sort_order').eq('group_id', groupId).order('sort_order', { ascending: false }).limit(1);
    if (error) return { error: error.message };
    return { next: Number(data?.[0]?.sort_order ?? 0) + 1 };
  },
  async saveStudent(teacherId: string, groupId: string, name: string) {
    const order = await this.nextSortOrder(groupId); if (order.error) return order.error;
    const { error } = await supabase.from('personal_exam_students').insert({ teacher_id: teacherId, group_id: groupId, name: name.trim(), sort_order: order.next }); return error?.message;
  },
  async saveStudents(teacherId: string, groupId: string, names: string[]) {
    const order = await this.nextSortOrder(groupId); if (order.error) return order.error;
    const { error } = await supabase.from('personal_exam_students').insert(names.map((name, index) => ({ teacher_id: teacherId, group_id: groupId, name, sort_order: order.next! + index }))); return error?.message;
  },
  async delete(kind: 'subject' | 'group' | 'student', id: string) { const table = `personal_exam_${kind === 'subject' ? 'subjects' : kind === 'group' ? 'groups' : 'students'}`; const { error } = await supabase.from(table).delete().eq('id', id); return error?.message; },
};
