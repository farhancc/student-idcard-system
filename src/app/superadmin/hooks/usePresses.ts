import { useState, useCallback } from 'react';
import { Press } from '../types';

export function usePresses() {
  const [presses, setPresses] = useState<Press[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Onboarding Modal State
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [onboardPressName, setOnboardPressName] = useState('');
  const [onboardOwnerName, setOnboardOwnerName] = useState('');
  const [onboardEmail, setOnboardEmail] = useState('');
  const [onboardPassword, setOnboardPassword] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardCity, setOnboardCity] = useState('');
  const [onboardPlan, setOnboardPlan] = useState('BASIC');
  const [onboardCredits, setOnboardCredits] = useState('100');
  const [onboardSuccessMessage, setOnboardSuccessMessage] = useState('');
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);

  // Password Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPress, setResetPress] = useState<Press | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  // Credits Modal State
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [selectedCreditsPress, setSelectedCreditsPress] = useState<Press | null>(null);
  const [creditsAmount, setCreditsAmount] = useState('');
  const [creditsSuccessMessage, setCreditsSuccessMessage] = useState('');
  const [creditsSubmitting, setCreditsSubmitting] = useState(false);

  // Press Detail Drawer
  const [detailPress, setDetailPress] = useState<Press | null>(null);

  const fetchPresses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/presses');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch presses');
      setPresses(data.presses || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load presses.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOnboardPress = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOnboardSuccessMessage('');
    setOnboardSubmitting(true);

    try {
      const res = await fetch('/api/superadmin/presses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pressName: onboardPressName,
          ownerName: onboardOwnerName,
          email: onboardEmail,
          password: onboardPassword,
          phone: onboardPhone,
          city: onboardCity,
          plan: onboardPlan,
          credits: Number(onboardCredits)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to onboard press');

      setOnboardSuccessMessage(`Successfully onboarded Printing Press: "${onboardPressName}"!`);
      
      setPresses(prev => [data.press, ...prev]);

      setOnboardPressName('');
      setOnboardOwnerName('');
      setOnboardEmail('');
      setOnboardPassword('');
      setOnboardPhone('');
      setOnboardCity('');
      setOnboardPlan('BASIC');
      setOnboardCredits('100');

      setTimeout(() => {
        setOnboardModalOpen(false);
        setOnboardSuccessMessage('');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to onboard press.');
    } finally {
      setOnboardSubmitting(false);
    }
  };

  const handleToggleStatus = async (pressId: number, currentStatus: boolean) => {
    setActionLoading(pressId);
    setError('');
    try {
      const res = await fetch('/api/superadmin/presses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pressId, isActive: !currentStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update press status');
      
      setPresses(prev => prev.map(p => p.id === pressId ? { ...p, isActive: !currentStatus } : p));
    } catch (err: any) {
      setError(err.message || 'Failed to toggle status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleHardDeletePress = async (pressId: number, pressName: string) => {
    if (!confirm(`PERMANENT HARD DELETE WARNING:\n\nAre you sure you want to permanently delete Press "${pressName}"?\n\nThis will HARD DELETE all associated users, clients, cardholders, orders, templates, and media files. This action CANNOT be undone!`)) {
      return;
    }

    const confirmTyped = prompt(`Type "${pressName}" to confirm permanent hard deletion:`);
    if (confirmTyped !== pressName) {
      alert('Confirmation name did not match. Hard deletion cancelled.');
      return;
    }

    setActionLoading(pressId);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/presses/${pressId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to hard delete press');

      setPresses(prev => prev.filter(p => p.id !== pressId));
      if (detailPress?.id === pressId) setDetailPress(null);
      alert(data.message || 'Press hard deleted successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to hard delete press.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangePlan = async (pressId: number, newPlan: string) => {
    setActionLoading(pressId);
    setError('');
    try {
      const res = await fetch('/api/superadmin/presses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pressId, plan: newPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change plan');
      
      setPresses(prev => prev.map(p => p.id === pressId ? { ...p, plan: newPlan } : p));
    } catch (err: any) {
      setError(err.message || 'Failed to change plan.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPress || !newPassword) return;
    
    setActionLoading(resetPress.id);
    setResetSuccessMessage('');
    setError('');
    try {
      const res = await fetch('/api/superadmin/presses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pressId: resetPress.id, 
          resetPassword: newPassword, 
          email: resetPress.email 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      
      setResetSuccessMessage(`Successfully updated OWNER password for "${resetPress.name}".`);
      setNewPassword('');
      setTimeout(() => {
        setResetModalOpen(false);
        setResetPress(null);
        setResetSuccessMessage('');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditsPress || !creditsAmount) return;

    setCreditsSubmitting(true);
    setCreditsSuccessMessage('');
    setError('');

    try {
      const res = await fetch('/api/superadmin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pressId: selectedCreditsPress.id,
          amount: Number(creditsAmount)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update credits');

      setCreditsSuccessMessage(`Successfully updated credits! New balance: ${data.credits} credits.`);
      
      setPresses(prev => prev.map(p => p.id === selectedCreditsPress.id ? { ...p, credits: data.credits } : p));
      setSelectedCreditsPress(prev => prev ? { ...prev, credits: data.credits } : null);
      
      setCreditsAmount('');
      setTimeout(() => {
        setCreditsModalOpen(false);
        setSelectedCreditsPress(null);
        setCreditsSuccessMessage('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update credits.');
    } finally {
      setCreditsSubmitting(false);
    }
  };

  return {
    presses, setPresses,
    loading, setLoading,
    actionLoading, setActionLoading,
    error, setError,
    onboardModalOpen, setOnboardModalOpen,
    onboardPressName, setOnboardPressName,
    onboardOwnerName, setOnboardOwnerName,
    onboardEmail, setOnboardEmail,
    onboardPassword, setOnboardPassword,
    onboardPhone, setOnboardPhone,
    onboardCity, setOnboardCity,
    onboardPlan, setOnboardPlan,
    onboardCredits, setOnboardCredits,
    onboardSuccessMessage, setOnboardSuccessMessage,
    onboardSubmitting, setOnboardSubmitting,
    resetModalOpen, setResetModalOpen,
    resetPress, setResetPress,
    newPassword, setNewPassword,
    resetSuccessMessage, setResetSuccessMessage,
    creditsModalOpen, setCreditsModalOpen,
    selectedCreditsPress, setSelectedCreditsPress,
    creditsAmount, setCreditsAmount,
    creditsSuccessMessage, setCreditsSuccessMessage,
    creditsSubmitting, setCreditsSubmitting,
    detailPress, setDetailPress,
    fetchPresses,
    handleOnboardPress,
    handleToggleStatus,
    handleHardDeletePress,
    handleChangePlan,
    handleResetPassword,
    handleUpdateCredits
  };
}
