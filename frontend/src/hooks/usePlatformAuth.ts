import { useContext } from 'react';
import { PlatformAuthContext, type PlatformAuthContextValue } from '../context/PlatformAuthContext';

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  return ctx;
}
