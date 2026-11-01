import { useState, useEffect } from 'react';
import { api, HealthResponse } from '../services/api';

export interface UseApiHealthResult {
  data: HealthResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiHealth(): UseApiHealthResult {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getHealth();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối đến Backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return { data, loading, error, refetch: fetchHealth };
}
