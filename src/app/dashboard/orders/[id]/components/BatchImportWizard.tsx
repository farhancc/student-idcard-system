'use client';

import React, { useRef } from 'react';
import {
  FileText,
  ImageIcon,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Search,
  Upload,
  Eye,
  Edit3,
  Save,
  RotateCcw,
  FileSpreadsheet,
  Archive,
  Users,
  Zap,
} from 'lucide-react';
import { useBatchImport, MappedCardholder } from '../hooks/useBatchImport';

interface BatchImportWizardProps {
  orderId: number;
  order: any;
  fetchData: () => void;
  proceedWithCompile: (type: string) => void;
}

export function BatchImportWizard({
  orderId,
  order,
  fetchData,
  proceedWithCompile,
}: BatchImportWizardProps) {
  const {
    wizardStep,
    setWizardStep,
    excelFile,
    setExcelFile,
    zipFile,
    setZipFile,
    analyzing,
    saving,
    savedCount,
    parsedRows,
    columns,
    imageFiles,
    photosMap,
    mappedCardholders,
    setMappedCardholders,
    selectedIndexes,
    setSelectedIndexes,
    searchQuery,
    setSearchQuery,
    editingCardholder,
    setEditingCardholder,
    editingIndex,
    setEditingIndex,
    isEditingDetail,
    setIsEditingDetail,
    handleAnalyze,
    handleSave,
    handleSaveCardholderEdit,
    resetWizard,
  } = useBatchImport(orderId, order);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const steps = [
    { number: 1, name: 'Upload Files', desc: 'Excel & Photos ZIP' },
    { number: 2, name: 'Review & Edit', desc: 'Verify Mapped Data' },
    { number: 3, name: 'Compile PDFs', desc: 'Generate Output' },
  ];

  const totalCount = mappedCardholders.length;
  const matchedCount = mappedCardholders.filter((c) => c.hasPhoto).length;
  const missingCount = totalCount - matchedCount;
  const selectedCount = selectedIndexes.length;

  const filteredCardholders = mappedCardholders
    .map((c, idx) => ({ ...c, originalIndex: idx }))
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.designation || '').toLowerCase().includes(q) ||
        (c.imageColumnValue || '').toLowerCase().includes(q)
      );
    });

  // ─── Step Header ──────────────────────────────────────────
  const renderStepHeader = () => (
    <div
      className="glass-panel"
      style={{
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        border: '1px solid var(--glass-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{
            padding: '8px 12px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
          }}
          onClick={() => {
            if (wizardStep === 1) return;
            if (wizardStep === 3) {
              // After saving, going back doesn't make sense — offer reset
              resetWizard();
            } else {
              setWizardStep((prev) => (prev - 1) as any);
            }
          }}
          disabled={wizardStep === 1}
        >
          <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Back
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
            Batch Import Wizard
          </h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
            Step {wizardStep} of 3: {steps[wizardStep - 1].name} —{' '}
            {steps[wizardStep - 1].desc}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {steps.map((step) => {
          const isCompleted = wizardStep > step.number;
          const isActive = wizardStep === step.number;

          return (
            <div
              key={step.number}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isActive
                    ? 'linear-gradient(135deg, #4f46e5, #3b82f6)'
                    : isCompleted
                      ? 'linear-gradient(135deg, #059669, #10b981)'
                      : '#1e293b',
                  border: isActive
                    ? '2px solid #a5b4fc'
                    : isCompleted
                      ? '2px solid #34d399'
                      : '2px solid #334155',
                  color: isActive || isCompleted ? '#fff' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  boxShadow: isActive
                    ? '0 0 12px rgba(99,102,241,0.5)'
                    : 'none',
                }}
              >
                {isCompleted ? <Check size={14} /> : step.number}
              </div>
              {step.number < 3 && (
                <div
                  style={{
                    width: '24px',
                    height: '2px',
                    background: isCompleted
                      ? '#34d399'
                      : 'rgba(255,255,255,0.1)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── Step 1: Upload Files ─────────────────────────────────
  const renderStep1 = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
      }}
    >
      {/* Excel Upload */}
      <div
        className="glass-panel"
        style={{
          padding: '32px',
          textAlign: 'center',
          border: excelFile
            ? '2px solid rgba(16,185,129,0.4)'
            : '2px dashed rgba(255,255,255,0.15)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => excelInputRef.current?.click()}
      >
        <input
          ref={excelInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setExcelFile(f);
          }}
        />
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: excelFile
              ? 'rgba(16,185,129,0.15)'
              : 'rgba(99,102,241,0.1)',
            border: excelFile
              ? '1px solid rgba(16,185,129,0.3)'
              : '1px solid rgba(99,102,241,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: excelFile ? '#10b981' : '#818cf8',
          }}
        >
          {excelFile ? <CheckCircle size={28} /> : <FileSpreadsheet size={28} />}
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 600 }}>
          {excelFile ? excelFile.name : 'Upload Excel / CSV'}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'var(--muted)',
          }}
        >
          {excelFile
            ? `${(excelFile.size / 1024).toFixed(1)} KB — Click to replace`
            : 'Drag & drop or click to select .xlsx, .xls, or .csv'}
        </p>
        {excelFile && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              marginTop: '12px',
              padding: '4px 12px',
              fontSize: '0.75rem',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setExcelFile(null);
              if (excelInputRef.current) excelInputRef.current.value = '';
            }}
          >
            <X size={12} /> Remove
          </button>
        )}
      </div>

      {/* ZIP Upload */}
      <div
        className="glass-panel"
        style={{
          padding: '32px',
          textAlign: 'center',
          border: zipFile
            ? '2px solid rgba(16,185,129,0.4)'
            : '2px dashed rgba(255,255,255,0.15)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => zipInputRef.current?.click()}
      >
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setZipFile(f);
          }}
        />
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: zipFile
              ? 'rgba(16,185,129,0.15)'
              : 'rgba(245,158,11,0.1)',
            border: zipFile
              ? '1px solid rgba(16,185,129,0.3)'
              : '1px solid rgba(245,158,11,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: zipFile ? '#10b981' : '#fbbf24',
          }}
        >
          {zipFile ? <CheckCircle size={28} /> : <Archive size={28} />}
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 600 }}>
          {zipFile ? zipFile.name : 'Upload Photos ZIP'}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'var(--muted)',
          }}
        >
          {zipFile
            ? `${(zipFile.size / 1024 / 1024).toFixed(1)} MB — Click to replace`
            : 'ZIP archive containing photos (.jpg, .png, .webp)'}
        </p>
        {zipFile && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              marginTop: '12px',
              padding: '4px 12px',
              fontSize: '0.75rem',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setZipFile(null);
              if (zipInputRef.current) zipInputRef.current.value = '';
            }}
          >
            <X size={12} /> Remove
          </button>
        )}
      </div>

      {/* Info Panel */}
      <div
        className="glass-panel"
        style={{
          gridColumn: 'span 2',
          padding: '16px 20px',
          background:
            'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(0,0,0,0.15))',
          border: '1px solid rgba(99,102,241,0.12)',
        }}
      >
        <h4
          style={{
            margin: '0 0 8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#a5b4fc',
          }}
        >
          How Image Mapping Works
        </h4>
        <ul
          style={{
            margin: 0,
            padding: '0 0 0 18px',
            fontSize: '0.78rem',
            color: 'var(--muted)',
            lineHeight: 1.8,
          }}
        >
          <li>
            Excel should have a column matching the template&apos;s image field
            name (e.g., &quot;photo&quot;)
          </li>
          <li>
            That column should contain the image filename{' '}
            <strong>without extension</strong> (e.g., &quot;john_doe&quot;)
          </li>
          <li>
            The ZIP should contain images with matching names (e.g.,
            &quot;john_doe.jpg&quot;)
          </li>
          <li>
            The system auto-matches by comparing values case-insensitively
          </li>
          <li>
            If no image column is found, it will try matching by the name column
          </li>
        </ul>
      </div>

      {/* Analyze Button */}
      <div
        style={{
          gridColumn: 'span 2',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          style={{
            padding: '12px 28px',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
          }}
          disabled={!excelFile || analyzing}
          onClick={handleAnalyze}
        >
          {analyzing ? (
            <>
              <span
                className="spinner"
                style={{ width: '14px', height: '14px', borderWidth: '1.5px' }}
              />
              Analyzing...
            </>
          ) : (
            <>
              <Zap size={16} /> Analyze & Map
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ─── Step 2: Review & Edit ────────────────────────────────
  const renderStep2 = () => (
    <div style={{ display: 'flex', gap: '24px' }}>
      {/* Main Table */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Summary Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          {[
            {
              label: 'Total Records',
              value: totalCount,
              color: '#818cf8',
              bg: 'rgba(99,102,241,0.1)',
            },
            {
              label: 'Photos Matched',
              value: matchedCount,
              color: '#34d399',
              bg: 'rgba(16,185,129,0.1)',
            },
            {
              label: 'Missing Photos',
              value: missingCount,
              color: missingCount > 0 ? '#fbbf24' : '#34d399',
              bg:
                missingCount > 0
                  ? 'rgba(245,158,11,0.1)'
                  : 'rgba(16,185,129,0.1)',
            },
            {
              label: 'Selected',
              value: selectedCount,
              color: '#60a5fa',
              bg: 'rgba(96,165,250,0.1)',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="glass-panel"
              style={{
                padding: '14px 16px',
                borderLeft: `3px solid ${stat.color}`,
              }}
            >
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: stat.color,
                  marginTop: '2px',
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Search + Bulk Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <Search size={16} color="var(--muted)" />
            <input
              type="text"
              placeholder="Search by name, designation..."
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: '#fff',
                fontSize: '0.82rem',
                outline: 'none',
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.75rem' }}
            onClick={() =>
              setSelectedIndexes(mappedCardholders.map((_, i) => i))
            }
          >
            Select All
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.75rem' }}
            onClick={() => setSelectedIndexes([])}
          >
            Clear
          </button>
        </div>

        {/* Table */}
        <div
          className="table-container"
          style={{
            maxHeight: '500px',
            overflowY: 'auto',
            borderRadius: '10px',
          }}
        >
          <table className="custom-table" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedIndexes.length === mappedCardholders.length
                    }
                    onChange={(e) =>
                      setSelectedIndexes(
                        e.target.checked
                          ? mappedCardholders.map((_, i) => i)
                          : []
                      )
                    }
                    style={{ accentColor: 'var(--primary)' }}
                  />
                </th>
                <th style={{ width: '50px' }}>Photo</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Image Key</th>
                <th>Status</th>
                <th style={{ width: '70px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCardholders.map((ch) => {
                const isSelected = selectedIndexes.includes(ch.originalIndex);
                const photoData = ch.hasPhoto
                  ? photosMap.get(ch.sanitizedKey)
                  : null;

                return (
                  <tr
                    key={ch.originalIndex}
                    style={{
                      opacity: isSelected ? 1 : 0.5,
                      background: isSelected
                        ? undefined
                        : 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIndexes((prev) =>
                            prev.includes(ch.originalIndex)
                              ? prev.filter((i) => i !== ch.originalIndex)
                              : [...prev, ch.originalIndex]
                          );
                        }}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                    </td>
                    <td>
                      {photoData?.dataUri ? (
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <img
                            src={photoData.dataUri}
                            alt={ch.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '6px',
                            background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fbbf24',
                          }}
                        >
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{ch.name || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>
                      {ch.designation || '—'}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#a5b4fc' }}>
                      {ch.imageColumnValue || '—'}
                    </td>
                    <td>
                      {ch.hasPhoto ? (
                        <span className="badge badge-success">
                          <CheckCircle
                            size={10}
                            style={{ marginRight: '4px' }}
                          />
                          Matched
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <AlertTriangle
                            size={10}
                            style={{ marginRight: '4px' }}
                          />
                          Missing
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                        }}
                        onClick={() => {
                          setEditingCardholder(
                            mappedCardholders[ch.originalIndex]
                          );
                          setEditingIndex(ch.originalIndex);
                          setIsEditingDetail(false);
                        }}
                      >
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Save Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '20px',
            gap: '12px',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '10px 20px',
              fontSize: '0.85rem',
            }}
            onClick={() => setWizardStep(1)}
          >
            <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Back to
            Upload
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              padding: '10px 28px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
            }}
            disabled={saving || selectedCount === 0}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <span
                  className="spinner"
                  style={{
                    width: '14px',
                    height: '14px',
                    borderWidth: '1.5px',
                  }}
                />
                Saving {selectedCount} cardholders...
              </>
            ) : (
              <>
                <Save size={14} /> Save {selectedCount} Cardholders to Order
              </>
            )}
          </button>
        </div>
      </div>

      {/* Detail Drawer */}
      {editingCardholder && (
        <div
          className="glass-panel"
          style={{
            width: '340px',
            flexShrink: 0,
            padding: '20px',
            alignSelf: 'flex-start',
            position: 'sticky',
            top: '20px',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
              Cardholder Details
            </h4>
            <button
              type="button"
              onClick={() => {
                setEditingCardholder(null);
                setEditingIndex(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Photo Preview */}
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            {editingCardholder.hasPhoto &&
            photosMap.get(editingCardholder.sanitizedKey)?.dataUri ? (
              <img
                src={
                  photosMap.get(editingCardholder.sanitizedKey)?.dataUri || ''
                }
                alt={editingCardholder.name}
                style={{
                  width: '120px',
                  height: '150px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  border: '2px solid rgba(16,185,129,0.3)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '120px',
                  height: '150px',
                  borderRadius: '10px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '2px dashed rgba(245,158,11,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  color: '#fbbf24',
                  gap: '6px',
                }}
              >
                <ImageIcon size={28} />
                <span style={{ fontSize: '0.7rem' }}>No Photo</span>
              </div>
            )}
          </div>

          {/* Toggle Edit */}
          {!isEditingDetail ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '0.78rem',
                marginBottom: '16px',
              }}
              onClick={() => setIsEditingDetail(true)}
            >
              <Edit3 size={12} style={{ marginRight: '6px' }} /> Edit Fields
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '0.78rem',
                }}
                onClick={handleSaveCardholderEdit}
              >
                <Check size={12} style={{ marginRight: '4px' }} /> Save
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '0.78rem',
                }}
                onClick={() => {
                  // Revert to original
                  if (editingIndex !== null) {
                    setEditingCardholder(mappedCardholders[editingIndex]);
                  }
                  setIsEditingDetail(false);
                }}
              >
                <X size={12} style={{ marginRight: '4px' }} /> Cancel
              </button>
            </div>
          )}

          {/* Fields */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Name */}
            <div>
              <label
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Name
              </label>
              {isEditingDetail ? (
                <input
                  className="form-input"
                  style={{
                    marginTop: '4px',
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    width: '100%',
                  }}
                  value={editingCardholder.name}
                  onChange={(e) =>
                    setEditingCardholder({
                      ...editingCardholder,
                      name: e.target.value,
                    })
                  }
                />
              ) : (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  {editingCardholder.name || '—'}
                </p>
              )}
            </div>

            {/* Designation */}
            <div>
              <label
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Designation
              </label>
              {isEditingDetail ? (
                <input
                  className="form-input"
                  style={{
                    marginTop: '4px',
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    width: '100%',
                  }}
                  value={editingCardholder.designation}
                  onChange={(e) =>
                    setEditingCardholder({
                      ...editingCardholder,
                      designation: e.target.value,
                    })
                  }
                />
              ) : (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.85rem',
                  }}
                >
                  {editingCardholder.designation || '—'}
                </p>
              )}
            </div>

            {/* Image Key */}
            <div>
              <label
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Image Key
              </label>
              {isEditingDetail ? (
                <input
                  className="form-input"
                  style={{
                    marginTop: '4px',
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    width: '100%',
                  }}
                  value={editingCardholder.imageColumnValue}
                  onChange={(e) =>
                    setEditingCardholder({
                      ...editingCardholder,
                      imageColumnValue: e.target.value,
                    })
                  }
                />
              ) : (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.85rem',
                    color: '#a5b4fc',
                  }}
                >
                  {editingCardholder.imageColumnValue || '—'}
                </p>
              )}
            </div>

            {/* Custom Fields */}
            {Object.entries(editingCardholder.customFields || {}).length >
              0 && (
              <>
                <div
                  style={{
                    height: '1px',
                    background: 'rgba(255,255,255,0.08)',
                    margin: '4px 0',
                  }}
                />
                <label
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  Custom Fields
                </label>
                {Object.entries(editingCardholder.customFields).map(
                  ([key, val]) => (
                    <div key={key}>
                      <label
                        style={{
                          fontSize: '0.68rem',
                          color: '#94a3b8',
                        }}
                      >
                        {key}
                      </label>
                      {isEditingDetail ? (
                        <input
                          className="form-input"
                          style={{
                            marginTop: '2px',
                            padding: '5px 8px',
                            fontSize: '0.78rem',
                            width: '100%',
                          }}
                          value={String(val || '')}
                          onChange={(e) =>
                            setEditingCardholder({
                              ...editingCardholder,
                              customFields: {
                                ...editingCardholder.customFields,
                                [key]: e.target.value,
                              },
                            })
                          }
                        />
                      ) : (
                        <p
                          style={{
                            margin: '2px 0 0',
                            fontSize: '0.8rem',
                          }}
                        >
                          {String(val || '—')}
                        </p>
                      )}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ─── Step 3: Compile PDFs ─────────────────────────────────
  const renderStep3 = () => (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div
        className="glass-panel"
        style={{
          padding: '40px',
          textAlign: 'center',
          border: '1px solid rgba(16,185,129,0.2)',
          background:
            'linear-gradient(135deg, rgba(16,185,129,0.04), rgba(0,0,0,0.15))',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #059669, #10b981)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 30px rgba(16,185,129,0.3)',
          }}
        >
          <CheckCircle size={36} color="#fff" />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 700 }}>
          Import Complete!
        </h2>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.9rem',
            color: 'var(--muted)',
          }}
        >
          Successfully imported{' '}
          <strong style={{ color: '#34d399' }}>{savedCount}</strong>{' '}
          cardholders to Order #{orderId}
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            style={{
              padding: '12px 24px',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
            }}
            onClick={() => {
              fetchData();
              proceedWithCompile('PRODUCTION');
            }}
          >
            <Zap size={16} /> Generate Production PDF
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '10px 24px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onClick={() => {
              fetchData();
              proceedWithCompile('APPROVAL');
            }}
          >
            <Eye size={14} /> Generate Approval PDF
          </button>
          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '8px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              onClick={() => {
                resetWizard();
              }}
            >
              <RotateCcw size={14} /> Import Another Batch
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              onClick={fetchData}
            >
              <Users size={14} /> View Cardholders
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {renderStepHeader()}
      {wizardStep === 1 && renderStep1()}
      {wizardStep === 2 && renderStep2()}
      {wizardStep === 3 && renderStep3()}
    </div>
  );
}
