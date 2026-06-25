'use client';

import React, { useEffect, useState } from 'react';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { 
  Key, 
  Printer, 
  Trash2, 
  Plus, 
  ShieldCheck, 
  Database, 
  AlertTriangle, 
  Copy, 
  CheckCircle,
  Clock,
  User,
  Mail,
  MapPin,
  Phone,
  Save
} from 'lucide-react';

export default function SettingsPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newGeneratedKey, setNewGeneratedKey] = useState('');
  const [keyLoading, setKeyLoading] = useState(false);

  // Press Profile State
  const [pressName, setPressName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pressPhone, setPressPhone] = useState('');
  const [pressCity, setPressCity] = useState('');
  const [pressEmail, setPressEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // Print Vendors State
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorCity, setVendorCity] = useState('');
  const [vendorNotes, setVendorNotes] = useState('');
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);

  // Cleanup State
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  } | null>(null);
  const showConfirm = (cfg: typeof confirmConfig) => { setConfirmConfig(cfg); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmConfig(null); };

  const fetchData = async () => {
    try {
      // Fetch API Keys
      const keysRes = await fetch('/api/settings/api-keys');
      if (keysRes.ok) {
        const json = await keysRes.json();
        setKeys(json.keys || []);
      }

      // Fetch Print Vendors
      const vendorsRes = await fetch('/api/print-vendors');
      if (vendorsRes.ok) {
        const json = await vendorsRes.json();
        setVendors(json.vendors || []);
      }

      // Fetch Press Profile
      const profileRes = await fetch('/api/press/profile');
      if (profileRes.ok) {
        const json = await profileRes.json();
        if (json.press) {
          setPressName(json.press.name || '');
          setPressPhone(json.press.phone || '');
          setPressCity(json.press.city || '');
          setPressEmail(json.press.email || '');
        }
        if (json.user) {
          setOwnerName(json.user.name || '');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pressName.trim() || !ownerName.trim()) return;
    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');

    try {
      const res = await fetch('/api/press/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pressName,
          ownerName: ownerName,
          phone: pressPhone,
          city: pressCity
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMessage('Profile details updated successfully.');
        window.dispatchEvent(new Event('refresh-profile'));
      } else {
        setProfileError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      setProfileError('An unexpected error occurred.');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // API Key creation
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    setKeyLoading(true);
    setNewGeneratedKey('');

    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKeyLabel }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewGeneratedKey(data.apiKey);
        setNewKeyLabel('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setKeyLoading(false);
    }
  };

  // Add print vendor
  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;
    setVendorLoading(true);

    try {
      const res = await fetch('/api/print-vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vendorName,
          phone: vendorPhone,
          email: vendorEmail,
          city: vendorCity,
          notes: vendorNotes,
        }),
      });
      if (res.ok) {
        setVendorName('');
        setVendorPhone('');
        setVendorEmail('');
        setVendorCity('');
        setVendorNotes('');
        setShowVendorForm(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVendorLoading(false);
    }
  };

  // Delete vendor
  const handleDeleteVendor = (id: number) => {
    showConfirm({
      title: 'Remove Print Vendor',
      message: 'Are you sure you want to remove this print vendor from your directory?',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/print-vendors/${id}`, { method: 'DELETE' });
          if (res.ok) fetchData();
        } catch (err) { console.error(err); }
      },
    });
  };

  // Hard cleanup trigger
  const handleTriggerCleanup = () => {
    showConfirm({
      title: 'Purge Expired Files',
      message: 'This will permanently delete all expired PDF files from storage and prune database logs older than 7 days. This cannot be undone.',
      confirmLabel: 'Purge Now',
      variant: 'warning',
      onConfirm: async () => {
        closeConfirm();
        setCleanupLoading(true);
        setCleanupResult(null);
        try {
          const res = await fetch('/api/jobs/cleanup', { method: 'POST' });
          if (res.ok) { const json = await res.json(); setCleanupResult(json); }
        } catch (err) { console.error(err); }
        finally { setCleanupLoading(false); }
      },
    });
  };

  return (
    <>
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1>Tenant Settings</h1>
        <p style={{ marginTop: '4px' }}>Manage API integrations, print vendors, and storage retentions.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Left Column: API keys & Cleanup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Press Profile settings */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={18} color="var(--primary)" /> Press Profile Settings
            </h3>
            <p style={{ fontSize: '0.8rem', marginBottom: '20px' }}>
              Manage your printing press name, owner profile, phone number, and city location.
            </p>

            {profileMessage && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                {profileMessage}
              </div>
            )}

            {profileError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Printing Press Name</label>
                <input 
                  type="text" 
                  required 
                  className="form-input" 
                  value={pressName} 
                  onChange={e => setPressName(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Owner Full Name</label>
                <input 
                  type="text" 
                  required 
                  className="form-input" 
                  value={ownerName} 
                  onChange={e => setOwnerName(e.target.value)} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Phone / Mobile</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={pressPhone} 
                    onChange={e => setPressPhone(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={pressCity} 
                    onChange={e => setPressCity(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Work Email (Read-Only)</label>
                <input 
                  type="email" 
                  disabled 
                  className="form-input" 
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  value={pressEmail} 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '6px', gap: '8px', justifyContent: 'center' }} disabled={profileSaving}>
                <Save size={16} /> {profileSaving ? 'Saving Changes...' : 'Save Profile Details'}
              </button>
            </form>
          </div>

          {/* API Key management */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} color="var(--primary)" /> REST API credentials
            </h3>
            <p style={{ fontSize: '0.8rem', marginBottom: '20px' }}>
              Issue API keys to integrate third-party platforms (school CMS, student portals) to dynamically register cardholder rows.
            </p>

            {newGeneratedKey && (
              <div className="glass-panel" style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid var(--primary)', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', marginBottom: '8px' }}>
                  <ShieldCheck size={18} />
                  <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Save raw credentials safely:</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input readOnly type="text" className="form-input" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} value={newGeneratedKey} />
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      navigator.clipboard.writeText(newGeneratedKey);
                      alert('API key copied to clipboard.');
                    }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--muted)', marginTop: '8px' }}>
                  * This secret will never be displayed again.
                </span>
              </div>
            )}

            <form onSubmit={handleGenerateKey} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input 
                type="text" 
                required 
                className="form-input" 
                placeholder="Key label e.g. ERP integration" 
                value={newKeyLabel} 
                onChange={e => setNewKeyLabel(e.target.value)} 
              />
              <button type="submit" className="btn btn-primary" disabled={keyLoading}>
                {keyLoading ? 'Generating...' : 'Generate key'}
              </button>
            </form>

            {/* List existing keys */}
            {keys.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>No API credentials generated yet.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {keys.map(k => (
                  <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                    <div>
                      <h5 style={{ fontSize: '0.85rem' }}>{k.label}</h5>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Clock size={10} />
                        Last used: {k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Created {new Date(k.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Retention cleanup control */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} color="var(--danger)" /> Retention & Cache Cleaner
            </h3>
            <p style={{ fontSize: '0.8rem', marginBottom: '20px' }}>
              PDF generation jobs expire automatically after 7 days to preserve disk storage. You can run a hard cleanup immediately.
            </p>

            {cleanupResult && (
              <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--success)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <CheckCircle size={16} />
                  <span>Cleanup Finished Successfully:</span>
                </div>
                <ul style={{ fontSize: '0.75rem', color: 'var(--muted)', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Expired files deleted: <strong style={{ color: '#fff' }}>{cleanupResult.deletedFiles}</strong></li>
                  <li>Pruned database logs: <strong style={{ color: '#fff' }}>{cleanupResult.deletedDbRecords}</strong></li>
                </ul>
              </div>
            )}

            <button 
              className="btn btn-danger" 
              style={{ width: '100%', gap: '8px' }} 
              onClick={handleTriggerCleanup}
              disabled={cleanupLoading}
            >
              <Trash2 size={16} /> {cleanupLoading ? 'Cleaning up...' : 'Purge Expired PDF Files & Logs'}
            </button>
          </div>
        </div>

        {/* Right Column: Print vendors directory */}
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={18} color="var(--info)" /> Print Vendors Directory
            </h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => setShowVendorForm(!showVendorForm)}>
              <Plus size={12} /> {showVendorForm ? 'Close Form' : 'Register Vendor'}
            </button>
          </div>

          {showVendorForm && (
            <form onSubmit={handleAddVendor} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>
              <div className="form-group">
                <label className="form-label">Vendor Business Name</label>
                <input type="text" required className="form-input" placeholder="Mega Prints PVT" value={vendorName} onChange={e => setVendorName(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" className="form-input" placeholder="9876543210" value={vendorPhone} onChange={e => setVendorPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" placeholder="orders@megaprints.com" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" className="form-input" placeholder="Bengaluru" value={vendorCity} onChange={e => setVendorCity(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Capabilities, pricing deals)</label>
                <input type="text" className="form-input" placeholder="Offers bulk A3 card print runs at Rs. 10/card" value={vendorNotes} onChange={e => setVendorNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVendorForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={vendorLoading}>
                  {vendorLoading ? 'Adding...' : 'Save Vendor'}
                </button>
              </div>
            </form>
          )}

          {/* Vendors list table */}
          {vendors.length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>No print vendors listed in your directory yet.</span>
          ) : (
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Vendor Name</th>
                    <th>City</th>
                    <th>Contact details</th>
                    <th>Notes</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: '500' }}>{v.name}</td>
                      <td>{v.city || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
                          {v.phone && <span>Ph: {v.phone}</span>}
                          {v.email && <span style={{ color: 'var(--muted)' }}>{v.email}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.notes}>{v.notes || '—'}</td>
                      <td>
                        <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDeleteVendor(v.id)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>

      {confirmConfig && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          variant={confirmConfig.variant}
          onConfirm={confirmConfig.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </>
  );
}
