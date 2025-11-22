import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (userRole) {
        switch (userRole) {
          case 'super_admin':
            navigate('/super-admin');
            break;
          case 'admin':
            navigate('/admin');
            break;
          case 'delivery':
            navigate('/delivery');
            break;
          case 'user':
          default:
            navigate('/shop');
            break;
        }
      }
    }
  }, [user, userRole, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
