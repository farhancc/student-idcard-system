import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import type { OrderDetail, OrderLog, OrderNote } from '../types';

export function useOrderDetail(orderId: number) {
  const router = useRouter();
  const { toast } = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('OWNER');
  const [transitioning, setTransitioning] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  const isOwner = role === 'OWNER';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/me');
        if (res.ok) { const j = await res.json(); if (j.user?.role) setRole(j.user.role); }
      } catch { /* silent */ }
    })();
  }, []);

  const fetchData = async () => {
    try {
      const orderRes = await fetch(`/api/orders/${orderId}`);
      if (!orderRes.ok) throw new Error('Order not found');
      const orderData = await orderRes.json();
      setOrder(orderData.order);
      setLogs(orderData.logs || []);
      setNotes(orderData.notes || []);
    } catch (err) {
      console.error(err);
      router.push('/dashboard/orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchData();
  }, [orderId]);

  const handleWorkflowAction = async (newStatus: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      toast(`Order stage updated to: ${newStatus}`, 'success');
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Status transition error', 'error');
    } finally {
      setTransitioning(false);
    }
  };

  const handleClone = async () => {
    if (!confirm('Are you sure you want to clone this order settings as a new Draft?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/clone`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clone failed');

      toast('Order cloned successfully!', 'success');
      router.push(`/dashboard/orders/${data.order.id}`);
    } catch (err: any) {
      toast(err.message || 'Clone error', 'error');
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/whatsapp-link`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not construct share link');
      window.open(data.whatsappUrl, '_blank');
    } catch (err: any) {
      toast(err.message || 'Error occurred', 'error');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    try {
      const res = await fetch(`/api/orders/${orderId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      });
      if (res.ok) {
        setNoteContent('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return {
    order, setOrder,
    logs,
    notes,
    loading,
    role,
    isOwner,
    transitioning, setTransitioning,
    noteContent, setNoteContent,
    fetchData,
    handleWorkflowAction,
    handleClone,
    handleWhatsAppShare,
    handleAddNote
  };
}
