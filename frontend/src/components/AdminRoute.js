import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="loading-container">
      <p>Loading...</p>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is admin
  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
}
