import { useEffect, useState } from 'react';
import apiClient from '../../../services/api-client';

// GET /clients split the way the web forms do: fleet clients (everyone but
// recycle_client logins) or recycling partners (kind = 'recycle').
export default function useFleetClients(enabled = true, kind = 'fleet') {
  const [clients, setClients] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    apiClient
      .get('/clients')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data || [];
        if (!cancelled) setClients(list.filter((c) => (kind === 'recycle' ? c.user_role === 'recycle_client' : c.user_role !== 'recycle_client')));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, kind]);
  return clients;
}
