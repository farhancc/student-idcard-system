'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Mail, Lock, User, Briefcase, CheckCircle2, Phone } from 'lucide-react';
import { LegalConsent, LegalLink } from '@/app/components/LegalConsent';

export default function SignupPage() {
  const router = useRouter();
  const [pressName, setPressName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Checked here for a usable error, and again on the server, which is what
    // actually decides whether the account is created.
    if (!acceptedLegal) {
      setConsentError('Please accept the terms to continue.');
      return;
    }
    setConsentError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/press/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pressName, ownerName, email, phone, password, acceptedLegal }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login?registered=true');
      }, 2000);
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
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--success)',
              marginBottom: '20px'
            }}>
              <CheckCircle2 size={40} />
            </div>
            <h3>Press Registered Successfully!</h3>
            <p style={{ marginTop: '12px' }}>Your Printing Press account has been registered successfully. Redirecting you to login...</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2>Register Your Press</h2>
              <p style={{ marginTop: '8px' }}>Create your Printing Press tenant account for free</p>
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
                <ShieldAlert size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pressName">Organisation Name</label>
                <div style={{ position: 'relative' }}>
                  <Briefcase style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)'
                  }} size={18} />
                  <input
                    id="pressName"
                    type="text"
                    required
                    className="form-input"
                    style={{ paddingLeft: '48px' }}
                    placeholder="Sri Lakshmi Printers"
                    value={pressName}
                    onChange={(e) => setPressName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ownerName">Owner Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)'
                  }} size={18} />
                  <input
                    id="ownerName"
                    type="text"
                    required
                    className="form-input"
                    style={{ paddingLeft: '48px' }}
                    placeholder="Ravi Kumar"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">Work Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%',
                    color: 'var(--muted)'
                  }} size={18} />
                  <input
                    id="email"
                    type="email"
                    required
                    className="form-input"
                    style={{ paddingLeft: '48px' }}
                    placeholder="ravi@lakshmiprinters.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone">Mobile Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)'
                  }} size={18} />
                  <input
                    id="phone"
                    type="tel"
                    required
                    className="form-input"
                    style={{ paddingLeft: '48px' }}
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Create Password</label>
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
                    type="password"
                    required
                    className="form-input"
                    style={{ paddingLeft: '48px' }}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <LegalConsent
                id="accept-legal"
                checked={acceptedLegal}
                onChange={next => {
                  setAcceptedLegal(next);
                  if (next) setConsentError(null);
                }}
                error={consentError}
                disabled={loading}
              >
                I am authorised to register this press, and I accept the{' '}
                <LegalLink slug="terms">Terms of Service</LegalLink>,{' '}
                <LegalLink slug="privacy">Privacy Policy</LegalLink>,{' '}
                <LegalLink slug="acceptable-use">Acceptable Use Policy</LegalLink>,{' '}
                <LegalLink slug="billing">Billing &amp; Refunds Policy</LegalLink> and the{' '}
                <LegalLink slug="data-processing-addendum">Data Processing Addendum</LegalLink>. I confirm we
                will only upload roster data we have a lawful basis to process, including parental consent
                where a cardholder is under 18.
              </LegalConsent>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '0.9375rem', marginTop: '10px' }}
                disabled={loading}
              >
                {loading ? <div className="spinner" style={{ width: '20px', height: '20px' }}></div> : 'Register Press Account'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <p style={{ fontSize: '0.875rem' }}>
                Already registered?{' '}
                <a href="/login" style={{ color: 'var(--primary)', fontWeight: '500' }}>
                  Log In
                </a>
              </p>
              <p style={{ fontSize: '0.75rem', marginTop: '12px', color: 'var(--muted)' }}>
                <Link href="/legal" style={{ color: 'var(--muted)', textDecoration: 'underline' }}>
                  All legal documents
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
