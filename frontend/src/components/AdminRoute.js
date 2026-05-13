import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is admin (you can modify this logic based on your user model)
  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
