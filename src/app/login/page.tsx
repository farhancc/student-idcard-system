'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, AlertTriangle, Eye, EyeOff, Key } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [rememberMe, setRememberMe] = useState(true);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  const runAutoBackupFlow = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    const today = new Date();
    if (today.getDate() !== 15) return;

    let targetMonth = today.getMonth() - 2;
    let targetYear = today.getFullYear();
    if (targetMonth < 0) {
      targetMonth += 12;
      targetYear -= 1;
    }
    const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    const monthName = new Date(targetYear, targetMonth).toLocaleString('default', { month: 'long', year: 'numeric' }).replace(/\s+/g, '_');

    if (localStorage.getItem(`backup_completed_${monthStr}`) === 'true') {
      return;
    }

    try {
      console.log('Running auto-backup for second last month:', monthStr);
      const res = await fetch(`/api/backup/prepare?year=${targetYear}&month=${targetMonth + 1}`);
      if (!res.ok) {
        console.warn('Auto-backup preparation request returned an error. Might be unauthenticated.');
        return;
      }

      const data = await res.json();
      if (!data.success || !data.clients || data.clients.length === 0) {
        console.log('No data to backup for target month:', monthStr);
        localStorage.setItem(`backup_completed_${monthStr}`, 'true');
        return;
      }

      console.log(`Found data to backup for ${data.clients.length} clients.`);
      const savedClientIds = [];

      for (const client of data.clients) {
        const saveRes = await electronAPI.saveBackupLocally(client.name, monthName, client.zipBase64);
        if (saveRes && saveRes.success) {
          console.log(`Successfully stored backup zip locally for client ${client.name}`);
          savedClientIds.push(client.id);
        } else {
          console.error(`Failed to store backup zip locally for client ${client.name}:`, saveRes?.error);
        }
      }

      if (savedClientIds.length > 0) {
        console.log('Triggering server purge for successfully backed up client IDs:', savedClientIds);
        const purgeRes = await fetch('/api/backup/purge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: targetYear,
            month: targetMonth + 1,
            clientIds: savedClientIds,
          }),
        });

        if (purgeRes.ok) {
          const purgeData = await purgeRes.json();
          console.log('Purge completed successfully:', purgeData);
          localStorage.setItem(`backup_completed_${monthStr}`, 'true');
        } else {
          console.error('Failed to trigger purge on server');
        }
      }
    } catch (err) {
      console.error('Error during auto-backup process:', err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setIsElectron(true);
      (window as any).electronAPI.loadCredentials().then((creds: any) => {
        if (creds && creds.email && creds.password) {
          setHasSavedCredentials(true);
        }
      }).catch(() => {});

      // On mount: if today is the 15th, check if we have a valid session and trigger backup
      const today = new Date();
      if (today.getDate() === 15) {
        runAutoBackupFlow();
      }
    }
  }, []);

  const handleAutofill = async () => {
    setError('');
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const creds = await (window as any).electronAPI.loadCredentials();
        if (creds && creds.email && creds.password) {
          setEmail(creds.email);
          setPassword(creds.password);
        } else {
          setError('No saved credentials found. Please log in with "Remember Credentials" checked to save them.');
        }
      } catch (err) {
        console.error('Failed to load credentials for autofill:', err);
        setError('Failed to load credentials.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/press/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // If running inside Electron, handle credentials saving/clearing
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        if (rememberMe) {
          await (window as any).electronAPI.saveCredentials(email, password);
        } else {
          await (window as any).electronAPI.clearCredentials();
        }

        // Successful login: trigger backup check immediately
        const today = new Date();
        if (today.getDate() === 15) {
          await runAutoBackupFlow();
        }
      }

      // Successful login -> Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'var(--bg-gradient)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/logo.png"
            alt="IDexo Logo"
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'contain',
              marginBottom: '16px'
            }}
          />
          <h2>IDexo</h2>
          <p style={{ marginTop: '8px' }}>Log in to your Printing Press tenant portal</p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '0.875rem',
            marginBottom: '24px'
          }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)'
              }} size={18} />
              <input
                id="email"
                type="email"
                required
                className="form-input"
                style={{ paddingLeft: '48px' }}
                placeholder="name@press.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)'
              }} size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                className="form-input"
                style={{ paddingLeft: '48px', paddingRight: '48px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isElectron && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '-8px',
              marginBottom: '4px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--muted)',
                userSelect: 'none'
              }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    accentColor: 'var(--primary)',
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer'
                  }}
                />
                Remember Credentials
              </label>

              <button
                type="button"
                onClick={handleAutofill}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  opacity: hasSavedCredentials ? 1 : 0.6,
                  transition: 'all 0.2s',
                }}
              >
                <Key size={14} />
                Autofill Saved
              </button>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '0.9375rem' }}
            disabled={loading}
          >
            {loading ? <div className="spinner" style={{ width: '20px', height: '20px' }}></div> : 'Access Portal'}
          </button>
        </form>

        <div style={{ 
          textAlign: 'center', 
          marginTop: '24px', 
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '20px'
        }}>
          <p style={{ fontSize: '0.875rem' }}>
            New Printing Press?{' '}
            <a href="/signup" style={{ color: 'var(--primary)', fontWeight: '500' }}>
              Sign Up for Free
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
