import { useState, useEffect, useRef, useCallback } from 'react';
import { Order, Client, Template } from '../types';

export function useOrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('OWNER');
  const [pressId, setPressId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 30;
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchOrders = useCallback(async (p: number, sb: string, sd: string, s: string) => {
    try {
      const params = new URLSearchParams({
        page: String(p), pageSize: String(PAGE_SIZE), sortBy: sb, sortDir: sd,
      });
      if (s.trim()) {
        params.append('search', s.trim());
      }
      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
        setTotal(json.total ?? 0);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      await fetchOrders(page, sortBy, sortDir, debouncedSearch);

      const clientsRes = await fetch('/api/clients');
      if (clientsRes.ok) {
        const json = await clientsRes.json();
        setClients(json.clients || []);
        if (json.clients?.length > 0) setClientId(String(json.clients[0].id));
      }

      const templatesRes = await fetch('/api/templates');
      if (templatesRes.ok) {
        const json = await templatesRes.json();
        const allTemplates = [
          ...(json.templates || []),
          ...(json.globalTemplates || []).map((t: any) => ({ ...t, name: `⭐ ${t.name} (Starter)` }))
        ];
        setTemplates(allTemplates);
        if (allTemplates.length > 0) setTemplateId(String(allTemplates[0].id));
      }

      const profileRes = await fetch('/api/press/profile');
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        if (profileJson.success && profileJson.press) {
          setPressId(profileJson.press.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchOrders, page, sortBy, sortDir, debouncedSearch]);

  useEffect(() => {
    fetchData();
    (async () => {
      try {
        const res = await fetch('/api/settings/me');
        if (res.ok) { const j = await res.json(); if (j.user?.role) setRole(j.user.role); }
      } catch { /* silent */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchOrders(page, sortBy, sortDir, debouncedSearch);
  }, [page, sortBy, sortDir, debouncedSearch, fetchOrders]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  return {
    orders, setOrders,
    clients, setClients,
    templates, setTemplates,
    loading, setLoading,
    role, setRole,
    pressId, setPressId,
    page, setPage,
    total, setTotal,
    PAGE_SIZE,
    sortBy, setSortBy,
    sortDir, setSortDir,
    search, setSearch,
    debouncedSearch,
    clientId, setClientId,
    templateId, setTemplateId,
    fetchOrders,
    fetchData,
    handleSort
  };
}
