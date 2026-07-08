'use client';

import React, { useEffect, useState } from 'react';
import { Plus, FileText, Calendar, DollarSign, FolderOpen, RefreshCcw } from 'lucide-react';

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

  const handleBatchCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploadStatus('Reading spreadsheet file...');
    setUploadProgress({ current: 0, total: 0 });
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const photoUrlCol = getHeaderKey(firstRowHeaders, ['photo', 'photourl', 'image', 'picture']) || 'photoUrl';

      // 2. Extract photos from ZIP
      setUploadStatus('Extracting photos from ZIP...');
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(zipFile);
      const photosMap = new Map<string, Blob>();
      const filePromises: Promise<void>[] = [];

      zip.forEach((relativePath, file) => {
        if (file.dir) return;
        const ext = relativePath.substring(relativePath.lastIndexOf('.')).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const baseName = relativePath.split('/').pop()?.replace(ext, '').trim() || '';
          const promise = file.async('blob').then(blob => {
            photosMap.set(baseName.toLowerCase(), blob);
          });
          filePromises.push(promise);
        }
      });
      await Promise.all(filePromises);

      // Parse and construct raw JSON cardholder objects
      const parsedCardholders = rawData.map(row => {
        const name = String(row[nameCol] || '').trim();
        const designation = row[designationCol] ? String(row[designationCol]).trim() : null;
        const uniqueKey = row[uniqueKeyCol] ? String(row[uniqueKeyCol]).trim() : null;
        const photoUrl = row[photoUrlCol] ? String(row[photoUrlCol]).trim() : null;

        const custom: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          if (key !== nameCol && key !== designationCol && key !== uniqueKeyCol && key !== photoUrlCol) {
            custom[key] = row[key];
          }
        });

        return {
          name,
          designation,
          uniqueKey,
          photoUrl,
          customFields: custom,
        };
      }).filter(c => c.name);

      // 3. Coordinate photo uploads to Cloudinary (signed direct upload) or Local fallback API
      const cardholdersWithPhotos = parsedCardholders.filter(c => {
        const matchKey = c.uniqueKey || c.name;
        return photosMap.has(matchKey.toLowerCase());
      });

      setUploadStatus(`Uploading photos (0/${cardholdersWithPhotos.length})...`);
      setUploadProgress({ current: 0, total: cardholdersWithPhotos.length });

      let currentUpload = 0;
      const concurrency = 5;

      const uploadTasks = cardholdersWithPhotos.map(cardholder => {
        return async () => {
          const matchKey = cardholder.uniqueKey || cardholder.name;
          const photoBlob = photosMap.get(matchKey.toLowerCase())!;
          
          try {
            // Request signed upload payload from the server
            const signRes = await fetch('/api/upload/sign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                folder: `press_${pressId}/client_${clientId}/photos`,
                publicId: String(matchKey),
                overwrite: true,
              }),
            });

            const signData = await signRes.json();
            if (signRes.ok && signData.success) {
              // Direct Cloudinary Upload
              const formData = new FormData();
              formData.append('file', photoBlob);
              formData.append('api_key', signData.apiKey);
              formData.append('timestamp', String(signData.timestamp));
              formData.append('signature', signData.signature);
              formData.append('folder', `press_${pressId}/client_${clientId}/photos`);
              formData.append('public_id', String(matchKey));
              formData.append('overwrite', 'true');

              const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`, {
                method: 'POST',
                body: formData,
              });

              if (!cloudRes.ok) {
                throw new Error(`Cloudinary upload failed: ${cloudRes.statusText}`);
              }
              const cloudData = await cloudRes.json();
              cardholder.photoUrl = cloudData.secure_url;
            } else {
              // Local upload fallback endpoint
              const formData = new FormData();
              const ext = photoBlob.type.split('/')[1] || 'png';
              formData.append('file', new File([photoBlob], `${matchKey}.${ext}`, { type: photoBlob.type }));
              formData.append('type', 'photo');

              const localRes = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                  'x-press-id': String(pressId),
                },
                body: formData,
              });
              if (!localRes.ok) {
                throw new Error(`Local upload failed: ${localRes.statusText}`);
              }
              const localData = await localRes.json();
              cardholder.photoUrl = localData.url;
            }
          } catch (err: any) {
            console.error(`Upload error for ${cardholder.name}:`, err);
          } finally {
            currentUpload++;
            setUploadStatus(`Uploading photos (${currentUpload}/${cardholdersWithPhotos.length})...`);
            setUploadProgress({ current: currentUpload, total: cardholdersWithPhotos.length });
          }
        };
      });

      // Simple concurrency queue processor
      const queue = async (tasks: (() => Promise<void>)[], maxConcurrency: number) => {
        const executing = new Set<Promise<void>>();
        for (const task of tasks) {
          const p = Promise.resolve().then(() => task());
          executing.add(p);
          const clean = () => executing.delete(p);
          p.then(clean, clean);
          if (executing.size >= maxConcurrency) {
            await Promise.race(executing);
          }
        }
        await Promise.all(executing);
      };

      await queue(uploadTasks, concurrency);

      // 4. Send complete JSON batch metadata to /api/orders/batch-process
      setUploadStatus('Syncing registry changes with database...');
      const res = await fetch('/api/orders/batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientId),
          templateId: Number(templateId),
          pricePerCard: Number(pricePerCard),
          taxPercent: Number(taxPercent),
          validTill: validTill || null,
          cardholders: parsedCardholders,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to process batch order');

      setShowForm(false);
      setExcelFile(null);
      setZipFile(null);
      setUploadStatus('');
      fetchData();
      window.dispatchEvent(new Event('refresh-profile')); // update available credits count
    } catch (err: any) {
      setError(err.message || 'Error occurred during batch processing');
    } finally {
      setSubmitting(false);
      setUploadStatus('');
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

          <form onSubmit={orderMethod === 'standard' ? handleCreate : handleBatchCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                {submitting ? 'Processing...' : (orderMethod === 'batch' ? 'Upload & Process' : 'Initialize Order')}
              </button>
            </div>
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
