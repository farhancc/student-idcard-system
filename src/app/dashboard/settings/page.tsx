'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { 
  Key, 
  KeyRound,
  Eye,
  EyeOff,
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
  Save,
  Type,
  Upload,
  FileType,
  CreditCard
} from 'lucide-react';

interface ApiKey {
  id: number;
  label: string;
  lastUsed?: string;
  createdAt: string;
}

interface PrintVendor {
  id: number;
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

interface CleanupResult {
  deletedFiles: number;
  deletedDbRecords: number;
}

interface Font {
  id: number;
  name: string;
  language: string;
  fileUrl: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
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
  const [vendors, setVendors] = useState<PrintVendor[]>([]);
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorCity, setVendorCity] = useState('');
  const [vendorNotes, setVendorNotes] = useState('');
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);

  // Cleanup State
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Fonts state
  const [fonts, setFonts] = useState<Font[]>([]);
  const [fontName, setFontName] = useState('');
  const [fontLanguage, setFontLanguage] = useState('en');
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontUploading, setFontUploading] = useState(false);
  const [fontError, setFontError] = useState('');
  const [showFontForm, setShowFontForm] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  } | null>(null);
  const showConfirm = (cfg: typeof confirmConfig) => { setConfirmConfig(cfg); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmConfig(null); };

  // Credit Requests State
  const [creditRequests, setCreditRequests] = useState<any[]>([]);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Staff Users State
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'OPERATOR' | 'DESIGNER'>('OPERATOR');
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      toast('New password must be at least 8 characters.', 'error');
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch('/api/settings/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast('Password changed successfully.', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast(data.error || 'Failed to change password.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('An unexpected error occurred.', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const handleRequestCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(requestAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    setRequestSubmitting(true);

    try {
      const res = await fetch('/api/settings/credit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountNum }),
      });
      const data = await res.json();
      if (res.ok) {
        toast('Credit request submitted successfully to admin.', 'success');
        setRequestAmount('');
        // Refresh credit requests list
        fetchCreditRequests();
      } else {
        toast(data.error || 'Failed to submit credit request.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to submit request.', 'error');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const fetchCreditRequests = async () => {
    try {
      const res = await fetch('/api/settings/credit-requests');
      if (res.ok) {
        const json = await res.json();
        setCreditRequests(json.requests || []);
      }
    } catch (err) {
      console.error('Fetch credit requests error:', err);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      const res = await fetch('/api/settings/users');
      if (res.ok) {
        const json = await res.json();
        setStaffUsers(json.users || []);
      }
    } catch (err) {
      console.error('Fetch staff users error:', err);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim() || !staffRole) return;
    setStaffLoading(true);

    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          password: staffPassword,
          role: staffRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`Staff user "${data.user.name}" created successfully.`, 'success');
        setStaffName('');
        setStaffEmail('');
        setStaffPassword('');
        setStaffRole('OPERATOR');
        setShowStaffForm(false);
        fetchStaffUsers();
      } else {
        toast(data.error || 'Failed to create staff user.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to create staff user.', 'error');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleDeleteStaff = (id: number, name: string) => {
    showConfirm({
      title: 'Remove Staff User',
      message: `Are you sure you want to remove ${name} from your printing press team? This user will no longer be able to log in.`,
      confirmLabel: 'Remove Staff',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/settings/users/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            toast(`Staff user "${name}" removed successfully.`, 'success');
            fetchStaffUsers();
          } else {
            toast(data.error || 'Failed to delete staff user.', 'error');
          }
        } catch (err) {
          console.error(err);
          toast('Failed to delete staff user.', 'error');
        }
      },
    });
  };

  const fetchData = async () => {
    // ── Each fetch is isolated so one failure cannot block the rest ──────────

    // Fetch Press Profile FIRST — sets currentUserRole which controls UI visibility
    try {
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
          setCurrentUserRole(json.user.role || '');
        }
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
    }

    // Fetch API Keys
    try {
      const keysRes = await fetch('/api/settings/api-keys');
      if (keysRes.ok) {
        const json = await keysRes.json();
        setKeys(json.keys || []);
      }
    } catch (err) {
      console.error('Fetch API keys error:', err);
    }

    // Fetch Print Vendors
    try {
      const vendorsRes = await fetch('/api/print-vendors');
      if (vendorsRes.ok) {
        const json = await vendorsRes.json();
        setVendors(json.vendors || []);
      }
    } catch (err) {
      console.error('Fetch vendors error:', err);
    }

    // Fetch Press Fonts
    try {
      const fontsRes = await fetch('/api/fonts');
      if (fontsRes.ok) {
        const json = await fontsRes.json();
        setFonts((json.fonts || []).filter((f: Font & { pressId: number | null }) => f.pressId !== null));
      }
    } catch (err) {
      console.error('Fetch fonts error:', err);
    }

    // Fetch Credit Requests
    await fetchCreditRequests();

    // Fetch Staff Users
    await fetchStaffUsers();
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

  // ── Eagerly fetch role so the Staff panel isn't blocked by other API calls ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/me');
        if (res.ok) {
          const json = await res.json();
          if (json.user?.role) {
            setCurrentUserRole(json.user.role);
          }
        }
      } catch (err) {
        console.error('Fetch me error:', err);
      }
    })();
  }, []);

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

  // Upload font
  const handleUploadFont = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fontFile || !fontName.trim()) return;
    setFontUploading(true);
    setFontError('');
    try {
      const fd = new FormData();
      fd.append('file', fontFile);
      fd.append('name', fontName.trim());
      fd.append('language', fontLanguage);
      const res = await fetch('/api/fonts', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setFontName('');
        setFontLanguage('en');
        setFontFile(null);
        setShowFontForm(false);
        toast(`Font "${data.font.name}" uploaded successfully.`, 'success');
        fetchData();
      } else {
        setFontError(data.error || 'Upload failed.');
      }
    } catch (err: any) {
      setFontError(err.message || 'Unexpected error.');
    } finally {
      setFontUploading(false);
    }
  };

  // Delete font
  const handleDeleteFont = (id: number, name: string) => {
    showConfirm({
      title: 'Remove Font',
      message: `Remove "${name}" from your press font library? Templates using this font will fall back to the default Helvetica.`,
      confirmLabel: 'Remove Font',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/fonts/${id}`, { method: 'DELETE' });
          if (res.ok) { toast(`Font "${name}" removed.`, 'success'); fetchData(); }
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

      <div className="dashboard-grid-2col">
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

          {/* ── Change Password ──────────────────────────────────────────────── */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} color="var(--primary)" /> Change Password
            </h3>
            <p style={{ fontSize: '0.8rem', marginBottom: '20px', color: 'var(--muted)' }}>
              Update your account password. You must enter your current password to confirm the change.
            </p>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Current Password */}
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    required
                    className="form-input"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(v => !v)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                    tabIndex={-1}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* New Password */}
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      required
                      minLength={8}
                      className="form-input"
                      placeholder="min. 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(v => !v)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                      tabIndex={-1}
                    >
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      required
                      minLength={8}
                      className="form-input"
                      placeholder="repeat new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{
                        paddingRight: '40px',
                        borderColor: confirmPassword && newPassword !== confirmPassword ? 'var(--danger)' : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(v => !v)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                      tabIndex={-1}
                    >
                      {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
                      Passwords do not match
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: '4px', gap: '8px', justifyContent: 'center' }}
                disabled={pwLoading || (!!confirmPassword && newPassword !== confirmPassword)}
              >
                <KeyRound size={16} /> {pwLoading ? 'Updating Password...' : 'Update Password'}
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
                      toast('API key copied to clipboard.', 'success');
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

          {/* ── Custom Fonts Library ─────────────────────────────────────── */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Type size={18} color="var(--primary)" /> Custom Font Library
              </h3>
              <button
                id="add-font-btn"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={() => { setShowFontForm(f => !f); setFontError(''); }}
              >
                <Plus size={12} /> {showFontForm ? 'Close' : 'Add Font'}
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', marginBottom: '16px', color: 'var(--muted)' }}>
              Upload custom TTF / OTF / WOFF / WOFF2 fonts. These are available in the template editor field properties and embedded into generated PDFs.
            </p>

            {showFontForm && (
              <form
                id="font-upload-form"
                onSubmit={handleUploadFont}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}
              >
                {fontError && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem' }}>
                    {fontError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    id="font-name-input"
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Noto Sans Devanagari"
                    value={fontName}
                    onChange={e => setFontName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Script / Language</label>
                    <select
                      id="font-language-select"
                      className="form-input"
                      value={fontLanguage}
                      onChange={e => setFontLanguage(e.target.value)}
                    >
                      <option value="en">Latin / English</option>
                      <option value="hi">Hindi (Devanagari)</option>
                      <option value="ur">Urdu (Nastaliq)</option>
                      <option value="ar">Arabic</option>
                      <option value="ta">Tamil</option>
                      <option value="te">Telugu</option>
                      <option value="bn">Bengali</option>
                      <option value="gu">Gujarati</option>
                      <option value="pa">Punjabi (Gurmukhi)</option>
                      <option value="ml">Malayalam</option>
                      <option value="kn">Kannada</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Font File</label>
                    <input
                      id="font-file-input"
                      type="file"
                      required
                      accept=".ttf,.otf,.woff,.woff2"
                      className="form-input"
                      style={{ padding: '6px', cursor: 'pointer' }}
                      onChange={e => setFontFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowFontForm(false)}>Cancel</button>
                  <button id="font-upload-submit" type="submit" className="btn btn-primary" disabled={fontUploading} style={{ gap: '8px' }}>
                    <Upload size={14} /> {fontUploading ? 'Uploading...' : 'Upload Font'}
                  </button>
                </div>
              </form>
            )}

            {fonts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: '0.8rem' }}>
                <FileType size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
                <p>No custom fonts uploaded yet.</p>
                <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Add fonts to unlock multilingual text fields in your card templates.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {fonts.map((f: Font) => {
                  const langLabels: Record<string, string> = {
                    en: 'Latin', hi: 'Hindi', ur: 'Urdu', ar: 'Arabic',
                    ta: 'Tamil', te: 'Telugu', bn: 'Bengali', gu: 'Gujarati',
                    pa: 'Punjabi', ml: 'Malayalam', kn: 'Kannada', other: 'Other',
                  };
                  const langColors: Record<string, string> = {
                    en: '#6366f1', hi: '#f59e0b', ur: '#10b981', ar: '#ef4444',
                    ta: '#8b5cf6', te: '#ec4899', bn: '#14b8a6', gu: '#f97316',
                    pa: '#a78bfa', ml: '#34d399', kn: '#fb923c', other: '#94a3b8',
                  };
                  const color = langColors[f.language] ?? '#94a3b8';
                  return (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '8px',
                          background: `${color}22`,
                          border: `1px solid ${color}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Type size={16} color={color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: '600', padding: '2px 7px',
                              borderRadius: '4px', background: `${color}22`,
                              color: color, border: `1px solid ${color}44`,
                              letterSpacing: '0.04em',
                            }}>
                              {langLabels[f.language] ?? f.language}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                              {f.fileUrl.startsWith('data:') 
                                ? 'Embedded (Base64)' 
                                : (f.fileUrl.split('/').pop()?.replace(/_\d+\./, '.') ?? f.fileUrl)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        id={`delete-font-${f.id}`}
                        className="btn btn-danger"
                        style={{ padding: '6px', flexShrink: 0 }}
                        onClick={() => handleDeleteFont(f.id, f.name)}
                        title="Remove font"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Print vendors directory and Credit Requests */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Staff Management Panel */}
          {currentUserRole === 'OWNER' && (
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={18} color="var(--primary)" /> Staff User Management
                </h3>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }} 
                  onClick={() => setShowStaffForm(!showStaffForm)}
                >
                  <Plus size={12} /> {showStaffForm ? 'Close Form' : 'Add Staff'}
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', marginBottom: '20px', color: 'var(--muted)' }}>
                Add and manage printing press Operators and Designers. Only the Press Owner can manage staff users.
              </p>

              {showStaffForm && (
                <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input type="text" required className="form-input" placeholder="e.g. John Doe" value={staffName} onChange={e => setStaffName(e.target.value)} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input type="email" required className="form-input" placeholder="john@example.com" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <input type="password" required className="form-input" placeholder="••••••••" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select 
                      className="form-input" 
                      value={staffRole} 
                      onChange={e => setStaffRole(e.target.value as 'OPERATOR' | 'DESIGNER')}
                    >
                      <option value="OPERATOR">Operator (Print / Job processing)</option>
                      <option value="DESIGNER">Designer (Template customization only)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowStaffForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={staffLoading}>
                      {staffLoading ? 'Adding...' : 'Save Staff User'}
                    </button>
                  </div>
                </form>
              )}

              {/* Staff list table */}
              {staffUsers.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>No staff users added yet.</span>
              ) : (
                <div className="table-container">
                  <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffUsers.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: '500' }}>{u.name}</td>
                          <td>{u.email}</td>
                          <td>
                            <span style={{
                              fontSize: '0.7rem', 
                              fontWeight: '600', 
                              padding: '2px 8px', 
                              borderRadius: '4px',
                              background: u.role === 'OWNER' ? 'rgba(99,102,241,0.1)' : u.role === 'OPERATOR' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                              color: u.role === 'OWNER' ? '#818cf8' : u.role === 'OPERATOR' ? '#34d399' : '#fbbf24',
                              border: `1px solid ${u.role === 'OWNER' ? 'rgba(99,102,241,0.2)' : u.role === 'OPERATOR' ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            {u.role !== 'OWNER' ? (
                              <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDeleteStaff(u.id, u.name)}>
                                <Trash2 size={12} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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

          {/* Credit Requests */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="var(--primary)" /> Request Print Credits
            </h3>
            <p style={{ fontSize: '0.8rem', marginBottom: '20px', color: 'var(--muted)' }}>
              Submit a request to the Super Admin to add more credits to your press account.
            </p>

            <form onSubmit={handleRequestCredits} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>
              <div className="form-group">
                <label className="form-label">Credit Amount</label>
                <input 
                  type="number" 
                  required 
                  min="1" 
                  className="form-input" 
                  placeholder="e.g. 500" 
                  value={requestAmount} 
                  onChange={e => setRequestAmount(e.target.value)} 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ gap: '8px', justifyContent: 'center' }} disabled={requestSubmitting}>
                <Plus size={16} /> {requestSubmitting ? 'Submitting Request...' : 'Submit Credit Request'}
              </button>
            </form>

            <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '12px' }}>Request History</h4>
            {creditRequests.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>No credit requests submitted yet.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {creditRequests.map(r => {
                  const statusColors: Record<string, { bg: string, text: string, border: string }> = {
                    PENDING: { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning)', border: 'rgba(245, 158, 11, 0.2)' },
                    APPROVED: { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--success)', border: 'rgba(16, 185, 129, 0.2)' },
                    REJECTED: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger)', border: 'rgba(239, 68, 68, 0.2)' },
                  };
                  const color = statusColors[r.status] || { bg: 'rgba(255,255,255,0.05)', text: 'var(--muted)', border: 'rgba(255,255,255,0.1)' };
                  return (
                    <div key={r.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#fff' }}>
                          {r.amount.toLocaleString()} Credits
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px',
                          background: color.bg, color: color.text, border: `1px solid ${color.border}`,
                        }}>
                          {r.status}
                        </span>
                      </div>
                      {r.reason && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>
                          <span style={{ fontWeight: '500', color: '#ccc' }}>Reason:</span> {r.reason}
                        </p>
                      )}
                      {r.adminNotes && (
                        <div style={{ fontSize: '0.75rem', padding: '8px', background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid var(--primary)', borderRadius: '4px', margin: 0 }}>
                          <span style={{ fontWeight: '600', color: 'var(--primary)' }}>Admin Notes:</span> {r.adminNotes}
                        </div>
                      )}
                      <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                        Requested on {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
