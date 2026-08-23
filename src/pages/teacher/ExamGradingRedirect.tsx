import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/** Bookmarkable entry point for fast essay grading from an exam workspace. */
export default function ExamGradingRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) navigate(`/guru/hasil?exam=${encodeURIComponent(id)}&quick=1`, { replace: true });
    else navigate('/guru/hasil', { replace: true });
  }, [id, navigate]);

  return <div className="page-loader"><span className="spinner spinner-lg" /></div>;
}
