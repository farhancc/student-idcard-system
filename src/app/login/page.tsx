'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Mail, AlertTriangle, Eye, EyeOff, Key, RotateCcw } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [rememberMe, setRememberMe] = useState(true);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [savedEmailHint, setSavedEmailHint] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    const checkSaved = async () => {
      let foundCreds: { email?: string; password?: string } | null = null;

      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('last_successful_login');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (parsed && parsed.email && parsed.password) {
              foundCreds = parsed;
            }
          } catch (e) {}
        }

        if (!foundCreds && (window as any).electronAPI) {
          try {
            const creds = await (window as any).electronAPI.loadCredentials();
            if (creds && creds.email && creds.password) {
              foundCreds = creds;
            }
          } catch (e) {}
        }
      }

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        setIsElectron(true);
      }

      if (foundCreds) {
        setHasSavedCredentials(true);
        if (foundCreds.email) {
          setSavedEmailHint(foundCreds.email);
        }
      }
    };

    checkSaved();
  }, []);

  const handleAutoRefill = async () => {
    setError('');
    let credsToFill: { email?: string; password?: string } | null = null;

    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('last_successful_login');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed && parsed.email && parsed.password) {
            credsToFill = parsed;
          }
        } catch (e) {}
      }

      if (!credsToFill && (window as any).electronAPI) {
        try {
          const creds = await (window as any).electronAPI.loadCredentials();
          if (creds && creds.email && creds.password) {
            credsToFill = creds;
          }
        } catch (e) {}
      }
    }

    if (credsToFill && credsToFill.email && credsToFill.password) {
      setEmail(credsToFill.email);
      setPassword(credsToFill.password);
    } else {
      setError('No previously saved login credentials found. Please log in once to save credentials.');
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

      // Store credentials locally on successful login for Auto Refill
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'last_successful_login',
          JSON.stringify({ email, password, savedAt: new Date().toISOString() })
        );

        if ((window as any).electronAPI) {
          if (rememberMe) {
            await (window as any).electronAPI.saveCredentials(email, password);
          } else {
            await (window as any).electronAPI.clearCredentials();
          }
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
          <Image
            src="/logo.png"
            alt="IDexo Logo"
            width={64}
            height={64}
            style={{
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPassword((prev) => !prev);
                }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: showPassword ? '#ffffff' : 'var(--muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '6px',
                  zIndex: 10,
                  transition: 'color 0.2s ease, background 0.2s ease',
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

        {/* Dedicated Auto Refill Button below the login form */}
        <div style={{
          marginTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={handleAutoRefill}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--text-main, #ffffff)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            <Key size={16} style={{ color: 'var(--primary, #3b82f6)' }} />
            <span>Auto Refill Last Credentials</span>
          </button>
        </div>

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

