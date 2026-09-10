'use client';
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface ClientAssignmentSelectProps {
  clients: any[];
  selectedClientIds: number[];
  onChange: React.Dispatch<React.SetStateAction<number[]>>;
}

export default function ClientAssignmentSelect({
  clients,
  selectedClientIds,
  onChange,
}: ClientAssignmentSelectProps) {
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (clients.length === 0) return null;

  return (
    <div id="client-assignment-section" className="form-group" ref={clientDropdownRef} style={{ position: 'relative' }}>
      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Assign to Clients <span style={{ color: 'var(--muted)', fontWeight: 'normal' }}>(multi-select)</span></span>
        {selectedClientIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            style={{
              background: 'none', border: 'none', color: '#f87171', fontSize: '0.72rem', cursor: 'pointer', padding: 0
            }}
          >
            Clear All
          </button>
        )}
      </label>

      {/* Dropdown Trigger */}
      <div
        onClick={() => setShowClientDropdown(!showClientDropdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '42px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: showClientDropdown ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
          background: 'rgba(255, 255, 255, 0.03)',
          cursor: 'pointer',
          gap: '8px',
          flexWrap: 'wrap',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
          {selectedClientIds.length === 0 ? (
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Select clients to assign...</span>
          ) : (
            selectedClientIds.map(id => {
              const cl = clients.find(c => c.id === id);
              if (!cl) return null;
              return (
                <span
                  key={id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    background: 'rgba(79, 70, 229, 0.2)',
                    border: '1px solid rgba(79, 70, 229, 0.4)',
                    borderRadius: '4px',
                    color: '#818cf8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {cl.name}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(prev => prev.filter((i: number) => i !== id));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a5b4fc',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      marginLeft: '2px'
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })
          )}
        </div>
        <ChevronDown size={16} style={{ color: 'var(--muted)', transform: showClientDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </div>

      {/* Dropdown Panel */}
      {showClientDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Search and Action Bar */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search clients..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const filtered = clients.filter(c => c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()));
                const filteredIds = filtered.map(c => c.id);
                onChange(prev => {
                  const union = new Set([...prev, ...filteredIds]);
                  return Array.from(union);
                });
              }}
              style={{
                background: 'rgba(79, 70, 229, 0.1)',
                border: '1px solid rgba(79, 70, 229, 0.3)',
                borderRadius: '6px',
                color: '#818cf8',
                fontSize: '0.72rem',
                padding: '6px 10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Select All
            </button>
          </div>

          {/* Scrollable List */}
          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              paddingRight: '4px',
            }}
          >
            {(() => {
              const filtered = clients.filter(c => c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()));
              if (filtered.length === 0) {
                return (
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center', padding: '12px 0' }}>
                    No clients found
                  </div>
                );
              }
              return filtered.map(cl => {
                const isSelected = selectedClientIds.includes(cl.id);
                return (
                  <div
                    key={cl.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(prev =>
                        isSelected ? prev.filter((id: number) => id !== cl.id) : [...prev, cl.id]
                      );
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                      color: isSelected ? '#818cf8' : 'var(--muted)',
                      fontSize: '0.82rem',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isSelected ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isSelected ? 'rgba(79, 70, 229, 0.08)' : 'transparent';
                      e.currentTarget.style.color = isSelected ? '#818cf8' : 'var(--muted)';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Controlled via parent div onClick
                      style={{
                        cursor: 'pointer',
                        accentColor: 'var(--primary)',
                      }}
                    />
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{cl.name}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
