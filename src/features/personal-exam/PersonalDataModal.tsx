import { useState } from 'react';
import { BookOpen, Plus, Trash2, Users } from 'lucide-react';
import { Modal } from '../../components/ui';
import { usePersonalExam } from './PersonalExamContext';
import { orderStudentsByAttendance } from './studentOrder';

type DataKind = 'subject' | 'group' | 'student';

export function PersonalDataModal({ onClose }: { onClose: () => void }) {
  const { subjects, groups, students, addSubject, addGroup, addStudent, addStudents, remove, removeStudent, removeStudentsInGroup } = usePersonalExam();
  const [subject, setSubject] = useState('');
  const [group, setGroup] = useState('');
  const [student, setStudent] = useState('');
  const [pastedStudents, setPastedStudents] = useState('');
  const [studentGroup, setStudentGroup] = useState(groups[0]?.id ?? '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const save = async (kind: DataKind) => {
    const message = kind === 'subject' ? await addSubject(subject) : kind === 'group' ? await addGroup(group) : await addStudent(studentGroup, student);
    if (message) return setError(message);
    setError('');
    if (kind === 'subject') setSubject('');
    if (kind === 'group') setGroup('');
    if (kind === 'student') setStudent('');
  };

  const removeItem = async (kind: DataKind, id: string, name: string) => {
    if (kind === 'group' && students.some(studentItem => studentItem.groupId === id)) {
      setNotice('');
      setError(`Grup ${name} masih memiliki murid. Gunakan “Hapus semua murid” terlebih dahulu.`);
      return;
    }
    if (!window.confirm(`Hapus ${kind === 'student' ? 'murid' : 'data'} “${name}”?`)) return;
    setRemoving(`${kind}:${id}`);
    setError('');
    const message = kind === 'student' ? await removeStudent(id) : await remove(kind, id);
    setRemoving(null);
    if (message) return setError(message);
    setNotice(`${kind === 'student' ? 'Murid' : 'Data'} “${name}” berhasil dihapus.`);
  };

  const removeAllStudents = async (groupId: string, groupName: string) => {
    const count = students.filter(studentItem => studentItem.groupId === groupId).length;
    if (!count || !window.confirm(`Hapus semua ${count} murid dari grup “${groupName}”? Nama grup tetap tersimpan.`)) return;
    setRemoving(`all:${groupId}`);
    setError('');
    const message = await removeStudentsInGroup(groupId);
    setRemoving(null);
    if (message) return setError(message);
    setNotice(`${count} murid berhasil dihapus dari grup ${groupName}.`);
  };

  const savePastedStudents = async () => {
    const existing = new Set(students.filter(item => item.groupId === studentGroup).map(item => item.name.trim().toLocaleLowerCase()));
    const names = [...new Set(pastedStudents.split(/\r?\n/).map(line => line.split('\t')[0].trim()).filter(name => name && !existing.has(name.toLocaleLowerCase())))];
    if (!names.length) return setError('Tidak ada nama baru untuk ditambahkan.');
    const message = await addStudents(studentGroup, names);
    if (message) return setError(message);
    setPastedStudents('');
    setError('');
    setNotice(`${names.length} murid berhasil dimasukkan ke grup ${groups.find(groupItem => groupItem.id === studentGroup)?.name ?? ''}.`);
  };

  const removeButton = (kind: DataKind, id: string, name: string) => <button className="btn btn-danger btn-sm" onClick={() => void removeItem(kind, id, name)} disabled={removing !== null} aria-label={`Hapus ${name}`}><Trash2 size={14} /> {removing === `${kind}:${id}` ? 'Menghapus…' : 'Hapus'}</button>;

  return <Modal open title="Kelola murid & mapel" onClose={onClose} size="lg"><p className="form-hint" style={{ marginTop: 0 }}>Urutan nama di grup menjadi nomor absen saat ujian dibuat.</p>{error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="form-hint" role="status" style={{ color: 'var(--success)', fontWeight: 700 }}>{notice}</div>}<section className="card" style={{ marginTop: 16 }}><h3><BookOpen size={17} /> Mapel</h3><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Contoh: Fiqh" /><button className="btn btn-secondary" onClick={() => void save('subject')} disabled={!subject.trim()}><Plus size={15} /> Tambah</button></div>{subjects.map(item => <div className="workspace-participant-row" key={item.id}><strong>{item.name}</strong>{removeButton('subject', item.id, item.name)}</div>)}</section><section className="card" style={{ marginTop: 16 }}><h3><Users size={17} /> Grup & murid</h3><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><input className="form-input" value={group} onChange={e => setGroup(e.target.value)} placeholder="Contoh: Kelas 7A" /><button className="btn btn-secondary" onClick={() => void save('group')} disabled={!group.trim()}><Plus size={15} /> Tambah grup</button></div><div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><select className="form-select" value={studentGroup} onChange={e => setStudentGroup(e.target.value)}><option value="">Pilih grup</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name} ({students.filter(studentItem => studentItem.groupId === item.id).length} murid)</option>)}</select><input className="form-input" value={student} onChange={e => setStudent(e.target.value)} placeholder="Nama murid" /><button className="btn btn-primary" onClick={() => void save('student')} disabled={!student.trim() || !studentGroup}><Plus size={15} /> Tambah murid</button></div><div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Paste nama dari Excel</label><textarea className="form-textarea" rows={4} value={pastedStudents} onChange={event => setPastedStudents(event.target.value)} placeholder={'Copy satu kolom nama dari Excel, lalu paste di sini.\nSatu baris = satu murid.'} /><span className="form-hint">Urutan baris dipertahankan sebagai nomor absen. Kolom selain nama diabaikan.</span><button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => void savePastedStudents()} disabled={!studentGroup || !pastedStudents.trim()}><Plus size={15} /> Tambah semua nama</button></div>{groups.map(item => { const groupStudents = orderStudentsByAttendance(students.filter(studentItem => studentItem.groupId === item.id)); return <div key={item.id} style={{ marginTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><strong>{item.name} · {groupStudents.length} murid</strong><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{groupStudents.length > 0 && <button className="btn btn-danger btn-sm" onClick={() => void removeAllStudents(item.id, item.name)} disabled={removing !== null}><Trash2 size={14} /> {removing === `all:${item.id}` ? 'Menghapus…' : 'Hapus semua murid'}</button>}{removeButton('group', item.id, item.name)}</div></div>{groupStudents.map((studentItem, index) => <div className="workspace-participant-row" key={studentItem.id}><span><strong>No. {String(index + 1).padStart(2, '0')}</strong> · {studentItem.name}</span>{removeButton('student', studentItem.id, studentItem.name)}</div>)}</div>; })}</section></Modal>;
}
