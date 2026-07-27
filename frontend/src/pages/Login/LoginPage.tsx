import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../../components/ui';
import type { User } from '../../types';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const org = searchParams.get('org') ?? undefined;

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['auth', 'users', org],
    queryFn: async () => {
      const res = await api.get<{ data: User[] }>('/auth/users', { params: org ? { org } : undefined });
      return res.data.data;
    },
  });

  const handleLogin = async (userId: string) => {
    await login(userId);
    navigate('/dashboard', { replace: true });
  };

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">ZIP Production</h1>
          <p className="mt-2 text-gray-600">Select your account</p>
        </div>

        <div className="space-y-3">
          {users?.map((user) => (
            <button
              key={user.id}
              onClick={() => handleLogin(user.id)}
              className="flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">
                  {user.role.replace(/_/g, ' ')}
                </p>
              </div>
            </button>
          ))}
        </div>

        {users?.length === 0 && (
          <p className="text-center text-gray-500">No active users found</p>
        )}
      </div>
    </div>
  );
}
