import { useState, useCallback } from 'react';

export function useCreditRequests(fetchPresses?: () => void) {
  const [creditRequests, setCreditRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);
  const [adminNotesText, setAdminNotesText] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  const fetchCreditRequests = useCallback(async (silent = false) => {
    if (!silent) setRequestsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/credit-requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch credit requests');
      setCreditRequests(data.requests || []);
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to load credit requests.');
    } finally {
      if (!silent) setRequestsLoading(false);
    }
  }, []);

  const handleProcessRequest = async (requestId: number, status: 'APPROVED' | 'REJECTED') => {
    setProcessingRequestId(requestId);
    setError('');
    try {
      const notes = adminNotesText[requestId] || '';
      const res = await fetch('/api/superadmin/credit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status, adminNotes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process request');
      
      setCreditRequests(prev => prev.map(r => r.id === requestId ? { 
        ...r, 
        status, 
        adminNotes: notes, 
        press: r.press ? { ...r.press, credits: data.request?.press?.credits ?? r.press.credits } : r.press
      } : r));
      
      if (fetchPresses) fetchPresses();
    } catch (err: any) {
      setError(err.message || 'Failed to process request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  return {
    creditRequests, setCreditRequests,
    requestsLoading, setRequestsLoading,
    processingRequestId, setProcessingRequestId,
    adminNotesText, setAdminNotesText,
    error, setError,
    fetchCreditRequests,
    handleProcessRequest
  };
}
