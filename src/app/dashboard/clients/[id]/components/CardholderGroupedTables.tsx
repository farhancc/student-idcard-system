'use client';

import React from 'react';
import { AlertTriangle, CreditCard, Zap, Download, ListChecks, Check, Trash2, FileSpreadsheet } from 'lucide-react';

import { normalizeGoogleDriveUrl } from '@/lib/pdf/card-renderer-client';

interface CardholderGroupedTablesProps {
  filteredCardholders: any[];
  clientTemplates: any[];
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  filterTemplate: string;
  onViewDetails: (ch: any) => void;
  onEdit: (ch: any) => void;
  onDelete: (id: number) => void;
  onCompileTable: (targetCardholders: any[], targetTemplate?: any) => void;
  onExportExcel: (targetCardholders: any[], templateName?: string) => void;
  onDownloadZip: (targetCardholders: any[], templateName?: string) => void;
  onPurgeClient: () => void;
  onCompileIndividual: (ch: any) => void;
  getTemplateColumns: (tmpl: any) => any[];
  getFieldValue: (ch: any, colKey: string) => string;
  getCardholderWarnings?: (ch: any) => string[];
  getEffectivePhotoUrl?: (ch: any) => string | null;
  zipping?: boolean;
  zipProgress?: string;
}

export default function CardholderGroupedTables({
  filteredCardholders,
  clientTemplates,
  selectedIds,
  setSelectedIds,
  filterTemplate,
  onViewDetails,
  onEdit,
  onDelete,
  onCompileTable,
  onExportExcel,
  onDownloadZip,
  onPurgeClient,
  onCompileIndividual,
  getTemplateColumns,
  getFieldValue,
  getCardholderWarnings = () => [],
  getEffectivePhotoUrl = () => null,
  zipping = false,
  zipProgress = '',
}: CardholderGroupedTablesProps) {
  const rawTemplates = clientTemplates.length > 0 ? clientTemplates : [{ id: 0, name: 'Default Template', frontFields: '[]', backFields: '[]' }];
  
  const normalizeTemplateName = (name: string) => {
    if (!name) return 'default template';
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*\(v\d+(\.\d+)?\)$/i, '')
      .replace(/\s*v\d+(\.\d+)?$/i, '');
  };

  // Group templates by normalized name to consolidate template updates/versions into a single table
  const templateGroupsMap = new Map<string, {
    latestTemplate: any;
    allTemplateIds: Set<string | number>;
  }>();

  rawTemplates.forEach(tmpl => {
    const normName = normalizeTemplateName(tmpl.name);
    if (!templateGroupsMap.has(normName)) {
      templateGroupsMap.set(normName, {
        latestTemplate: tmpl,
        allTemplateIds: new Set([tmpl.id]),
      });
    } else {
      const existing = templateGroupsMap.get(normName)!;
      existing.allTemplateIds.add(tmpl.id);

      const curVer = Number(tmpl.version) || 0;
      const exVer = Number(existing.latestTemplate.version) || 0;
      const curTime = tmpl.updatedAt ? new Date(tmpl.updatedAt).getTime() : (tmpl.createdAt ? new Date(tmpl.createdAt).getTime() : 0);
      const exTime = existing.latestTemplate.updatedAt ? new Date(existing.latestTemplate.updatedAt).getTime() : (existing.latestTemplate.createdAt ? new Date(existing.latestTemplate.createdAt).getTime() : 0);
      const curId = Number(tmpl.id) || 0;
      const exId = Number(existing.latestTemplate.id) || 0;

      let isNewer = false;
      if (curVer !== exVer) {
        isNewer = curVer > exVer;
      } else if (curTime !== exTime) {
        isNewer = curTime > exTime;
      } else {
        isNewer = curId > exId;
      }

      if (isNewer) {
        existing.latestTemplate = tmpl;
      }
    }
  });

  const templateGroups = Array.from(templateGroupsMap.values());
  const processedCardholderIds = new Set<number>();

  const templateTables = templateGroups.map(group => {
    const tmpl = group.latestTemplate;
    const tmplCardholders = filteredCardholders.filter(c => {
      // Prevent any cardholder from being processed into multiple tables
      if (processedCardholderIds.has(c.id)) {
        return false;
      }

      const isIdMatch = c.resolvedTemplateId != null && (
        group.allTemplateIds.has(c.resolvedTemplateId) || 
        group.allTemplateIds.has(Number(c.resolvedTemplateId)) || 
        group.allTemplateIds.has(String(c.resolvedTemplateId))
      );
      const isNameMatch = c.templateName && tmpl.name && (
        normalizeTemplateName(c.templateName) === normalizeTemplateName(tmpl.name)
      );
      const isFallbackMatch = (!c.resolvedTemplateId || c.resolvedTemplateId === 0) && (!c.templateName || c.templateName === '—') && templateGroups.length === 1;

      const match = Boolean(isIdMatch || isNameMatch || isFallbackMatch);
      if (match) {
        processedCardholderIds.add(c.id);
      }
      return match;
    });

    if (filterTemplate) {
      const filterLower = filterTemplate.trim().toLowerCase();
      const matchId = Array.from(group.allTemplateIds).some(id => String(id).toLowerCase() === filterLower);
      const matchName = normalizeTemplateName(tmpl.name) === normalizeTemplateName(filterTemplate);
      if (!matchId && !matchName) {
        return null;
      }
    }

    if (tmplCardholders.length === 0) {
      return null;
    }

    const cols = getTemplateColumns(tmpl);
    const hasNameCol = cols.some(c => c.key === 'name' || c.key === 'fullName' || c.key.toLowerCase().includes('name'));
    const firstNonImgIdx = cols.findIndex(col => {
      const isImg = col.type === 'image' || 
        ['photo', 'avatar', 'photourl', 'image', 'picture'].includes(col.key.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
        col.key.toLowerCase().includes('photo') ||
        col.key.toLowerCase().includes('picture') ||
        col.key.toLowerCase().includes('avatar');
      return !isImg;
    });

    const selectedInTmpl = tmplCardholders.filter(c => selectedIds.includes(c.id));
    const hasTmplSelection = selectedInTmpl.length > 0;
    const targetTmplList = hasTmplSelection ? selectedInTmpl : tmplCardholders;

    return (
      <div key={tmpl.id || tmpl.name} style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} />
            {tmpl.name} <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}>({tmplCardholders.length} cardholders{hasTmplSelection ? `, ${selectedInTmpl.length} selected` : ''})</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '5px 12px', gap: '6px' }}
              onClick={() => onCompileTable(targetTmplList, tmpl)}
              title={hasTmplSelection ? `Compile PDF for ${selectedInTmpl.length} selected cardholders in ${tmpl.name}` : `Compile PDF for all ${tmplCardholders.length} cardholders in ${tmpl.name}`}
            >
              <Zap size={14} />
              {hasTmplSelection ? `Compile PDF (${selectedInTmpl.length})` : `Compile PDF (${tmplCardholders.length})`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                gap: '6px',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#34d399'
              }}
              onClick={() => onExportExcel(targetTmplList, tmpl.name)}
              title={hasTmplSelection ? `Export Excel for ${selectedInTmpl.length} selected cardholders in ${tmpl.name}` : `Export Excel spreadsheet for ${tmpl.name}`}
            >
              <FileSpreadsheet size={14} />
              {hasTmplSelection ? `Export Excel (${selectedInTmpl.length})` : 'Export Excel'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                gap: '6px',
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#60a5fa'
              }}
              onClick={() => onDownloadZip(targetTmplList, tmpl.name)}
              disabled={zipping}
              title="Download ZIP package of photos and Excel metadata for this template"
            >
              <Download size={14} />
              {zipping ? (zipProgress || 'Zipping...') : 'Download ZIP'}
            </button>
          </div>
        </div>

        <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '14px 12px' }}>
                    <input
                      type="checkbox"
                      checked={tmplCardholders.length > 0 && tmplCardholders.every(c => selectedIds.includes(c.id))}
                      onChange={() => {
                        const tmplIds = tmplCardholders.map(c => c.id);
                        const allSelected = tmplIds.every(id => selectedIds.includes(id));
                        if (allSelected) {
                          setSelectedIds(prev => prev.filter(id => !tmplIds.includes(id)));
                        } else {
                          setSelectedIds(prev => Array.from(new Set([...prev, ...tmplIds])));
                        }
                      }}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                  </th>
                  {cols.map(col => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  {cols.length === 0 && <th>Name</th>}
                  <th>Date Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tmplCardholders.map(ch => {
                  const effectivePhoto = getEffectivePhotoUrl(ch);

                  return (
                    <tr
                      key={ch.id}
                      style={{ background: selectedIds.includes(ch.id) ? 'rgba(79,70,229,0.07)' : undefined }}
                    >
                      <td style={{ padding: '16px 12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ch.id)}
                          onChange={() => setSelectedIds(prev =>
                            prev.includes(ch.id) ? prev.filter(x => x !== ch.id) : [...prev, ch.id]
                          )}
                          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                      </td>

                      {cols.map((col, idx) => {
                        const val = getFieldValue(ch, col.key);
                        const isNameCol = col.key === 'name' || col.key === 'fullName' || col.key.toLowerCase().includes('name') || (!hasNameCol && idx === (firstNonImgIdx !== -1 ? firstNonImgIdx : 0));
                        const isImgCol = col.type === 'image' || 
                          ['photo', 'avatar', 'photourl', 'image', 'picture'].includes(col.key.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
                          col.key.toLowerCase().includes('photo') ||
                          col.key.toLowerCase().includes('picture') ||
                          col.key.toLowerCase().includes('avatar');

                        if (isImgCol) {
                          const imgUrl = normalizeGoogleDriveUrl(val || effectivePhoto) || (val || effectivePhoto);
                          return (
                            <td key={col.key}>
                              {imgUrl ? (
                                <img 
                                  src={imgUrl} 
                                  alt={col.label} 
                                  style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} 
                                />
                              ) : (
                                <div 
                                  title={`${col.label} is missing`}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '6px',
                                    background: 'rgba(245,158,11,0.12)',
                                    border: '1px solid rgba(245,158,11,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fbbf24',
                                    fontSize: '0.7rem',
                                    fontWeight: '500',
                                    cursor: 'help'
                                  }}
                                >
                                  Missing
                                </div>
                              )}
                            </td>
                          );
                        }

                        return (
                          <td key={col.key} style={{ fontWeight: isNameCol ? '500' : 'normal' }}>
                            {isNameCol ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {val || ch.name}
                                {(() => {
                                  const warnings = getCardholderWarnings(ch);
                                  if (warnings.length > 0) {
                                    return (
                                      <span 
                                        title={warnings.join('\n')}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          background: 'rgba(245,158,11,0.15)',
                                          color: '#fbbf24',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.7rem',
                                          fontWeight: 'normal',
                                          border: '1px solid rgba(245,158,11,0.3)',
                                          cursor: 'help'
                                        }}
                                      >
                                        <AlertTriangle size={12} />
                                        {warnings.length} Issue{warnings.length > 1 ? 's' : ''}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              val || (
                                <span title={`${col.label} is missing`} style={{ color: '#f59e0b', opacity: 0.85, cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.85rem' }}>
                                  — <span style={{ fontSize: '0.7rem' }}>⚠️</span>
                                </span>
                              )
                            )}
                          </td>
                        );
                      })}

                      {cols.length === 0 && (
                        <td style={{ fontWeight: '500' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {ch.name}
                            {(() => {
                              const warnings = getCardholderWarnings(ch);
                              if (warnings.length > 0) {
                                return (
                                  <span 
                                    title={warnings.join('\n')}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: 'rgba(245,158,11,0.15)',
                                      color: '#fbbf24',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: 'normal',
                                      border: '1px solid rgba(245,158,11,0.3)',
                                      cursor: 'help'
                                    }}
                                  >
                                    <AlertTriangle size={12} />
                                    {warnings.length} Issue{warnings.length > 1 ? 's' : ''}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                      )}

                      <td>{new Date(ch.createdAt).toLocaleDateString()}</td>

                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'rgba(99, 102, 241, 0.2)' }}
                            onClick={() => onCompileIndividual(ch)}
                          >
                            Compile PDF
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            onClick={() => onViewDetails(ch)}
                          >
                            View
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                            onClick={() => onEdit(ch)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            onClick={() => onDelete(ch.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </div>
    );
  });

  // Unassigned cardholders check
  const unassigned = filteredCardholders.filter(c => !processedCardholderIds.has(c.id));
  const unassignedSelected = unassigned.filter(c => selectedIds.includes(c.id));
  const hasUnassignedSelection = unassignedSelected.length > 0;
  const targetUnassignedList = hasUnassignedSelection ? unassignedSelected : unassigned;

  const unassignedTable = unassigned.length > 0 ? (
    <div key="unassigned" style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={18} />
          Unassigned Cardholders <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}>({unassigned.length} cardholders{hasUnassignedSelection ? `, ${unassignedSelected.length} selected` : ''})</span>
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '5px 12px', gap: '6px' }}
            onClick={() => onCompileTable(targetUnassignedList)}
            title={hasUnassignedSelection ? `Compile PDF for ${unassignedSelected.length} selected unassigned cardholders` : `Compile PDF for all ${unassigned.length} unassigned cardholders`}
          >
            <Zap size={14} />
            {hasUnassignedSelection ? `Compile PDF (${unassignedSelected.length})` : `Compile PDF (${unassigned.length})`}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '5px 12px',
              gap: '6px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#34d399'
            }}
            onClick={() => onExportExcel(targetUnassignedList, 'Unassigned_Cardholders')}
            title={hasUnassignedSelection ? `Export Excel for ${unassignedSelected.length} selected unassigned cardholders` : 'Export Excel spreadsheet for unassigned cardholders'}
          >
            <FileSpreadsheet size={14} />
            {hasUnassignedSelection ? `Export Excel (${unassignedSelected.length})` : 'Export Excel'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '5px 12px',
              gap: '6px',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#60a5fa'
            }}
            onClick={() => onDownloadZip(targetUnassignedList, 'Unassigned')}
            disabled={zipping}
            title="Download ZIP package of photos and Excel metadata for unassigned cardholders"
          >
            <Download size={14} />
            {zipping ? (zipProgress || 'Zipping...') : 'Download ZIP'}
          </button>
        </div>
      </div>
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '40px', padding: '14px 12px' }}>
                <input
                  type="checkbox"
                  checked={unassigned.every(c => selectedIds.includes(c.id))}
                  onChange={() => {
                    const ids = unassigned.map(c => c.id);
                    const allSelected = ids.every(id => selectedIds.includes(id));
                    if (allSelected) {
                      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
                    } else {
                      setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
                    }
                  }}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
              </th>
              <th>Photo</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Date Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {unassigned.map(ch => {
              const effectivePhoto = getEffectivePhotoUrl(ch);

              return (
                <tr key={ch.id} style={{ background: selectedIds.includes(ch.id) ? 'rgba(79,70,229,0.07)' : undefined }}>
                  <td style={{ padding: '16px 12px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(ch.id)}
                      onChange={() => setSelectedIds(prev =>
                        prev.includes(ch.id) ? prev.filter(x => x !== ch.id) : [...prev, ch.id]
                      )}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                  </td>
                  <td>
                    {effectivePhoto ? (
                      <img 
                        src={normalizeGoogleDriveUrl(effectivePhoto) || effectivePhoto} 
                        alt={ch.name} 
                        style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} 
                      />
                    ) : (
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '6px',
                        background: 'rgba(255,255,255,0.05)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--muted)', fontSize: '0.75rem'
                      }}>
                        None
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: '500' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {ch.name}
                      {(() => {
                        const warnings = getCardholderWarnings(ch);
                        if (warnings.length > 0) {
                          return (
                            <span 
                              title={warnings.join('\n')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(245,158,11,0.15)',
                                color: '#fbbf24',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 'normal',
                                border: '1px solid rgba(245,158,11,0.3)',
                                cursor: 'help'
                              }}
                            >
                              <AlertTriangle size={12} />
                              {warnings.length} Issue{warnings.length > 1 ? 's' : ''}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </td>
                  <td>{ch.designation || '—'}</td>
                  <td>{new Date(ch.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'rgba(99, 102, 241, 0.2)' }} onClick={() => onCompileIndividual(ch)}>Compile PDF</button>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => onViewDetails(ch)}>View</button>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'rgba(99, 102, 241, 0.3)' }} onClick={() => onEdit(ch)}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => onDelete(ch.id)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;

  const hasAnyTables = templateTables.some(t => t !== null) || unassignedTable !== null;

  return (
    <>
      {hasAnyTables ? (
        <>
          {templateTables}
          {unassignedTable}
        </>
      ) : (
        <div className="glass-panel" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          No cardholders match the selected criteria.
        </div>
      )}
    </>
  );
}
