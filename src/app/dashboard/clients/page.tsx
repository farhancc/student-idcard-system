'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Search, Building2, MapPin, Phone, Mail, FolderOpen } from 'lucide-react';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('SCHOOL');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const json = await res.json();
        setClients(json.clients || []);
      }
    } catch (err) {
      console.error('Fetch clients error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          contactName,
          contactPhone,
          contactEmail,
          address,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create client');
      }

      // Reset
      setName('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setAddress('');
      setShowForm(false);
      fetchClients();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contactName && c.contactName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Client Registries</h1>
          <p style={{ marginTop: '4px' }}>Manage directory folders for schools, companies, and organizations.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {showForm ? 'Hide Form' : 'Register Client'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '32px', maxWidth: '640px' }}>
          <h3 style={{ marginBottom: '20px' }}>New Client Registration</h3>
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Client / Organization Name</label>
              <input type="text" required className="form-input" placeholder="Springfield High School" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Client Type</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="SCHOOL">School / Education</option>
                <option value="COMPANY">Company / Corporate</option>
                <option value="NGO">NGO / Volunteer Group</option>
                <option value="GOVERNMENT">Government Branch</option>
                <option value="OTHER">Other / Social Group</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Contact Person Name</label>
              <input type="text" className="form-input" placeholder="Principal Skinner" value={contactName} onChange={e => setContactName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input type="email" className="form-input" placeholder="skinner@springfield.edu" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input type="text" className="form-input" placeholder="555-0199" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Address</label>
              <textarea className="form-textarea" rows={3} placeholder="742 Evergreen Terrace" value={address} onChange={e => setAddress(e.target.value)} />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Registering...' : 'Save Organization'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search filter */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Search size={18} color="var(--muted)" />
        <input
          type="text"
          className="form-input"
          style={{ background: 'transparent', border: 'none', padding: '4px' }}
          placeholder="Search by organization name or contact person..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Building2 size={40} color="var(--muted)" style={{ marginBottom: '16px' }} />
          <h3>No Client Registries Found</h3>
          <p style={{ marginTop: '8px' }}>Register your first client organization to begin managing cardholders.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          {filteredClients.map((client) => (
            <div key={client.id} className="glass-panel glass-panel-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.15rem' }}>{client.name}</h3>
                  <span className="badge badge-primary">{client.type}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  {client.contactName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={14} /> <span>Contact: {client.contactName}</span>
                    </div>
                  )}
                  {client.contactEmail && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={14} /> <span>{client.contactEmail}</span>
                    </div>
                  )}
                  {client.contactPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={14} /> <span>{client.contactPhone}</span>
                    </div>
                  )}
                  {client.address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={14} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>{client.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <a href={`/dashboard/clients/${client.id}`} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
                  <FolderOpen size={14} /> Open Directory
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
