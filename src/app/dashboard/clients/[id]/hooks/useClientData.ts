import { useState, useEffect, useCallback } from 'react';
import { Client, Cardholder, QuickTemplate } from '../types';

export function useClientData(clientId: number) {
  const [client, setClient] = useState<Client | null>(null);
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [clientTemplates, setClientTemplates] = useState<any[]>([]);
  const [quickTemplates, setQuickTemplates] = useState<QuickTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const clientRes = await fetch(`/api/clients/${clientId}`);
      if (!clientRes.ok) throw new Error('Client not found');
      const clientData = await clientRes.json();
      setClient(clientData.client);

      const cardholdersRes = await fetch(`/api/clients/${clientId}/cardholders`);
      if (cardholdersRes.ok) {
        const cardholdersData = await cardholdersRes.json();
        setCardholders(cardholdersData.cardholders || []);
        if (cardholdersData.templates) {
          setClientTemplates(cardholdersData.templates);
        }
      }
    } catch (err) {
      console.error(err);
      // Let the page handle redirection if needed, or we could pass router
    }
  }, [clientId]);

  const fetchQuickTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        const list = [
          ...(json.templates || []),
          ...(json.globalTemplates || []).map((t: any) => ({ ...t, name: `⭐ ${t.name} (Starter)` }))
        ];
        setQuickTemplates(list);
      }
    } catch (err) { console.error(err); }
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchData(),
      fetchQuickTemplates()
    ]);
    setLoading(false);
  }, [fetchData, fetchQuickTemplates]);

  useEffect(() => {
    if (clientId) {
      setLoading(true);
      Promise.all([fetchData(), fetchQuickTemplates()]).finally(() => setLoading(false));
    }
  }, [clientId, fetchData, fetchQuickTemplates]);

  return {
    client,
    cardholders,
    setCardholders,
    clientTemplates,
    quickTemplates,
    loading,
    handleRefresh,
    fetchData,
    fetchQuickTemplates,
  };
}
