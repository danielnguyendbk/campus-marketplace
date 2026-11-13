'use client';

import { useSyncExternalStore } from 'react';
import { authApi, type AuthApi } from './api';

export function useSession(client: AuthApi = authApi) {
  return useSyncExternalStore(client.subscribe, client.getSession, () => null);
}
