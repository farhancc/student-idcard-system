import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { FileText, ImageIcon, CheckCircle, AlertTriangle, Eye, ArrowLeft, Check, X, Search } from 'lucide-react';
import CardPreview from '@/app/components/CardPreview';
import { formatFieldLabel } from '@/lib/pdf/card-renderer-client';
import { generateApprovalPdfClient } from '@/lib/pdf/approval-pdf-generator';
import { generateProductionPdfClient } from '@/lib/pdf/production-pdf-generator';

export function BatchDispatchModal({ 
  batchProps, 
  templates, 
  clients, 
  clientId, 
  setClientId, 
  templateId, 
  setTemplateId, 
  setShowForm, 
  setOrderMethod, 
  isOwner, 
  pricePerCard, 
  setPricePerCard, 
  taxPercent, 
  setTaxPercent,
  handleAnalyzeBatchFiles,
  handleGenerateApprovalProof,
  handleGenerateProductionPdf,
  validTill
}: any) {
  const {
    batchWizardStep, setBatchWizardStep,
    rosterSearch, setRosterSearch,
    acceptMissingFields, setAcceptMissingFields,
    showPreviewStep, setShowPreviewStep,
    parsedCardholders, setParsedCardholders,
    selectedPreviewIndexes, setSelectedPreviewIndexes,
    photosMap, setPhotosMap,
    selectedCardholderForDetails, setSelectedCardholderForDetails,
    selectedCardholderIndexForDetails, setSelectedCardholderIndexForDetails,
    isEditingDetail, setIsEditingDetail,
    detailsPreviewSide, setDetailsPreviewSide,
    loadedPressFonts, setLoadedPressFonts,
    paperSize, setPaperSize,
    orientation, setOrientation,
    bleedMm, setBleedMm,
    cropMarks, setCropMarks,
    foldLine, setFoldLine,
    customSheetWidthMm, setCustomSheetWidthMm,
    customSheetHeightMm, setCustomSheetHeightMm,
    prePrintValidationResult, setPrePrintValidationResult,
    showValidationModal, setShowValidationModal,
    showEmptySlotModal, setShowEmptySlotModal,
    emptySlotStrategy, setEmptySlotStrategy,
    pendingGenerationType, setPendingGenerationType,
    handleSaveCardholderEdit,
    getSheetDimensions,
    runPrePrintValidation,
    error,
    excelFile, setExcelFile,
    zipFile, setZipFile,
    uploadStatus, setUploadStatus,
    uploadProgress,
    submitting
  } = batchProps;

const renderBatchWizard = () => {
    const steps = [
      { number: 1, name: 'Upload Data', desc: 'Spreadsheet & Photos ZIP' },
      { number: 2, name: 'Roster Preview', desc: 'Verify & Filter Students' },
      { number: 3, name: 'Print Layout', desc: 'Sheet Config & PDF Output' }
    ];

    const totalCount = parsedCardholders.length;
    const matchedCount = parsedCardholders.filter((c: any) => c.hasPhoto).length;
    const missingCount = totalCount - matchedCount;

    const filteredCardholders = parsedCardholders
      .map((c: any, idx: number) => ({ ...c, originalIndex: idx }))
      .filter((c: any) => {
        if (!rosterSearch.trim()) return true;
        const q = rosterSearch.toLowerCase();
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.uniqueKey || '').toLowerCase().includes(q) ||
          (c.designation || '').toLowerCase().includes(q)
        );
      });

    const selectedTemplate = templates.find((t: any) => String(t.id) === templateId);
    const selectedCards = parsedCardholders.filter((_: any, idx: number) => selectedPreviewIndexes.includes(idx));
    const validationResult = (selectedTemplate && selectedCards.length > 0)
      ? runPrePrintValidation(selectedCards, selectedTemplate)
      : null;

    const totalSlots = validationResult ? validationResult.totalSlots : 0;
    const emptySlots = validationResult ? Math.max(0, totalSlots - selectedCards.length) : 0;
    const hasMissingFields = validationResult ? validationResult.missingFields.length > 0 : false;

    const renderStepHeader = () => (
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', width: '100%', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
            onClick={() => {
              if (batchWizardStep === 1) {
                setShowForm(false);
              } else {
                setBatchWizardStep((prev: number) => (prev - 1) as any);
              }
            }}
          >
            <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Batch Import & Print Wizard</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              Step {batchWizardStep} of 3: {steps[batchWizardStep - 1].name} — {steps[batchWizardStep - 1].desc}
            </p>
          </div>
        </div>

        {/* Stepper Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {steps.map((st, i) => {
            const stepNum = i + 1;
            const isActive = batchWizardStep === stepNum;
            const isCompleted = batchWizardStep > stepNum;
            return (
              <React.Fragment key={stepNum}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isActive ? 1 : isCompleted ? 0.8 : 0.4 }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: isActive ? '#6366f1' : isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: isActive ? 'none' : isCompleted ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: 'bold', color: isActive ? '#ffffff' : isCompleted ? '#10b981' : '#fff'
                  }}>
                    {isCompleted ? <Check size={14} /> : stepNum}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 400 }}>{st.name}</div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: '40px', height: '1px', background: batchWizardStep > stepNum ? '#10b981' : 'rgba(255,255,255,0.1)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );

    const renderStep1 = () => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
        {/* Left Column: Settings */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>1. Registry & Invoicing Details</h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.72rem', flex: 1 }}
              onClick={() => setOrderMethod('standard')}
            >
              Standard Form
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              style={{ padding: '4px 8px', fontSize: '0.72rem', flex: 1 }}
              onClick={() => setOrderMethod('batch')}
            >
              Batch Wizard
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Client Registry Folder</label>
            <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Card Template</label>
            <select className="form-select" value={templateId} onChange={e => setTemplateId(e.target.value)}>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
            </select>
          </div>

          {isOwner && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Price Per Card (Rs)</label>
                <input type="number" required className="form-input" value={pricePerCard} onChange={e => setPricePerCard(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">GST / Tax (%)</label>
                <input type="number" required className="form-input" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} />
              </div>
            </div>
          )}


          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
              Setting correct pricing and templates is crucial for invoice generation and layout constraints.
            </p>
          </div>
        </div>

        {/* Right Column: Files Upload */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>2. Import Student Registry & Photos</h3>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} /> Excel / CSV Student Database
              </label>
              <input type="file" required accept=".xlsx,.xls,.csv" className="form-input" onChange={e => setExcelFile(e.target.files?.[0] || null)} />
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
                Spreadsheet must contain student details. Key fields (Name, Designation, ID) will be fuzzy-matched automatically.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} /> Photos ZIP Archive
              </label>
              <input type="file" required accept=".zip" className="form-input" onChange={e => setZipFile(e.target.files?.[0] || null)} />
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
                ZIP file containing photos named after the student unique ID or name (e.g. <code>101.jpg</code> or <code>john_doe.png</code>).
              </p>
            </div>
          </div>

          {uploadStatus && (
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px', color: 'var(--primary)' }}>
                <span>{uploadStatus}</span>
                {uploadProgress.total > 0 && <span>{uploadProgress.current} / {uploadProgress.total}</span>}
              </div>
              {uploadProgress.total > 0 && (
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, transition: 'width 0.2s' }} />
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setShowForm(false);
                setExcelFile(null);
                setZipFile(null);
                setUploadStatus('');
              }}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={submitting || !excelFile || !zipFile} 
              onClick={handleAnalyzeBatchFiles}
            >
              {submitting ? 'Analyzing & Matching...' : 'Analyze & Match Files'}
            </button>
          </div>
        </div>
      </div>
    );

    const renderStep2 = () => (
      <div style={{ display: 'flex', gap: '20px', width: '100%', alignItems: 'stretch' }}>
        {/* Left Side: Table & Search */}
        <div className="glass-panel" style={{ 
          flex: selectedCardholderForDetails ? '0 0 60%' : '1 1 100%', 
          transition: 'all 0.3s ease-in-out',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'hidden'
        }}>
          {/* Search bar & statistics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search by student name, ID, designation..." 
                style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
              <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                Total: <strong>{totalCount}</strong>
              </span>
              <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px' }}>
                Photos Matched: <strong>{matchedCount}</strong>
              </span>
              {missingCount > 0 && (
                <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '4px' }}>
                  Missing: <strong>{missingCount}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Selection indicator & global toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              Selected: <strong>{selectedPreviewIndexes.length}</strong> / {totalCount} cardholder(s)
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '0.72rem', background: 'transparent', border: 'none' }}
                onClick={() => setSelectedPreviewIndexes(parsedCardholders.map((_: any, i: number) => i))}
              >
                Select All
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '0.72rem', background: 'transparent', border: 'none' }}
                onClick={() => setSelectedPreviewIndexes([])}
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Roster Scrollable Table */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '55vh', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }} className="custom-table">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ width: '40px', padding: '10px 12px' }}>
                    <input 
                      type="checkbox"
                      checked={selectedPreviewIndexes.length === parsedCardholders.length && parsedCardholders.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPreviewIndexes(parsedCardholders.map((_: any, i: number) => i));
                        } else {
                          setSelectedPreviewIndexes([]);
                        }
                      }}
                    />
                  </th>
                  <th style={{ padding: '10px 12px', width: '60px' }}>Photo</th>
                  <th style={{ padding: '10px 12px' }}>Name</th>
                  <th style={{ padding: '10px 12px' }}>ID / Roll No</th>
                  <th style={{ padding: '10px 12px' }}>Designation</th>
                  <th style={{ padding: '10px 12px', width: '130px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: '100px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCardholders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  filteredCardholders.map((c: any) => {
                    const isSelected = selectedPreviewIndexes.includes(c.originalIndex);
                    const photoData = photosMap.get(c.sanitizedKey);
                    return (
                      <tr 
                        key={c.originalIndex}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: isSelected ? 'rgba(255,255,255,0.01)' : 'transparent',
                          opacity: isSelected ? 1 : 0.55,
                          transition: 'opacity 0.2s'
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPreviewIndexes((prev: number[]) => [...prev, c.originalIndex]);
                              } else {
                                setSelectedPreviewIndexes((prev: number[]) => prev.filter((idx: number) => idx !== c.originalIndex));
                              }
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {c.hasPhoto && photoData ? (
                            <img 
                              src={photoData.url} 
                              alt={c.name} 
                              style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', border: '1px dashed rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b' }}>
                              <ImageIcon size={14} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{c.uniqueKey || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>{c.designation || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {c.hasPhoto ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>
                              <CheckCircle size={10} /> Photo Matched
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>
                              <AlertTriangle size={10} /> Missing Photo
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}
                            onClick={() => {
                              setSelectedCardholderForDetails(c);
                              setSelectedCardholderIndexForDetails(c.originalIndex);
                              setIsEditingDetail(false);
                              setDetailsPreviewSide('front');
                            }}
                          >
                            <Eye size={12} style={{ marginRight: '4px' }} /> Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifySelf: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setBatchWizardStep(1);
                setSelectedCardholderForDetails(null);
                setSelectedCardholderIndexForDetails(null);
              }}
            >
              Back to Upload
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={selectedPreviewIndexes.length === 0}
              onClick={() => {
                setBatchWizardStep(3);
                setAcceptMissingFields(false);
                setSelectedCardholderForDetails(null);
                setSelectedCardholderIndexForDetails(null);
              }}
            >
              Next: Configure Layout
            </button>
          </div>
        </div>

        {/* Right Side: Edit Details Side Panel Drawer */}
        {selectedCardholderForDetails && (
          <div className="glass-panel" style={{ 
            flex: '0 0 40%', 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            borderLeft: '1px solid var(--glass-border)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.3)',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--primary)' }}>
                {isEditingDetail ? 'Edit Student Details' : 'Student Audit & Preview'}
              </h3>
              <button 
                type="button" 
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                onClick={() => {
                  setSelectedCardholderForDetails(null);
                  setSelectedCardholderIndexForDetails(null);
                  setIsEditingDetail(false);
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Card Preview Renderer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ 
                height: '320px', 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px'
              }}>
                {(() => {
                  if (!selectedTemplate) return <div style={{ color: 'var(--muted)' }}>No template selected</div>;
                  const photoData = photosMap.get(selectedCardholderForDetails.sanitizedKey);
                  const previewCh = {
                    id: selectedCardholderForDetails.id,
                    name: selectedCardholderForDetails.name,
                    designation: selectedCardholderForDetails.designation,
                    photoUrl: selectedCardholderForDetails.hasPhoto && photoData ? photoData.url : null,
                    uniqueKey: selectedCardholderForDetails.uniqueKey || null,
                    cardSerial: selectedCardholderForDetails.cardSerial || null,
                    customFields: JSON.stringify(selectedCardholderForDetails.customFields || {})
                  };
                  return (
                    <CardPreview 
                      template={selectedTemplate}
                      cardholder={previewCh}
                      side={detailsPreviewSide}
                      pressFonts={loadedPressFonts}
                      validTill={validTill}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className={`btn ${detailsPreviewSide === 'front' ? 'btn-primary' : 'btn-secondary'}`} 
                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDetailsPreviewSide('front')}
                >
                  Front
                </button>
                {selectedTemplate?.backImageUrl && (
                  <button 
                    type="button" 
                    className={`btn ${detailsPreviewSide === 'back' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => setDetailsPreviewSide('back')}
                  >
                    Back
                  </button>
                )}
              </div>
            </div>

            {/* Field Inputs / Values */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Full Name</label>
                {isEditingDetail ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ height: '32px', fontSize: '0.8rem' }}
                    value={selectedCardholderForDetails.name || ''} 
                    onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, name: e.target.value }))}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    {selectedCardholderForDetails.name || '—'}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>ID / Roll Number</label>
                {isEditingDetail ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ height: '32px', fontSize: '0.8rem' }}
                    value={selectedCardholderForDetails.uniqueKey || ''} 
                    onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, uniqueKey: e.target.value }))}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    {selectedCardholderForDetails.uniqueKey || '—'}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Designation</label>
                {isEditingDetail ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ height: '32px', fontSize: '0.8rem' }}
                    value={selectedCardholderForDetails.designation || ''} 
                    onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, designation: e.target.value }))}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    {selectedCardholderForDetails.designation || '—'}
                  </div>
                )}
              </div>

              {/* Dynamic Excel Custom Fields */}
              {Object.entries(selectedCardholderForDetails.customFields || {}).map(([k, val]) => (
                <div className="form-group" key={k}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{formatFieldLabel(k)}</label>
                  {isEditingDetail ? (
                    typeof val === 'string' && val.startsWith('blob:') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={val} alt={k} style={{ height: '32px', borderRadius: '4px' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Image Asset</span>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ height: '32px', fontSize: '0.8rem' }}
                        value={String(val || '')} 
                        onChange={e => {
                          const newVal = e.target.value;
                          setSelectedCardholderForDetails((prev: any) => ({
                            ...prev,
                            customFields: { ...prev.customFields, [k]: newVal }
                          }));
                        }}
                      />
                    )
                  ) : (
                    <div style={{ fontSize: '0.85rem', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', minHeight: '30px' }}>
                      {typeof val === 'string' && val.startsWith('blob:') ? (
                        <img src={val} alt={k} style={{ height: '32px', borderRadius: '4px' }} />
                      ) : (
                        String(val || '') || <em style={{ color: 'var(--muted)' }}>empty</em>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sidebar actions */}
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: 'auto' }}>
              {isEditingDetail ? (
                <>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (selectedCardholderIndexForDetails !== null) {
                        setSelectedCardholderForDetails(parsedCardholders[selectedCardholderIndexForDetails]);
                      }
                      setIsEditingDetail(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={handleSaveCardholderEdit}
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}
                    onClick={() => setIsEditingDetail(true)}
                  >
                    Edit Fields
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      setSelectedCardholderForDetails(null);
                      setSelectedCardholderIndexForDetails(null);
                    }}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );

    const renderStep3 = () => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
        {/* Left Column: Layout Configuration */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>1. Sheet Layout & Crop Marks</h3>
          
          <div className="form-group">
            <label className="form-label">Paper Sheet Size</label>
            <select className="form-select" value={paperSize} onChange={e => setPaperSize(e.target.value as any)}>
              <option value="SRA3">SRA3 — 320×450mm ★ Recommended</option>
              <option value="13x19">13×19 inch — 330×483mm</option>
              <option value="A3">A3 — 297×420mm</option>
              <option value="A4">A4 (Standard Office)</option>
              <option value="CUSTOM">Custom Dimensions (mm)</option>
            </select>
          </div>

          {paperSize === 'CUSTOM' && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="number" min="100" max="700"
                className="form-input" style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                placeholder="W (mm)" value={customSheetWidthMm}
                onChange={e => setCustomSheetWidthMm(e.target.value)}
              />
              <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>×</span>
              <input
                type="number" min="100" max="1000"
                className="form-input" style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                placeholder="H (mm)" value={customSheetHeightMm}
                onChange={e => setCustomSheetHeightMm(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Sheet Orientation</label>
            <select className="form-select" value={orientation} onChange={e => setOrientation(e.target.value as any)}>
              <option value="PORTRAIT">Portrait (Vertical)</option>
              <option value="LANDSCAPE">Landscape (Horizontal)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Card Bleed Margin (mm)</label>
            <input type="number" step="0.5" className="form-input" value={bleedMm} onChange={e => setBleedMm(e.target.value)} />
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '4px' }}>
              Extra printed boundary around card edges to ensure clean cuts without white borders (typically 2-3mm).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={cropMarks} onChange={e => setCropMarks(e.target.checked)} />
              <span>Include Print Crop Marks (Cutting Guides)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={foldLine} onChange={e => setFoldLine(e.target.checked)} />
              <span>Include Sheet Center Fold/Creasing Line</span>
            </label>
          </div>
        </div>

        {/* Right Column: Calculations & Validation Check & PDF Generation */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>2. Audit Summary & Compile Output</h3>

          {/* Calculations widget */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>Sheet Capacity Analysis</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
              <div>Selected Cards: <strong>{selectedCards.length}</strong></div>
              <div>Sheet Capacity: <strong>{totalSlots} slots</strong></div>
              <div>Empty Slots: <strong style={{ color: emptySlots > 0 ? 'var(--primary)' : 'inherit' }}>{emptySlots} slots</strong></div>
              <div>Orientation: <strong>{orientation}</strong></div>
            </div>

            {/* Empty Slot strategy choice */}
            {emptySlots > 0 && (
              <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>Empty Slot Fill Strategy</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input 
                      type="radio" 
                      name="strategy" 
                      value="leave_blank" 
                      checked={emptySlotStrategy === 'leave_blank'} 
                      onChange={() => setEmptySlotStrategy('leave_blank')} 
                    />
                    <span>Leave Blank (Print nothing in empty slots)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input 
                      type="radio" 
                      name="strategy" 
                      value="repeat_last" 
                      checked={emptySlotStrategy === 'repeat_last'} 
                      onChange={() => setEmptySlotStrategy('repeat_last')} 
                    />
                    <span>Repeat Last Cardholder ({selectedCards[selectedCards.length - 1]?.name || 'Last Record'})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input 
                      type="radio" 
                      name="strategy" 
                      value="repeat_first" 
                      checked={emptySlotStrategy === 'repeat_first'} 
                      onChange={() => setEmptySlotStrategy('repeat_first')} 
                    />
                    <span>Repeat First Cardholder ({selectedCards[0]?.name || 'First Record'})</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Validation warnings widget */}
          {hasMissingFields && validationResult && (
            <div style={{ background: 'rgba(245,158,11,0.08)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                <AlertTriangle size={16} />
                <span>Missing Required Fields Detected</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
                <strong>{validationResult.missingFields.length} cardholder(s)</strong> have incomplete required template fields. Review list below:
              </p>
              <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
                      <th style={{ padding: '4px 8px' }}>Cardholder</th>
                      <th style={{ padding: '4px 8px' }}>Missing Fields</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.missingFields.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '4px 8px', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '4px 8px', color: '#ff8a8a' }}>
                          {row.fields.map(formatFieldLabel).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: '#fff', marginTop: '4px' }}>
                <input type="checkbox" checked={acceptMissingFields} onChange={e => setAcceptMissingFields(e.target.checked)} />
                <span style={{ fontWeight: 500 }}>Confirm: print with empty fields anyway</span>
              </label>
            </div>
          )}

          {/* In-Wizard Progress / Status Indicator */}
          {uploadStatus && (
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px', color: 'var(--primary)' }}>
                <span>{uploadStatus}</span>
                {uploadProgress.total > 0 && <span>{uploadProgress.current} / {uploadProgress.total}</span>}
              </div>
              {uploadProgress.total > 0 && (
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, transition: 'width 0.2s' }} />
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Compilation buttons */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setBatchWizardStep(2)}
            >
              Back to Roster
            </button>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(99,102,241,0.05)' }}
              disabled={submitting || selectedPreviewIndexes.length === 0}
              onClick={handleGenerateApprovalProof}
            >
              Download Proof
            </button>

            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={submitting || selectedPreviewIndexes.length === 0 || (hasMissingFields && !acceptMissingFields)}
              onClick={() => handleGenerateProductionPdf(true, emptySlotStrategy)}
            >
              {submitting ? 'Generating PDF...' : 'Download Production PDF'}
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <div style={{ width: '100%', minHeight: '80vh', padding: '10px 0', display: 'flex', flexDirection: 'column' }}>
        {renderStepHeader()}
        <div style={{ flex: 1 }}>
          {batchWizardStep === 1 && renderStep1()}
          {batchWizardStep === 2 && renderStep2()}
          {batchWizardStep === 3 && renderStep3()}
        </div>
      </div>
    );
  };



  return renderBatchWizard();
}
