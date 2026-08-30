import { useState } from 'react';
import { BookOpen, Plus, Trash2, Users } from 'lucide-react';
import { Modal } from '../../components/ui';
import { usePersonalExam } from './PersonalExamContext';

type DataKind = 'subject' | 'group' | 'student';

export function PersonalDataModal({ onClose }: { onClose: () => void }) {
  const { subjects, groups, students, addSubject, addGroup, addStudent, remove } = usePersonalExam();
  const [subject, setSubject] = useState('');
  const [group, setGroup] = useState('');
  const [student, setStudent] = useState('');
  const [studentGroup, setStudentGroup] = useState(groups[0]?.id ?? '');
  const [error, setError] = useState('');
  const save = async (kind: DataKind) => { const message = kind === 'subject' ? await addSubject(subject) : kind === 'group' ? await addGroup(group) : await addStudent(studentGroup, student); if (message) return setError(message); setError(''); if (kind === 'subject') setSubject(''); if (kind === 'group') setGroup(''); if (kind === 'student') setStudent(''); };
  const removeItem = async (kind: DataKind, id: string) => { if (!window.confirm('Hapus data ini?')) return; const message = await remove(kind, id); setError(message ?? ''); };
  const removeButton = (kind: DataKind, id: string, name: string) => <button className="btn btn-danger btn-sm" onClick={() => void removeItem(kind, id)} aria-label={`Hapus ${name}`}><Trash2 size={14} /> Hapus</button>;
  return <Modal open title="Kelola murid & mapel" onClose={onClose} size="lg"><p className="form-hint" style={{ marginTop: 0 }}>Data ini hanya dipakai untuk ujian pribadi Anda.</p>{error && <div className="form-error" role="alert">{error}</div>}<section className="card" style={{ marginTop: 16 }}><h3><BookOpen size={17} /> Mapel</h3><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Contoh: Fiqh" /><button className="btn btn-secondary" onClick={() => void save('subject')} disabled={!subject.trim()}><Plus size={15} /> Tambah</button></div>{subjects.map(item => <div className="workspace-participant-row" key={item.id}><strong>{item.name}</strong>{removeButton('subject', item.id, item.name)}</div>)}</section><section className="card" style={{ marginTop: 16 }}><h3><Users size={17} /> Grup & murid</h3><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><input className="form-input" value={group} onChange={e => setGroup(e.target.value)} placeholder="Contoh: Kelas 7A" /><button className="btn btn-secondary" onClick={() => void save('group')} disabled={!group.trim()}><Plus size={15} /> Tambah grup</button></div><div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><select className="form-select" value={studentGroup} onChange={e => setStudentGroup(e.target.value)}><option value="">Pilih grup</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input className="form-input" value={student} onChange={e => setStudent(e.target.value)} placeholder="Nama murid" /><button className="btn btn-primary" onClick={() => void save('student')} disabled={!student.trim() || !studentGroup}><Plus size={15} /> Tambah murid</button></div>{groups.map(item => <div key={item.id} style={{ marginTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><strong>{item.name}</strong>{removeButton('group', item.id, item.name)}</div>{students.filter(s => s.groupId === item.id).map(s => <div className="workspace-participant-row" key={s.id}><span>{s.name}</span>{removeButton('student', s.id, s.name)}</div>)}</div>)}</section></Modal>;
}
