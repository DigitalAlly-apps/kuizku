import { createContext, useContext, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { PersonalExamGroup, PersonalExamStudent, PersonalExamSubject } from '../../types';
import { personalExamApi } from './api';

type ContextValue = { enabled: boolean; loading: boolean; subjects: PersonalExamSubject[]; groups: PersonalExamGroup[]; students: PersonalExamStudent[]; refresh: () => Promise<void>; addSubject: (name: string) => Promise<string | undefined>; addGroup: (name: string) => Promise<string | undefined>; addStudent: (groupId: string, name: string) => Promise<string | undefined>; addStudents: (groupId: string, names: string[]) => Promise<string | undefined>; remove: (kind: 'subject' | 'group' | 'student', id: string) => Promise<string | undefined> };
const Context = createContext<ContextValue | null>(null);

export function PersonalExamProvider({ children }: { children: React.ReactNode }) {
  const { currentTeacher } = useApp();
  const [enabled, setEnabled] = useState(false); const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<PersonalExamSubject[]>([]); const [groups, setGroups] = useState<PersonalExamGroup[]>([]); const [students, setStudents] = useState<PersonalExamStudent[]>([]);
  const refresh = async () => { if (!currentTeacher) { setEnabled(false); setLoading(false); return; } setLoading(true); try { const active = await personalExamApi.enabled(currentTeacher.id); setEnabled(active); if (active) { const data = await personalExamApi.load(currentTeacher.id); setSubjects(data.subjects); setGroups(data.groups); setStudents(data.students); } } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, [currentTeacher?.id]);
  const mutate = async (fn: () => Promise<string | undefined>) => { const error = await fn(); if (!error) await refresh(); return error; };
  const value: ContextValue = { enabled, loading, subjects, groups, students, refresh, addSubject: name => currentTeacher ? mutate(() => personalExamApi.saveSubject(currentTeacher.id, name)) : Promise.resolve('Sesi guru tidak ditemukan.'), addGroup: name => currentTeacher ? mutate(() => personalExamApi.saveGroup(currentTeacher.id, name)) : Promise.resolve('Sesi guru tidak ditemukan.'), addStudent: (groupId, name) => currentTeacher ? mutate(() => personalExamApi.saveStudent(currentTeacher.id, groupId, name)) : Promise.resolve('Sesi guru tidak ditemukan.'), addStudents: (groupId, names) => currentTeacher ? mutate(() => personalExamApi.saveStudents(currentTeacher.id, groupId, names)) : Promise.resolve('Sesi guru tidak ditemukan.'), remove: (kind, id) => mutate(() => personalExamApi.delete(kind, id)) };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePersonalExam() { const value = useContext(Context); if (!value) throw new Error('usePersonalExam must be used within PersonalExamProvider'); return value; }
