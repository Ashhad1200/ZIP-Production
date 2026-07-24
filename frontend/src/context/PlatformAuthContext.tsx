import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import platformApi from '../services/platform.api';

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
}

export interface PlatformAuthContextValue {
  admin: PlatformAdmin | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);

  const { data, isLoading } = useQuery<PlatformAdmin>({
    queryKey: ['platform-auth', 'me'],
    queryFn: async () => {
      const res = await platformApi.get<{ data: PlatformAdmin }>('/auth/me');
      return res.data.data;
    },
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) setAdmin(data);
  }, [data]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await platformApi.post<{ data: PlatformAdmin }>('/auth/login', { email, password });
      setAdmin(res.data.data);
      await queryClient.invalidateQueries({ queryKey: ['platform-auth', 'me'] });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await platformApi.post('/auth/logout');
    setAdmin(null);
    queryClient.removeQueries({ queryKey: ['platform-auth'] });
    queryClient.removeQueries({ queryKey: ['platform'] });
  }, [queryClient]);

  return (
    <PlatformAuthContext.Provider
      value={{ admin, isLoading, isAuthenticated: !!admin, login, logout }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}
