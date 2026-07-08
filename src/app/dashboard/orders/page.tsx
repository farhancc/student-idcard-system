'use client';

import React, { useEffect, useState } from 'react';
import { Plus, FileText, Calendar, DollarSign, FolderOpen, RefreshCcw, Image as ImageIcon, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { generateApprovalPdfClient } from '@/lib/pdf/approval-pdf-generator';
import { generateProductionPdfClient } from '@/lib/pdf/production-pdf-generator';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form toggling
  const [showForm, setShowForm] = useState(false);
  const [orderMethod, setOrderMethod] = useState<'standard' | 'batch'>('standard');
  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [pricePerCard, setPricePerCard] = useState('50'); // default Rs. 50
  const [taxPercent, setTaxPercent] = useState('18'); // default 18% GST
  const [validTill, setValidTill] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Client-side batch upload progress state
  const [pressId, setPressId] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Pre-upload preview state
  const [showPreviewStep, setShowPreviewStep] = useState(false);
  const [parsedCardholders, setParsedCardholders] = useState<any[]>([]);
  const [selectedPreviewIndexes, setSelectedPreviewIndexes] = useState<number[]>([]);
  const [photosMap, setPhotosMap] = useState<Map<string, { blob: Blob; url: string }>>(new Map());

  // Layout options for client-side batch processing
  const [paperSize, setPaperSize] = useState<'A3' | 'A4'>('A3');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [bleedMm, setBleedMm] = useState<string>('3'); // default 3mm
  const [cropMarks, setCropMarks] = useState<boolean>(true);
  const [foldLine, setFoldLine] = useState<boolean>(true);

  const fetchData = async () => {
    try {
      const ordersRes = await fetch('/api/orders');
      if (ordersRes.ok) {
        const json = await ordersRes.json();
        setOrders(json.orders || []);
      }

      const clientsRes = await fetch('/api/clients');
      if (clientsRes.ok) {
        const json = await clientsRes.json();
        setClients(json.clients || []);
        if (json.clients?.length > 0) setClientId(String(json.clients[0].id));
      }

      const templatesRes = await fetch('/api/templates');
      if (templatesRes.ok) {
        const json = await templatesRes.json();
        const allTemplates = [
          ...(json.templates || []),
          ...(json.globalTemplates || []).map((t: any) => ({ ...t, name: `⭐ ${t.name} (Starter)` }))
        ];
        setTemplates(allTemplates);
        if (allTemplates.length > 0) setTemplateId(String(allTemplates[0].id));
      }

      // Fetch profile to get pressId
      const profileRes = await fetch('/api/press/profile');
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        if (profileJson.success && profileJson.press) {
          setPressId(profileJson.press.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!clientId || !templateId) throw new Error('Client and Template must be selected');

      // Fetch cardholders for the client first
      const chRes = await fetch(`/api/clients/${clientId}/cardholders`);
      if (!chRes.ok) throw new Error('Failed to fetch cardholders for the selected client');
      const chData = await chRes.json();
      const cardholderIds = (chData.cardholders || []).map((ch: any) => ch.id);

      if (cardholderIds.length === 0) {
        throw new Error('Selected client registry has no cardholders. Please register cardholders for this client first.');
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientId),
          templateId: Number(templateId),
          cardholderIds,
          pricePerCard: Number(pricePerCard) || 0,
          taxPercent: Number(taxPercent) || 0,
          validTill: validTill ? new Date(validTill) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create order');

      setShowForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyzeBatchFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploadStatus('Reading spreadsheet file...');
    setSubmitting(true);

    try {
      if (!clientId || !templateId) throw new Error('Client and Template must be selected');
      if (!excelFile) throw new Error('Excel student list file is required');
      if (!zipFile) throw new Error('ZIP photos file is required');
      if (!pressId) throw new Error('Press session could not be resolved. Please try refreshing page.');

      // 1. Read and parse Excel / CSV
      let rawData: any[] = [];
      const excelName = excelFile.name.toLowerCase();

      if (excelName.endsWith('.csv')) {
        const csvText = await excelFile.text();
        const Papa = (await import('papaparse')).default;
        const parseResult = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        rawData = parseResult.data;
      } else if (excelName.endsWith('.xlsx') || excelName.endsWith('.xls')) {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const excelBuffer = await excelFile.arrayBuffer();
        await workbook.xlsx.load(excelBuffer as any);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
          throw new Error('XLSX file contains no sheets.');
        }
        const headerRow = sheet.getRow(1).values as (any)[];
        const headers = headerRow.slice(1).map((h: any) => h?.text ?? h ?? '');
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowObj: Record<string, any> = {};
          const values = (row.values as any[]).slice(1);
          values.forEach((cell, idx) => {
            const key = headers[idx];
            if (key) rowObj[key] = cell?.text ?? cell ?? '';
          });
          rawData.push(rowObj);
        });
      } else {
        throw new Error('Unsupported spreadsheet format. Please upload CSV or XLSX.');
      }

      if (rawData.length === 0) {
        throw new Error('No data rows found in the spreadsheet.');
      }

      // Auto-detect columns
      const getHeaderKey = (headers: string[], possibleNames: string[]): string | null => {
        for (const h of headers) {
          if (possibleNames.some(p => h.toLowerCase().trim() === p.toLowerCase())) {
            return h;
          }
        }
        return null;
      };

      const firstRowHeaders = Object.keys(rawData[0]);
      const nameCol = getHeaderKey(firstRowHeaders, ['name', 'full name', 'student name', 'employee name', 'cardholder name', 'studentname']) || 'name';
      const designationCol = getHeaderKey(firstRowHeaders, ['designation', 'role', 'class', 'grade', 'job title', 'course']) || 'designation';
      const uniqueKeyCol = getHeaderKey(firstRowHeaders, ['id', 'empid', 'rollnumber', 'roll no', 'rollno', 'employee id', 'unique key', 'admission number', 'admissionno', 'student id', 'studentid']) || 'uniqueKey';
      const imageIdCol = getHeaderKey(firstRowHeaders, ['image id', 'imageid', 'photo id', 'photoid', 'photo identifier', 'photoidentifier', 'filename', 'file name', 'image name', 'imagename']);
      const photoUrlCol = getHeaderKey(firstRowHeaders, ['photo', 'photourl', 'image', 'picture']) || 'photoUrl';

      // 2. Extract photos from ZIP
      setUploadStatus('Extracting photos from ZIP...');
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(zipFile);
      
      // Revoke any existing object URLs to avoid memory leaks
      photosMap.forEach((val) => {
        if (val.url) URL.revokeObjectURL(val.url);
      });
      const newPhotosMap = new Map<string, { blob: Blob; url: string }>();
      const filePromises: Promise<void>[] = [];

      zip.forEach((relativePath, file) => {
        if (file.dir) return;
        const ext = relativePath.substring(relativePath.lastIndexOf('.')).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const baseName = relativePath.split('/').pop()?.replace(ext, '').trim() || '';
          const promise = file.async('blob').then(blob => {
            const sanitizedKey = baseName.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
            const url = URL.createObjectURL(blob);
            newPhotosMap.set(sanitizedKey, { blob, url });
          });
          filePromises.push(promise);
        }
      });
      await Promise.all(filePromises);
      setPhotosMap(newPhotosMap);

      // Parse and construct raw JSON cardholder objects
      const parsed = rawData.map((row, index) => {
        const name = String(row[nameCol] || '').trim();
        const designation = row[designationCol] ? String(row[designationCol]).trim() : null;
        const uniqueKey = row[uniqueKeyCol] ? String(row[uniqueKeyCol]).trim() : null;
        const imageId = imageIdCol ? String(row[imageIdCol] || '').trim() : null;
        const photoUrl = row[photoUrlCol] ? String(row[photoUrlCol]).trim() : null;

        const custom: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          if (key !== nameCol && key !== designationCol && key !== uniqueKeyCol && key !== photoUrlCol && (!imageIdCol || key !== imageIdCol)) {
            custom[key] = row[key];
          }
        });

        // Try matching a photo from the zip using imageId (priority), uniqueKey, or name
        const matchKey = imageId || uniqueKey || name;
        const sanitizedKey = matchKey.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
        const hasPhoto = newPhotosMap.has(sanitizedKey);

        return {
          id: index,
          name,
          designation,
          uniqueKey,
          photoUrl,
          customFields: custom,
          hasPhoto,
          sanitizedKey,
          imageId
        };
      }).filter(c => c.name);

      setParsedCardholders(parsed);
      setSelectedPreviewIndexes(parsed.map((_, i) => i));
      setShowPreviewStep(true);
    } catch (err: any) {
      setError(err.message || 'Error parsing files');
    } finally {
      setSubmitting(false);
      setUploadStatus('');
    }
  };

  const handleGenerateApprovalProof = async () => {
    setError('');
    setUploadStatus('Generating Approval Proof PDF...');
    setUploadProgress({ current: 0, total: selectedPreviewIndexes.length });
    setSubmitting(true);

    try {
      const selectedTemplate = templates.find(t => String(t.id) === templateId);
      if (!selectedTemplate) throw new Error('Template not found');

      const selectedClient = clients.find(c => String(c.id) === clientId);
      const clientName = selectedClient ? selectedClient.name : 'Client';
      const deptName = selectedTemplate.name;

      const selectedCards = parsedCardholders.filter((_, idx) => selectedPreviewIndexes.includes(idx));
      if (selectedCards.length === 0) {
        throw new Error('Please select at least one record to print.');
      }

      // Fetch fonts
      setUploadStatus('Loading fonts...');
      const fontsRes = await fetch('/api/fonts', {
        headers: { 'x-press-id': String(pressId || '') }
      });
      let pressFonts = [];
      if (fontsRes.ok) {
        const fontsJson = await fontsRes.json();
        pressFonts = fontsJson.fonts || [];
      }

      // Map to correct parameter format
      const cardholdersForPdf = selectedCards.map(c => {
        const matchedPhoto = photosMap.get(c.sanitizedKey);
        return {
          id: c.id,
          name: c.name,
          designation: c.designation || null,
          photoUrl: c.hasPhoto && matchedPhoto ? matchedPhoto.url : null,
          cardSerial: c.cardSerial || null,
          uniqueKey: c.uniqueKey || null,
          customFields: c.customFields ? JSON.stringify(c.customFields) : null,
        };
      });

      setUploadStatus('Assembling pages...');
      const pdfBlob = await generateApprovalPdfClient(
        clientName,
        deptName,
        selectedTemplate,
        cardholdersForPdf,
        pressFonts
      );

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Approval_Proof_${clientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setUploadStatus('Success!');
      setTimeout(() => setUploadStatus(''), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate approval proof');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateProductionPdf = async () => {
    setError('');
    setUploadStatus('Generating Production PDF...');
    setUploadProgress({ current: 0, total: selectedPreviewIndexes.length });
    setSubmitting(true);

    try {
      const selectedTemplate = templates.find(t => String(t.id) === templateId);
      if (!selectedTemplate) throw new Error('Template not found');

      const selectedCards = parsedCardholders.filter((_, idx) => selectedPreviewIndexes.includes(idx));
      if (selectedCards.length === 0) {
        throw new Error('Please select at least one record to print.');
      }

      // Fetch fonts
      setUploadStatus('Loading fonts...');
      const fontsRes = await fetch('/api/fonts', {
        headers: { 'x-press-id': String(pressId || '') }
      });
      let pressFonts = [];
      if (fontsRes.ok) {
        const fontsJson = await fontsRes.json();
        pressFonts = fontsJson.fonts || [];
      }

      // Map to correct parameter format
      const cardholdersForPdf = selectedCards.map(c => {
        const matchedPhoto = photosMap.get(c.sanitizedKey);
        return {
          id: c.id,
          name: c.name,
          designation: c.designation || null,
          photoUrl: c.hasPhoto && matchedPhoto ? matchedPhoto.url : null,
          cardSerial: c.cardSerial || null,
          uniqueKey: c.uniqueKey || null,
          customFields: c.customFields ? JSON.stringify(c.customFields) : null,
        };
      });

      setUploadStatus('Compiling print-ready sheets...');
      const bleedPt = Number(bleedMm) * 2.83464567; // mm to points
      const pdfBlob = await generateProductionPdfClient(
        selectedTemplate,
        cardholdersForPdf,
        {
          paperSize,
          orientation,
          bleed: bleedPt,
          cropMarks,
          foldLine,
        },
        pressFonts,
        (percent) => {
          setUploadProgress({ current: Math.round((percent / 100) * selectedPreviewIndexes.length), total: selectedPreviewIndexes.length });
        }
      );

      const selectedClient = clients.find(c => String(c.id) === clientId);
      const clientName = selectedClient ? selectedClient.name : 'Client';

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Production_Print_${clientName.replace(/\s+/g, '_')}_${paperSize}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setUploadStatus('Success!');
      setTimeout(() => setUploadStatus(''), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate production PDF');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="badge badge-primary">Draft</span>;
      case 'APPROVAL_PDF_SENT': return <span className="badge badge-warning">Approval Sent</span>;
      case 'APPROVED': return <span className="badge badge-success">Approved</span>;
      case 'PRINTING': return <span className="badge badge-warning">Printing</span>;
      case 'DELIVERED': return <span className="badge badge-success">Delivered</span>;
      default: return <span className="badge badge-primary">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Card Orders</h1>
          <p style={{ marginTop: '4px' }}>Draft client orders, manage status flow, and view billing invoices.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {showForm ? 'Hide Form' : 'Initialize Order'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '32px', maxWidth: '640px' }}>
          <h3 style={{ marginBottom: '16px' }}>Initialize Printing Order</h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
            <button 
              type="button" 
              className={`btn ${orderMethod === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setOrderMethod('standard')}
            >
              Standard (Existing Registry)
            </button>
            <button 
              type="button" 
              className={`btn ${orderMethod === 'batch' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setOrderMethod('batch')}
            >
              Batch Upload (Excel + ZIP)
            </button>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={orderMethod === 'standard' ? handleCreate : handleAnalyzeBatchFiles} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {orderMethod === 'batch' && showPreviewStep ? (
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Roster Preview & Selection</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                      Verify and select which cardholders to import and print. Missing photos are flagged.
                    </p>
                  </div>
                  <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                    Selected: <strong>{selectedPreviewIndexes.length}</strong> / {parsedCardholders.length}
                  </div>
                </div>

                <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }} className="custom-table">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                        <th style={{ width: '40px', padding: '8px 12px' }}>
                          <input 
                            type="checkbox"
                            checked={selectedPreviewIndexes.length === parsedCardholders.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPreviewIndexes(parsedCardholders.map((_, i) => i));
                              } else {
                                setSelectedPreviewIndexes([]);
                              }
                            }}
                          />
                        </th>
                        <th style={{ padding: '8px 12px' }}>Photo</th>
                        <th style={{ padding: '8px 12px' }}>Name</th>
                        <th style={{ padding: '8px 12px' }}>ID / Roll Number</th>
                        <th style={{ padding: '8px 12px' }}>Designation</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedCardholders.map((c, idx) => {
                        const isSelected = selectedPreviewIndexes.includes(idx);
                        const photoData = photosMap.get(c.sanitizedKey);
                        return (
                          <tr 
                            key={idx} 
                            style={{ 
                              borderTop: '1px solid rgba(255,255,255,0.05)', 
                              background: isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
                              opacity: isSelected ? 1 : 0.6
                            }}
                          >
                            <td style={{ padding: '8px 12px' }}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPreviewIndexes(prev => [...prev, idx]);
                                  } else {
                                    setSelectedPreviewIndexes(prev => prev.filter(i => i !== idx));
                                  }
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {c.hasPhoto && photoData?.url ? (
                                <img 
                                  src={photoData.url} 
                                  alt={c.name} 
                                  style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                                />
                              ) : (
                                <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', border: '1px dashed rgba(239,68,68,0.3)' }} title="No image found in ZIP">
                                  <ImageIcon size={16} />
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.name}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                              {c.imageId && c.imageId !== c.uniqueKey 
                                ? `${c.uniqueKey || '—'} [Img: ${c.imageId}]` 
                                : (c.uniqueKey || c.imageId || '—')}
                            </td>
                            <td style={{ padding: '8px 12px' }}>{c.designation || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {c.hasPhoto ? (
                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                  <CheckCircle size={12} /> Ready
                                </span>
                              ) : (
                                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }} title="No photo matched. ID will compile with placeholder.">
                                  <AlertTriangle size={12} /> Missing Photo
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {uploadStatus && (
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--primary)' }}>{uploadStatus}</span>
                      {uploadProgress.total > 0 && (
                        <span>{uploadProgress.current} / {uploadProgress.total}</span>
                      )}
                    </div>
                    {uploadProgress.total > 0 && (
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            background: 'var(--primary)', 
                            width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                            transition: 'width 0.2s ease-out' 
                          }} 
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* PDF Layout Configuration */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '16px',
                  marginTop: '8px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Paper Size</label>
                    <select 
                      className="form-select" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      value={paperSize} 
                      onChange={e => setPaperSize(e.target.value as any)}
                    >
                      <option value="A3">A3 Sheet</option>
                      <option value="A4">A4 Sheet</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Orientation</label>
                    <select 
                      className="form-select" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      value={orientation} 
                      onChange={e => setOrientation(e.target.value as any)}
                    >
                      <option value="PORTRAIT">Portrait</option>
                      <option value="LANDSCAPE">Landscape</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Bleed (mm)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="10"
                      step="0.5"
                      className="form-input" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      value={bleedMm} 
                      onChange={e => setBleedMm(e.target.value)} 
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={cropMarks} 
                        onChange={e => setCropMarks(e.target.checked)} 
                      />
                      Crop Marks
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={foldLine} 
                        onChange={e => setFoldLine(e.target.checked)} 
                      />
                      Fold Line
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '14px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    disabled={submitting}
                    onClick={() => {
                      setShowPreviewStep(false);
                      setParsedCardholders([]);
                      setSelectedPreviewIndexes([]);
                      // Revoke URLs to free memory
                      photosMap.forEach((val) => {
                        if (val.url) URL.revokeObjectURL(val.url);
                      });
                      setPhotosMap(new Map());
                    }}
                  >
                    Back to Files
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ border: '1px solid rgba(255, 255, 255, 0.15)', background: 'transparent' }}
                    disabled={submitting || selectedPreviewIndexes.length === 0}
                    onClick={handleGenerateApprovalProof}
                  >
                    {submitting ? 'Processing...' : 'Download Approval Proof (A4)'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    disabled={submitting || selectedPreviewIndexes.length === 0}
                    onClick={handleGenerateProductionPdf}
                  >
                    {submitting ? 'Generating...' : `Download Production PDF (${selectedPreviewIndexes.length} cards)`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Client Registry Folder</label>
                  <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Card Template</label>
                  <select className="form-select" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Price Per Card (Rs)</label>
                  <input type="number" required className="form-input" value={pricePerCard} onChange={e => setPricePerCard(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">GST / Tax Percent (%)</label>
                  <input type="number" required className="form-input" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Card Expiry Validity Date</label>
                  <input 
                    type="date" 
                    required 
                    className="form-input" 
                    value={validTill} 
                    onChange={e => setValidTill(e.target.value)} 
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (err) {
                        console.warn('showPicker is not supported:', err);
                      }
                    }}
                  />
                </div>

                {orderMethod === 'batch' && (
                  <>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Excel Data Sheet (.xlsx, .csv)</label>
                      <input type="file" required accept=".xlsx,.xls,.csv" className="form-input" onChange={e => setExcelFile(e.target.files?.[0] || null)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                        First row must contain headers. Unique student ID column will be auto-detected.
                      </span>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Student Photos ZIP Archive (.zip)</label>
                      <input type="file" required accept=".zip" className="form-input" onChange={e => setZipFile(e.target.files?.[0] || null)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                        Each photo filename should match the student's unique ID in the excel sheet.
                      </span>
                    </div>
                  </>
                )}

                {uploadStatus && (
                  <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--primary)' }}>{uploadStatus}</span>
                      {uploadProgress.total > 0 && (
                        <span>{uploadProgress.current} / {uploadProgress.total}</span>
                      )}
                    </div>
                    {uploadProgress.total > 0 && (
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            background: 'var(--primary)', 
                            width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                            transition: 'width 0.2s ease-out' 
                          }} 
                        />
                      </div>
                    )}
                  </div>
                )}

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowForm(false);
                    setExcelFile(null);
                    setZipFile(null);
                    setUploadStatus('');
                  }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Analyzing...' : (orderMethod === 'batch' ? 'Analyze & Match Files' : 'Initialize Order')}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <FileText size={40} style={{ marginBottom: '16px' }} />
          <h3>No Orders Found</h3>
          <p style={{ marginTop: '8px' }}>Create your first order to assemble layout sheets, assign serials, and print.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Client Registry</th>
                <th>Status</th>
                <th>Template</th>
                <th>Validity till</th>
                <th>Total Cardholders</th>
                <th>Payment</th>
                <th>Invoice total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord: any) => {
                const cardholderCount = ord._count?.cardholders ?? (ord.cardholders?.length ?? 0);
                const totalInvoiceAmount = ord.invoice ? `Rs. ${Number(ord.invoice.totalAmount).toFixed(2)}` : '—';
                const paymentStatus = ord.invoice ? (
                  ord.invoice.paymentStatus === 'PAID' ? (
                    <span className="badge badge-success">Paid</span>
                  ) : (
                    <span className="badge badge-danger">Unpaid</span>
                  )
                ) : '—';

                return (
                  <tr key={ord.id}>
                    <td>#{ord.id}</td>
                    <td style={{ fontWeight: '500' }}>{ord.client?.name}</td>
                    <td>{getStatusBadge(ord.status)}</td>
                    <td>{ord.template?.name} (v{ord.templateVersion})</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <Calendar size={12} />
                        <span>{ord.validTill ? new Date(ord.validTill).toLocaleDateString() : '—'}</span>
                      </div>
                    </td>
                    <td>{cardholderCount} cards</td>
                    <td>{paymentStatus}</td>
                    <td>{totalInvoiceAmount}</td>
                    <td>
                      <a href={`/dashboard/orders/${ord.id}`} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                        <FolderOpen size={12} /> Open Pipeline
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
