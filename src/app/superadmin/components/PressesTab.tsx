import React from 'react';
import { Building2, ShieldCheck, Power, Sparkles, Loader2, Users, FolderKanban, DollarSign, Eye, Key, CreditCard, Trash2 } from 'lucide-react';

interface PressesTabProps {
  totalPresses: number;
  activePresses: number;
  suspendedPresses: number;
  loading: boolean;
  presses: any[];
  actionLoading: string | null;
  handleChangePlan: (id: string, plan: string) => void;
  handleToggleStatus: (id: string, isActive: boolean) => void;
  setDetailPress: (press: any) => void;
  setResetPress: (press: any) => void;
  setResetModalOpen: (open: boolean) => void;
  setSelectedCreditsPress: (press: any) => void;
  setCreditsModalOpen: (open: boolean) => void;
  setCreditsAmount: (amount: string) => void;
  setCreditsSuccessMessage: (msg: string) => void;
  handleHardDeletePress: (id: string, name: string) => void;
}

export default function PressesTab({
  totalPresses,
  activePresses,
  suspendedPresses,
  loading,
  presses,
  actionLoading,
  handleChangePlan,
  handleToggleStatus,
  setDetailPress,
  setResetPress,
  setResetModalOpen,
  setSelectedCreditsPress,
  setCreditsModalOpen,
  setCreditsAmount,
  setCreditsSuccessMessage,
  handleHardDeletePress
}: PressesTabProps) {
  return (
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
                  <th>Last Signed In</th>
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
                      {(() => {
                        const userLogins = (press.users || [])
                          .map((u: any) => u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0)
                          .filter((t: number) => t > 0);
                        const maxLogin = userLogins.length > 0 ? Math.max(...userLogins) : 0;
                        if (!maxLogin) return <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Never</span>;
                        const dateObj = new Date(maxLogin);
                        return (
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#10b981' }}>
                              {dateObj.toLocaleDateString()}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                              {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      })()}
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
                        <div><Users size={11} style={{ display: 'inline', marginRight: '4px' }}/>Users: <strong>{press._count?.users || 0}</strong></div>
                        <div><Building2 size={11} style={{ display: 'inline', marginRight: '4px' }}/>Clients: <strong>{press._count?.clients || 0}</strong></div>
                        <div><FolderKanban size={11} style={{ display: 'inline', marginRight: '4px' }}/>Orders: <strong>{press._count?.orders || 0}</strong></div>
                        <div><ShieldCheck size={11} style={{ display: 'inline', marginRight: '4px' }}/>Jobs: <strong>{press._count?.jobs || 0}</strong></div>
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
                            title="Manage Credits"
                            onClick={() => { setSelectedCreditsPress(press); setCreditsModalOpen(true); setCreditsAmount(''); setCreditsSuccessMessage(''); }}
                          >
                            <CreditCard size={11} />
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.72rem', background: 'rgba(239,68,68,0.2)', color: '#f87171', borderColor: 'rgba(239,68,68,0.4)' }}
                            title="Hard Delete Press & All Records"
                            disabled={actionLoading === press.id}
                            onClick={() => handleHardDeletePress(press.id, press.name)}
                          >
                            <Trash2 size={11} />
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
  );
}
