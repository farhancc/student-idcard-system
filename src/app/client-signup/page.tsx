'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, User, Phone, MapPin, CheckCircle2, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ClientSignupPage() {
  const router = useRouter();
  const [presses, setPresses] = useState<any[]>([]);
  const [loadingPresses, setLoadingPresses] = useState(true);
  
  // Form Fields
  const [selectedPressId, setSelectedPressId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('SCHOOL');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');

  // Status State
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchPresses() {
      try {
        const res = await fetch('/api/public/client-signup');
        const data = await res.json();
        if (res.ok && data.success) {
          setPresses(data.presses || []);
          if (data.presses && data.presses.length > 0) {
            setSelectedPressId(String(data.presses[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load printing presses:', err);
      } finally {
        setLoadingPresses(false);
      }
    }
    fetchPresses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/public/client-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pressId: Number(selectedPressId),
          name: orgName,
          type: orgType,
          contactName,
          contactPhone,
          contactEmail,
          address,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(true);
      setPortalUrl(`/portal/org/${data.orgToken}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 20px',
      background: 'var(--bg-gradient)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '600px' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--success)',
              marginBottom: '24px'
            }}>
              <CheckCircle2 size={44} />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Organization Registered!</h2>
            <p style={{ marginTop: '12px', color: 'var(--muted)', fontSize: '1rem', lineHeight: '1.6' }}>
              Your self-onboarding is complete. Your direct Client Portal has been generated and is ready for use.
            </p>
            
            <div style={{ marginTop: '32px' }}>
              <button
                onClick={() => router.push(portalUrl)}
                className="btn btn-primary"
                style={{
                  padding: '14px 28px',
                  fontSize: '1rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
                }}
              >
                Go to Client Portal <ChevronRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'var(--primary-gradient)',
                marginBottom: '16px'
              }}>
                <ShieldCheck size={28} color="#fff" />
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '700' }}>Client Onboarding</h2>
              <p style={{ marginTop: '6px', color: 'var(--muted)' }}>Register your organization to start importing cardholders instantly</p>
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
                <label className="form-label" htmlFor="pressSelect">Select Printing Partner (Press)</label>
                {loadingPresses ? (
                  <div style={{ color: 'var(--muted)', fontSize: '0.9rem', padding: '10px 0' }}>Loading printing partners...</div>
                ) : presses.length === 0 ? (
                  <div style={{ color: '#f87171', fontSize: '0.9rem', padding: '10px 0' }}>No active printing presses found on the platform. Please contact support.</div>
                ) : (
                  <select
                    id="pressSelect"
                    required
                    className="form-select"
                    value={selectedPressId}
                    onChange={(e) => setSelectedPressId(e.target.value)}
                  >
                    {presses.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.city || 'Active Partner'})</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="orgName">Organization / School Name</label>
                  <div style={{ position: 'relative' }}>
                    <Building2 style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)'
                    }} size={18} />
                    <input
                      id="orgName"
                      type="text"
                      required
                      className="form-input"
                      style={{ paddingLeft: '48px' }}
                      placeholder="e.g. Oxford Public School"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="orgType">Organization Type</label>
                  <select
                    id="orgType"
                    required
                    className="form-select"
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                  >
                    <option value="SCHOOL">School / Education</option>
                    <option value="COMPANY">Company / Corporate</option>
                    <option value="NGO">NGO / Volunteer Group</option>
                    <option value="GOVERNMENT">Government Branch</option>
                    <option value="OTHER">Other / Social Group</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="contactName">Contact Representative</label>
                  <div style={{ position: 'relative' }}>
                    <User style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)'
                    }} size={18} />
                    <input
                      id="contactName"
                      type="text"
                      required
                      className="form-input"
                      style={{ paddingLeft: '48px' }}
                      placeholder="e.g. John Doe"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="contactEmail">Work Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)'
                    }} size={18} />
                    <input
                      id="contactEmail"
                      type="email"
                      required
                      className="form-input"
                      style={{ paddingLeft: '48px' }}
                      placeholder="e.g. admin@school.edu"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="contactPhone">Phone / Mobile Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)'
                    }} size={18} />
                    <input
                      id="contactPhone"
                      type="text"
                      required
                      className="form-input"
                      style={{ paddingLeft: '48px' }}
                      placeholder="e.g. +91 98765 43210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" htmlFor="address">Physical Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin style={{
                      position: 'absolute',
                      left: '16px',
                      top: '24px',
                      color: 'var(--muted)'
                    }} size={18} />
                    <textarea
                      id="address"
                      required
                      className="form-textarea"
                      rows={3}
                      style={{ paddingLeft: '48px' }}
                      placeholder="e.g. 123 Main St, Tech Park"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', marginTop: '10px' }}
                disabled={submitting || loadingPresses || presses.length === 0}
              >
                {submitting ? <div className="spinner" style={{ width: '22px', height: '22px' }}></div> : 'Complete Registration'}
              </button>
            </form>

            <div style={{ 
              textAlign: 'center', 
              marginTop: '28px', 
              borderTop: '1px solid rgba(255,255,255,0.06)', 
              paddingTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <p style={{ fontSize: '0.875rem' }}>
                Are you a Printing Press owner?{' '}
                <a href="/signup" style={{ color: 'var(--primary)', fontWeight: '500', textDecoration: 'underline' }}>
                  Register Press & Start Trial
                </a>
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                Already have an account?{' '}
                <a href="/login" style={{ color: 'var(--primary)', fontWeight: '500' }}>
                  Log In
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
