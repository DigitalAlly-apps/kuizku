import { Navigate } from 'react-router-dom';

// Halaman billing dihapus untuk pemakaian pribadi
export default function BillingPage() {
  return <Navigate to="/guru/dashboard" replace />;
}
