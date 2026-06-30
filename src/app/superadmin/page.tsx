'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, Users, FolderKanban, ShieldCheck, 
  Power, Key, LogOut, Loader2, Sparkles, RefreshCw,
  DollarSign, TrendingUp, BarChart3, Search, Plus,
  Eye, X, CreditCard, FileText
} from 'lucide-react';

interface PressClient {
  id: number;
  name: string;
  type: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  totalOrders: number;
  totalCards: number;
  totalRevenue: number;
}

interface Press {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  plan: string;
  isActive: boolean;
  credits: number;
  trialEndsAt: string | null;
  createdAt: string;
  totalCardsPrinted: number;
  totalRevenue: number;
  clients: PressClient[];
  _count: {
    users: number;
    clients: number;
    orders: number;
    jobs: number;
  };
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [presses, setPresses] = useState<Press[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  
  // Tabs Navigation
  const [activeTab, setActiveTab] = useState<'presses' | 'analytics' | 'templates'>('presses');
  
  // Analytics State
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Starter Templates State
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  
  // Template Form Fields
  const [tmplName, setTmplName] = useState('');
  const [tmplWidth, setTmplWidth] = useState('673');
  const [tmplHeight, setTmplHeight] = useState('1039');
  const [tmplFrontImageUrl, setTmplFrontImageUrl] = useState('');
  const [tmplBackImageUrl, setTmplBackImageUrl] = useState('');
  const [tmplFrontOriginalUrl, setTmplFrontOriginalUrl] = useState('');
  const [tmplBackOriginalUrl, setTmplBackOriginalUrl] = useState('');
  const [tmplFrontFields, setTmplFrontFields] = useState('[]');
  const [tmplBackFields, setTmplBackFields] = useState('[]');
  
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [templateSubmitting, setTemplateSubmitting] = useState(false);

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
      
      // Update local state list
      setPresses(prev => [data.press, ...prev]);

      // Reset fields
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

  const fetchPresses = async () => {
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
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/analytics');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch analytics');
      setAnalytics(data.clientAnalytics || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchPresses();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'templates') {
      fetchGlobalTemplates();
    }
  }, [activeTab]);

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
      
      // Update local state
      setPresses(prev => prev.map(p => p.id === pressId ? { ...p, isActive: !currentStatus } : p));
    } catch (err: any) {
      setError(err.message || 'Failed to toggle status.');
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
      
      // Update local state
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
      
      // Update local state
      setPresses(prev => prev.map(p => p.id === selectedCreditsPress.id ? { ...p, credits: data.credits } : p));
      
      // Also update selected press local state for display
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

  const handleLogout = async () => {
    try {
      await fetch('/api/superadmin/logout', { method: 'POST' });
      router.push('/superadmin/login');
    } catch (err) {
      router.push('/superadmin/login');
    }
  };

  const fetchGlobalTemplates = async () => {
    setTemplatesLoading(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/templates');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch global templates');
      setGlobalTemplates(data.templates || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load global templates.');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleTemplateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (side === 'front') setUploadingFront(true);
    else setUploadingBack(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/superadmin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload file');

      if (side === 'front') {
        setTmplFrontImageUrl(data.url);
        setTmplFrontOriginalUrl(data.originalUrl || '');
      } else {
        setTmplBackImageUrl(data.url);
        setTmplBackOriginalUrl(data.originalUrl || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload template file.');
    } finally {
      if (side === 'front') setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTemplateSubmitting(true);

    try {
      // Validate JSON
      try {
        JSON.parse(tmplFrontFields);
      } catch {
        throw new Error('Front Fields is not a valid JSON array');
      }
      if (tmplBackFields.trim()) {
        try {
          JSON.parse(tmplBackFields);
        } catch {
          throw new Error('Back Fields is not a valid JSON array');
        }
      }

      const payload = {
        name: tmplName,
        cardWidth: Number(tmplWidth) || 673,
        cardHeight: Number(tmplHeight) || 1039,
        frontImageUrl: tmplFrontImageUrl,
        backImageUrl: tmplBackImageUrl || null,
        frontOriginalUrl: tmplFrontOriginalUrl || null,
        backOriginalUrl: tmplBackOriginalUrl || null,
        frontFields: tmplFrontFields,
        backFields: tmplBackFields || '[]',
      };

      const url = selectedTemplate 
        ? `/api/superadmin/templates/${selectedTemplate.id}`
        : '/api/superadmin/templates';
      
      const method = selectedTemplate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save template');

      // Reset & Refresh
      setTemplateModalOpen(false);
      setSelectedTemplate(null);
      setTmplName('');
      setTmplWidth('673');
      setTmplHeight('1039');
      setTmplFrontImageUrl('');
      setTmplBackImageUrl('');
      setTmplFrontOriginalUrl('');
      setTmplBackOriginalUrl('');
      setTmplFrontFields('[]');
      setTmplBackFields('[]');
      
      fetchGlobalTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to save template.');
    } finally {
      setTemplateSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this global template? This action cannot be undone.')) return;
    
    setError('');
    try {
      const res = await fetch(`/api/superadmin/templates/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete template');

      fetchGlobalTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete template.');
    }
  };

  const handleEditTemplateClick = (tmpl: any) => {
    setSelectedTemplate(tmpl);
    setTmplName(tmpl.name);
    setTmplWidth(String(tmpl.cardWidth));
    setTmplHeight(String(tmpl.cardHeight));
    setTmplFrontImageUrl(tmpl.frontImageUrl);
    setTmplBackImageUrl(tmpl.backImageUrl || '');
    setTmplFrontOriginalUrl(tmpl.frontOriginalUrl || '');
    setTmplBackOriginalUrl(tmpl.backOriginalUrl || '');
    setTmplFrontFields(tmpl.frontFields || '[]');
    setTmplBackFields(tmpl.backFields || '[]');
    setTemplateModalOpen(true);
  };

  // Presses Stats
  const totalPresses = presses.length;
  const activePresses = presses.filter(p => p.isActive).length;
  const suspendedPresses = totalPresses - activePresses;

  // Analytics Stats
  const totalClients = analytics.length;
  const totalCardsAcrossClients = analytics.reduce((acc, curr) => acc + curr.totalCards, 0);
  const totalRevenueAcrossClients = analytics.reduce((acc, curr) => acc + curr.totalRevenue, 0);

  // Filtered Analytics
  const filteredAnalytics = analytics.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.pressName.toLowerCase().includes(q) ||
      (item.contactName || '').toLowerCase().includes(q) ||
      (item.contactEmail || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '40px', minHeight: '100vh', background: 'var(--bg-gradient)', color: '#ffffff' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '32px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '2rem' }}>Super Admin Panel</h1>
            <span className="badge badge-danger">PLATFORM OWNER</span>
          </div>
          <p style={{ marginTop: '4px' }}>System monitoring, printing press tenant management, and client financial analytics</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'presses' && (
            <button 
              className="btn btn-primary" 
              onClick={() => setOnboardModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} />
              Onboard Press
            </button>
          )}
          {activeTab === 'templates' && (
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setSelectedTemplate(null);
                setTmplName('');
                setTmplWidth('673');
                setTmplHeight('1039');
                setTmplFrontImageUrl('');
                setTmplBackImageUrl('');
                setTmplFrontOriginalUrl('');
                setTmplBackOriginalUrl('');
                setTmplFrontFields('[]');
                setTmplBackFields('[]');
                setTemplateModalOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} />
              Add Starter Template
            </button>
          )}
          <button 
            className="btn btn-secondary" 
            onClick={activeTab === 'presses' ? fetchPresses : activeTab === 'analytics' ? fetchAnalytics : fetchGlobalTemplates}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button 
            className="btn btn-danger" 
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: '#f87171',
          marginBottom: '24px'
        }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
        <button 
          type="button" 
          onClick={() => setActiveTab('presses')}
          style={{
            padding: '10px 20px',
            fontWeight: '600',
            fontSize: '0.95rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'presses' ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
            color: activeTab === 'presses' ? 'var(--primary)' : 'var(--muted)',
            borderBottom: activeTab === 'presses' ? '2px solid var(--primary)' : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Building2 size={16} /> Printing Presses ({totalPresses})
        </button>
        <button 
          type="button" 
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '10px 20px',
            fontWeight: '600',
            fontSize: '0.95rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'analytics' ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
            color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--muted)',
            borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BarChart3 size={16} /> Client Financial & Print Analytics ({totalClients})
        </button>
        <button 
          type="button" 
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '10px 20px',
            fontWeight: '600',
            fontSize: '0.95rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'templates' ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
            color: activeTab === 'templates' ? 'var(--primary)' : 'var(--muted)',
            borderBottom: activeTab === 'templates' ? '2px solid var(--primary)' : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} /> Starter Templates ({globalTemplates.length})
        </button>
      </div>

      {activeTab === 'presses' ? (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                background: 'rgba(79, 70, 229, 0.15)',
                border: '1px solid rgba(79, 70, 229, 0.3)',
                borderRadius: '12px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Building2 size={24} />
              </div>
              <div>
                <h4 style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Presses</h4>
                <h2 style={{ fontSize: '1.8rem', marginTop: '4px' }}>{totalPresses}</h2>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)'
              }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Tenants</h4>
                <h2 style={{ fontSize: '1.8rem', marginTop: '4px', color: 'var(--success)' }}>{activePresses}</h2>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--danger)'
              }}>
                <Power size={24} />
              </div>
              <div>
                <h4 style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suspended</h4>
                <h2 style={{ fontSize: '1.8rem', marginTop: '4px', color: 'var(--danger)' }}>{suspendedPresses}</h2>
              </div>
            </div>
          </div>

          {/* Main Tenant Table */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--primary)" />
              All Printing Press Accounts
            </h3>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '12px' }}>
                <Loader2 size={36} className="spinner" />
                <p>Loading tenant databases...</p>
              </div>
            ) : presses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                No printing press tenants registered yet.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Press Details</th>
                      <th>Contact / City</th>
                      <th>Cards Printed</th>
                      <th>Revenue</th>
                      <th>Usage</th>
                      <th>Plan / Credits</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presses.map((press) => (
                      <tr key={press.id}>
                        <td>
                          <div style={{ fontWeight: '600', color: '#ffffff' }}>{press.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>{press.email}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Joined {new Date(press.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td>
                          <div>{press.city || '—'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>{press.phone || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>
                            {press.totalCardsPrinted ?? 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>cards total</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '700', fontSize: '1rem', color: '#10b981' }}>
                            Rs. {(press.totalRevenue ?? 0).toFixed(0)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>invoiced</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                            <div><Users size={11} style={{ display: 'inline', marginRight: '4px' }}/>Users: <strong>{press._count.users}</strong></div>
                            <div><Building2 size={11} style={{ display: 'inline', marginRight: '4px' }}/>Clients: <strong>{press._count.clients}</strong></div>
                            <div><FolderKanban size={11} style={{ display: 'inline', marginRight: '4px' }}/>Orders: <strong>{press._count.orders}</strong></div>
                            <div><ShieldCheck size={11} style={{ display: 'inline', marginRight: '4px' }}/>Jobs: <strong>{press._count.jobs}</strong></div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`badge ${
                                press.plan === 'ENTERPRISE' ? 'badge-primary' : 
                                press.plan === 'PRO' ? 'badge-success' : 'badge-warning'
                              }`}>
                                {press.plan}
                              </span>
                              <select 
                                className="form-select" 
                                style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto', background: '#1e293b' }}
                                value={press.plan}
                                disabled={actionLoading === press.id}
                                onChange={(e) => handleChangePlan(press.id, e.target.value)}
                              >
                                <option value="TRIAL">TRIAL</option>
                                <option value="BASIC">BASIC</option>
                                <option value="PRO">PRO</option>
                                <option value="ENTERPRISE">ENTERPRISE</option>
                              </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--warning)', fontWeight: '600' }}>
                              <DollarSign size={14} />
                              <span>{press.credits || 0} credits</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${press.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {press.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', borderColor: 'rgba(99,102,241,0.3)' }}
                              onClick={() => setDetailPress(press)}
                            >
                              <Eye size={12} style={{ marginRight: '4px' }} /> View Details
                            </button>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                className={`btn ${press.isActive ? 'btn-danger' : 'btn-primary'}`}
                                style={{ padding: '5px 10px', fontSize: '0.72rem', flex: 1 }}
                                disabled={actionLoading === press.id}
                                onClick={() => handleToggleStatus(press.id, press.isActive)}
                              >
                                <Power size={11} style={{ marginRight: '3px' }} />
                                {press.isActive ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', fontSize: '0.72rem', background: '#334155' }}
                                onClick={() => { setResetPress(press); setResetModalOpen(true); }}
                              >
                                <Key size={11} />
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', fontSize: '0.72rem', background: 'rgba(251,191,36,0.15)', color: 'var(--warning)', borderColor: 'rgba(251,191,36,0.3)' }}
                                onClick={() => { setSelectedCreditsPress(press); setCreditsModalOpen(true); setCreditsAmount(''); setCreditsSuccessMessage(''); }}
                              >
                                <CreditCard size={11} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'analytics' ? (
        <>
          {/* Client Analytics Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Users size={24} />
              </div>
              <div>
                <h4 style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Clients</h4>
                <h2 style={{ fontSize: '1.8rem', marginTop: '4px' }}>{totalClients}</h2>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)'
              }}>
                <FolderKanban size={24} />
              </div>
              <div>
                <h4 style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cards Ordered</h4>
                <h2 style={{ fontSize: '1.8rem', marginTop: '4px', color: 'var(--success)' }}>{totalCardsAcrossClients}</h2>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                background: 'rgba(251, 191, 36, 0.15)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '12px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--warning)'
              }}>
                <DollarSign size={24} />
              </div>
              <div>
                <h4 style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Revenue</h4>
                <h2 style={{ fontSize: '1.8rem', marginTop: '4px', color: 'var(--warning)' }}>Rs. {totalRevenueAcrossClients.toFixed(2)}</h2>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Search size={18} color="var(--muted)" />
            <input 
              type="text" 
              className="form-input" 
              style={{ background: 'transparent', border: 'none', padding: '4px', flex: 1 }}
              placeholder="Search by client name, printing press tenant, or contact email..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Client Analytics Table */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="var(--primary)" />
              Client Financial & Print Analytics Breakdown
            </h3>

            {analyticsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '12px' }}>
                <Loader2 size={36} className="spinner" />
                <p>Calculating financial details...</p>
              </div>
            ) : filteredAnalytics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                No client financial data matching filters.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Press Tenant</th>
                      <th>Contact Details</th>
                      <th>Total Cards Printed</th>
                      <th>Total Money Made (Revenue)</th>
                      <th>Revenue per Month Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnalytics.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: '600', color: '#ffffff' }}>{item.name}</td>
                        <td>
                          <span className="badge badge-primary">{item.pressName}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>{item.contactName || '—'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{item.contactEmail || '—'}</div>
                        </td>
                        <td style={{ fontWeight: '500' }}>{item.totalCards} cards</td>
                        <td style={{ fontWeight: '600', color: 'var(--info)' }}>
                          Rs. {Number(item.totalRevenue).toFixed(2)}
                        </td>
                        <td>
                          {Object.keys(item.revenueByMonth).length === 0 ? (
                            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>No invoice data</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {Object.entries(item.revenueByMonth).map(([month, rev]) => {
                                const [year, m] = month.split('-');
                                const date = new Date(Number(year), Number(m) - 1);
                                const monthName = date.toLocaleString('default', { month: 'short' });
                                return (
                                  <span 
                                    key={month} 
                                    className="badge badge-success"
                                    style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.1)' }}
                                  >
                                    {monthName} {year}: Rs. {Number(rev).toFixed(0)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Starter Templates Grid */}
          {templatesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '12px' }}>
              <Loader2 size={36} className="spinner" />
              <p>Loading starter templates...</p>
            </div>
          ) : globalTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
              No starter templates uploaded yet. Click "Add Starter Template" to create one.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {globalTemplates.map((tmpl) => (
                <div key={tmpl.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', border: '1px solid var(--glass-border)' }}>
                  {/* Preview Image */}
                  <div style={{
                    width: '100%',
                    paddingTop: '63%',
                    backgroundImage: `url(${tmpl.frontImageUrl})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    position: 'relative'
                  }}>
                    {tmpl.backImageUrl && (
                      <span className="badge badge-primary" style={{ position: 'absolute', bottom: '8px', right: '8px', fontSize: '0.75rem' }}>
                        Dual-Sided
                      </span>
                    )}
                    <span className="badge badge-secondary" style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '0.75rem' }}>
                      v{tmpl.version}
                    </span>
                  </div>

                  <h4 style={{ fontWeight: '600', fontSize: '1rem', color: '#ffffff', marginBottom: '4px' }}>{tmpl.name}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '12px' }}>
                    Size: {tmpl.cardWidth}x{tmpl.cardHeight}px ({Math.round(tmpl.cardWidth * 0.264583)}x{Math.round(tmpl.cardHeight * 0.264583)}mm)
                  </p>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', borderColor: 'rgba(99,102,241,0.3)' }}
                      onClick={() => handleEditTemplateClick(tmpl)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Press Detail Modal ─────────────────────────────────────── */}
      {detailPress && (
        <div
          onClick={() => setDetailPress(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(3,4,7,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '3px solid var(--primary)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <Building2 size={22} color="var(--primary)" />
                  <h2 style={{ fontSize: '1.4rem' }}>{detailPress.name}</h2>
                  <span className={`badge ${detailPress.isActive ? 'badge-success' : 'badge-danger'}`}>{detailPress.isActive ? 'Active' : 'Suspended'}</span>
                  <span className="badge badge-primary">{detailPress.plan}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{detailPress.email} · {detailPress.city} · {detailPress.phone}</div>
              </div>
              <button onClick={() => setDetailPress(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
              {[
                { label: 'Total Cards Printed', value: detailPress.totalCardsPrinted ?? 0, color: 'var(--primary)', icon: <FileText size={18} /> },
                { label: 'Total Revenue', value: `Rs. ${(detailPress.totalRevenue ?? 0).toFixed(0)}`, color: '#10b981', icon: <TrendingUp size={18} /> },
                { label: 'Total Clients', value: detailPress._count.clients, color: '#f59e0b', icon: <Users size={18} /> },
                { label: 'Remaining Credits', value: detailPress.credits, color: '#f59e0b', icon: <DollarSign size={18} /> },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: stat.color }}>{stat.icon}</span> {stat.label}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Clients Table */}
            <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} color="var(--primary)" /> Clients & Their Orders
            </h3>
            {detailPress.clients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>No clients yet for this press.</div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Type</th>
                      <th>Contact</th>
                      <th>Orders</th>
                      <th>Cards Printed</th>
                      <th>Revenue Charged</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPress.clients.map(client => (
                      <tr key={client.id}>
                        <td style={{ fontWeight: '600' }}>{client.name}</td>
                        <td><span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{client.type}</span></td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>{client.contactName || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{client.contactEmail || ''}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{client.contactPhone || ''}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}><strong>{client.totalOrders}</strong></td>
                        <td>
                          <strong style={{ color: 'var(--primary)' }}>{client.totalCards}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>cards</div>
                        </td>
                        <td>
                          <strong style={{ color: '#10b981' }}>Rs. {client.totalRevenue.toFixed(0)}</strong>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(client.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetModalOpen && resetPress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>
            <h3 style={{ marginBottom: '16px' }}>Reset Owner Password</h3>
            <p style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
              Resetting password for the primary owner of <strong>{resetPress.name}</strong> ({resetPress.email}).
            </p>

            {resetSuccessMessage && (
              <div style={{
                padding: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--success)',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                {resetSuccessMessage}
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label" htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="text"
                  required
                  placeholder="Enter secure new password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setResetModalOpen(false);
                    setResetPress(null);
                    setNewPassword('');
                  }}
                  disabled={actionLoading === resetPress.id}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={actionLoading === resetPress.id}
                >
                  {actionLoading === resetPress.id ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Credits Modal */}
      {creditsModalOpen && selectedCreditsPress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={20} color="var(--warning)" />
              Manage Print Credits
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '0.9rem' }}>
              Managing print credits for <strong>{selectedCreditsPress.name}</strong> ({selectedCreditsPress.email}).
            </p>

            <div style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '0.9rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: 'var(--muted)' }}>Current Balance:</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--warning)' }}>{selectedCreditsPress.credits || 0} Credits</strong>
            </div>

            {creditsSuccessMessage && (
              <div style={{
                padding: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--success)',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                {creditsSuccessMessage}
              </div>
            )}

            <form onSubmit={handleUpdateCredits}>
              <div className="form-group">
                <label className="form-label" htmlFor="creditsAmount">Add or Deduct Credits</label>
                <input
                  id="creditsAmount"
                  type="number"
                  required
                  placeholder="e.g. 500 to add, or -100 to subtract"
                  className="form-input"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                  Use positive numbers to add credits, negative numbers to subtract.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setCreditsModalOpen(false);
                    setSelectedCreditsPress(null);
                    setCreditsAmount('');
                    setCreditsSuccessMessage('');
                  }}
                  disabled={creditsSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'var(--warning)', borderColor: 'var(--warning)', color: '#0f172a' }}
                  disabled={creditsSubmitting}
                >
                  {creditsSubmitting ? 'Updating...' : 'Save Credits'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboard Press Modal */}
      {onboardModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} color="var(--primary)" />
              Onboard New Printing Press
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--muted)' }}>
              Create a new tenant account and owner account for a Printing Press partner.
            </p>

            {onboardSuccessMessage && (
              <div style={{
                padding: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--success)',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                {onboardSuccessMessage}
              </div>
            )}

            <form onSubmit={handleOnboardPress} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="onboardPressName">Press / Business Name</label>
                  <input
                    id="onboardPressName"
                    type="text"
                    required
                    placeholder="Sri Lakshmi Printers"
                    className="form-input"
                    value={onboardPressName}
                    onChange={(e) => setOnboardPressName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="onboardOwnerName">Owner Full Name</label>
                  <input
                    id="onboardOwnerName"
                    type="text"
                    required
                    placeholder="Ravi Kumar"
                    className="form-input"
                    value={onboardOwnerName}
                    onChange={(e) => setOnboardOwnerName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="onboardEmail">Work Email Address</label>
                  <input
                    id="onboardEmail"
                    type="email"
                    required
                    placeholder="ravi@lakshmiprinters.com"
                    className="form-input"
                    value={onboardEmail}
                    onChange={(e) => setOnboardEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="onboardPassword">Access Password</label>
                  <input
                    id="onboardPassword"
                    type="password"
                    required
                    placeholder="Create password"
                    className="form-input"
                    value={onboardPassword}
                    onChange={(e) => setOnboardPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="onboardPhone">Phone Number</label>
                  <input
                    id="onboardPhone"
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    className="form-input"
                    value={onboardPhone}
                    onChange={(e) => setOnboardPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="onboardCity">City / Location</label>
                  <input
                    id="onboardCity"
                    type="text"
                    placeholder="e.g. Bangalore"
                    className="form-input"
                    value={onboardCity}
                    onChange={(e) => setOnboardCity(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="onboardPlan">Subscription Plan</label>
                  <select
                    id="onboardPlan"
                    className="form-select"
                    value={onboardPlan}
                    onChange={(e) => setOnboardPlan(e.target.value)}
                  >
                    <option value="TRIAL">TRIAL</option>
                    <option value="BASIC">BASIC</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="onboardCredits">Initial Print Credits</label>
                  <input
                    id="onboardCredits"
                    type="number"
                    required
                    placeholder="100"
                    className="form-input"
                    value={onboardCredits}
                    onChange={(e) => setOnboardCredits(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setOnboardModalOpen(false);
                    setOnboardPressName('');
                    setOnboardOwnerName('');
                    setOnboardEmail('');
                    setOnboardPassword('');
                    setOnboardPhone('');
                    setOnboardCity('');
                    setOnboardPlan('BASIC');
                    setOnboardCredits('100');
                    setOnboardSuccessMessage('');
                  }}
                  disabled={onboardSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={onboardSubmitting}
                >
                  {onboardSubmitting ? 'Onboarding...' : 'Onboard Press'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Starter Template Create/Edit Modal */}
      {templateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="var(--primary)" />
              {selectedTemplate ? 'Edit Starter Template' : 'Add New Starter Template'}
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--muted)' }}>
              Configure a global master template available for all presses to clone and use.
            </p>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="tmplName">Template Name</label>
                <input
                  id="tmplName"
                  type="text"
                  required
                  placeholder="e.g. Classic School ID Horizontal"
                  className="form-input"
                  value={tmplName}
                  onChange={(e) => setTmplName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="tmplWidth">Card Width (pixels)</label>
                  <input
                    id="tmplWidth"
                    type="number"
                    required
                    placeholder="673"
                    className="form-input"
                    value={tmplWidth}
                    onChange={(e) => setTmplWidth(e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
                    Standard CR80 (57mm) at 300 DPI = 673px
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tmplHeight">Card Height (pixels)</label>
                  <input
                    id="tmplHeight"
                    type="number"
                    required
                    placeholder="1039"
                    className="form-input"
                    value={tmplHeight}
                    onChange={(e) => setTmplHeight(e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
                    Standard CR80 (88mm) at 300 DPI = 1039px
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', marginTop: '-8px', marginBottom: '8px' }}
                onClick={() => {
                  const w = tmplWidth;
                  const h = tmplHeight;
                  setTmplWidth(h);
                  setTmplHeight(w);
                }}
              >
                <RefreshCw size={14} /> Make {Number(tmplWidth) > Number(tmplHeight) ? 'Portrait' : 'Landscape'}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Front Upload */}
                <div style={{ border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px' }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>Front Background (PDF/SVG/PNG)</label>
                  <input
                    type="file"
                    accept=".pdf,.svg,.png,.jpg,.jpeg"
                    className="form-input"
                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                    onChange={(e) => handleTemplateFileUpload(e, 'front')}
                    required={!tmplFrontImageUrl}
                  />
                  {uploadingFront && <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px' }}>Uploading & converting front...</p>}
                  {tmplFrontImageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Uploaded!</span>
                      <div style={{
                        width: '100%',
                        height: '100px',
                        backgroundImage: `url(${tmplFrontImageUrl})`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderRadius: '4px',
                        marginTop: '4px'
                      }} />
                    </div>
                  )}
                </div>

                {/* Back Upload */}
                <div style={{ border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px' }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>Back Background (Optional)</label>
                  <input
                    type="file"
                    accept=".pdf,.svg,.png,.jpg,.jpeg"
                    className="form-input"
                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                    onChange={(e) => handleTemplateFileUpload(e, 'back')}
                  />
                  {uploadingBack && <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px' }}>Uploading & converting back...</p>}
                  {tmplBackImageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Uploaded!</span>
                      <div style={{
                        width: '100%',
                        height: '100px',
                        backgroundImage: `url(${tmplBackImageUrl})`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderRadius: '4px',
                        marginTop: '4px'
                      }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Coordinates JSON */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" htmlFor="tmplFrontFields" style={{ margin: 0 }}>Front Coordinate Mapping (JSON Array)</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Tip: copy from a press template</span>
                </div>
                <textarea
                  id="tmplFrontFields"
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', minHeight: '120px', background: '#0f172a', borderColor: '#334155' }}
                  value={tmplFrontFields}
                  onChange={(e) => setTmplFrontFields(e.target.value)}
                  placeholder="[{ 'name': 'studentName', 'type': 'text', 'x': 50, ... }]"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tmplBackFields">Back Coordinate Mapping (JSON Array)</label>
                <textarea
                  id="tmplBackFields"
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', minHeight: '100px', background: '#0f172a', borderColor: '#334155' }}
                  value={tmplBackFields}
                  onChange={(e) => setTmplBackFields(e.target.value)}
                  placeholder="[]"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setTemplateModalOpen(false);
                    setSelectedTemplate(null);
                    setTmplName('');
                    setTmplWidth('673');
                    setTmplHeight('1039');
                    setTmplFrontImageUrl('');
                    setTmplBackImageUrl('');
                    setTmplFrontOriginalUrl('');
                    setTmplBackOriginalUrl('');
                    setTmplFrontFields('[]');
                    setTmplBackFields('[]');
                  }}
                  disabled={templateSubmitting || uploadingFront || uploadingBack}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={templateSubmitting || uploadingFront || uploadingBack}
                >
                  {templateSubmitting ? 'Saving...' : selectedTemplate ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
