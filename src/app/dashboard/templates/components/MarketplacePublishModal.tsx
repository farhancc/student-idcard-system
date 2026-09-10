'use client';
import React, { useState, useEffect } from 'react';
import { Store, X, FileText, Upload } from 'lucide-react';

interface MarketplacePublishModalProps {
  template: any;
  onClose: () => void;
  onPublished: (updatedTemplate: any) => void;
}

export default function MarketplacePublishModal({
  template,
  onClose,
  onPublished
}: MarketplacePublishModalProps) {
  const [publishPrice, setPublishPrice] = useState(String(template.price || 0));
  const [publishCdrUrl, setPublishCdrUrl] = useState<string | null>(template.cdrFileUrl || null);
  const [publishPsdUrl, setPublishPsdUrl] = useState<string | null>(template.psdFileUrl || null);
  const [publishAiUrl, setPublishAiUrl] = useState<string | null>(template.aiFileUrl || null);
  const [publishPdfUrl, setPublishPdfUrl] = useState<string | null>(template.pdfFileUrl || null);
  
  const [includeSourceFiles, setIncludeSourceFiles] = useState(
    !!(template.cdrFileUrl || template.psdFileUrl || template.aiFileUrl || template.pdfFileUrl)
  );

  const [uploadingFormat, setUploadingFormat] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');

  useEffect(() => {
    setPublishPrice(String(template.price || 0));
    setPublishCdrUrl(template.cdrFileUrl || null);
    setPublishPsdUrl(template.psdFileUrl || null);
    setPublishAiUrl(template.aiFileUrl || null);
    setPublishPdfUrl(template.pdfFileUrl || null);
    setIncludeSourceFiles(!!(template.cdrFileUrl || template.psdFileUrl || template.aiFileUrl || template.pdfFileUrl));
    setPublishMsg('');
  }, [template]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: '24px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '28px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={18} color="var(--primary)" />
            {template.isPublic ? 'Manage Marketplace Listing' : 'Sell on Marketplace'}
          </h3>
          <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {template.isPublic && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={14} /> This template is currently listed on the marketplace.
          </div>
        )}

        {template.isPurchased && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem', color: '#ef4444' }}>
            🚫 Purchased templates cannot be resold or listed on the marketplace.
          </div>
        )}

        <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Template: <strong style={{ color: 'var(--text)' }}>{template.name}</strong>
        </div>

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label" style={{ fontWeight: '600' }}>Price (credits) — set 0 for free</label>
          <input
            type="number" min="0" className="form-input"
            value={publishPrice}
            onChange={e => setPublishPrice(e.target.value)}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px' }}>
            Buyers will pay this many credits. A listing fee may be deducted from your balance.
          </p>
        </div>

        <div style={{ marginBottom: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
          <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            Are there design source files to include?
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className={`btn ${!includeSourceFiles ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '10px 14px', fontSize: '0.82rem', justifyContent: 'center' }}
              onClick={() => {
                setIncludeSourceFiles(false);
                setPublishCdrUrl(null);
                setPublishPsdUrl(null);
                setPublishAiUrl(null);
                setPublishPdfUrl(null);
              }}
            >
              No, publish template only
            </button>
            <button
              type="button"
              className={`btn ${includeSourceFiles ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '10px 14px', fontSize: '0.82rem', justifyContent: 'center' }}
              onClick={() => setIncludeSourceFiles(true)}
            >
              Yes, upload source files
            </button>
          </div>
        </div>

        {includeSourceFiles && (
          <div style={{ marginBottom: '24px', borderTop: '1px dashed var(--glass-border)', paddingTop: '16px' }}>
            <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={15} color="var(--primary)" /> Source Design Files (CDR / PSD / AI / PDF)
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0', marginBottom: '14px' }}>
              Attach original vector or raster editable files so buyers can download source files after purchasing.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { key: 'cdr', label: 'CorelDraw (.cdr)', ext: '.cdr', url: publishCdrUrl, setUrl: setPublishCdrUrl },
                { key: 'psd', label: 'Photoshop (.psd)', ext: '.psd', url: publishPsdUrl, setUrl: setPublishPsdUrl },
                { key: 'ai', label: 'Illustrator (.ai)', ext: '.ai', url: publishAiUrl, setUrl: setPublishAiUrl },
                { key: 'pdf', label: 'Vector PDF (.pdf)', ext: '.pdf', url: publishPdfUrl, setUrl: setPublishPdfUrl },
              ].map(f => (
                <div key={f.key} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (f.url ? 'rgba(16,185,129,0.4)' : 'var(--glass-border)'),
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{f.label}</span>
                    {f.url ? (
                      <span style={{ fontSize: '0.68rem', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: '4px' }}>Attached</span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Optional</span>
                    )}
                  </div>

                  {f.url ? (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <a href={f.url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, padding: '4px 8px', fontSize: '0.72rem', textDecoration: 'none', textAlign: 'center' }}>
                        View URL
                      </a>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#ef4444' }}
                        onClick={() => f.setUrl(null)}
                        title="Remove file"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="btn btn-secondary" style={{
                      padding: '6px 10px', fontSize: '0.75rem', cursor: uploadingFormat ? 'not-allowed' : 'pointer',
                      textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                      {uploadingFormat === f.key ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Uploading...
                        </span>
                      ) : (
                        <>
                          <Upload size={12} /> Add {f.ext.toUpperCase()}
                        </>
                      )}
                      <input
                        type="file"
                        accept={f.ext}
                        style={{ display: 'none' }}
                        disabled={!!uploadingFormat}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingFormat(f.key);
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            fd.append('type', 'source_file');
                            const res = await fetch('/api/upload', { method: 'POST', body: fd });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error);
                            f.setUrl(data.url || data.originalUrl);
                            setPublishMsg(`✅ ${f.label} attached!`);
                          } catch (err: any) {
                            setPublishMsg(`❌ Upload failed: ${err.message}`);
                          } finally {
                            setUploadingFormat(null);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {publishMsg && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem',
            background: publishMsg.startsWith('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: publishMsg.startsWith('✅') ? '#10b981' : '#ef4444',
            border: `1px solid ${publishMsg.startsWith('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {publishMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          {template.isPublic && (
            <button
              className="btn btn-secondary"
              style={{ flex: 1, gap: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
              disabled={publishLoading || !!uploadingFormat}
              onClick={async () => {
                setPublishLoading(true); setPublishMsg('');
                try {
                  const res = await fetch(`/api/marketplace/publish?templateId=${template.id}`, { method: 'DELETE' });
                  const d = await res.json();
                  if (!res.ok) throw new Error(d.error);
                  setPublishMsg('✅ Template delisted from marketplace.');
                  onPublished({ ...template, isPublic: false });
                } catch (e: any) { setPublishMsg('❌ ' + e.message); }
                finally { setPublishLoading(false); }
              }}
            >
              Delist
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ flex: 1, gap: '6px' }}
            disabled={publishLoading || !!uploadingFormat || template.isPurchased}
            onClick={async () => {
              setPublishLoading(true); setPublishMsg('');
              try {
                const res = await fetch('/api/marketplace/publish', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    templateId: template.id,
                    price: Number(publishPrice),
                    cdrFileUrl: publishCdrUrl,
                    psdFileUrl: publishPsdUrl,
                    aiFileUrl: publishAiUrl,
                    pdfFileUrl: publishPdfUrl,
                  }),
                });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error);
                setPublishMsg('✅ Marketplace listing updated successfully!');
                onPublished({
                  ...template,
                  isPublic: true,
                  price: Number(publishPrice),
                  cdrFileUrl: publishCdrUrl,
                  psdFileUrl: publishPsdUrl,
                  aiFileUrl: publishAiUrl,
                  pdfFileUrl: publishPdfUrl,
                });
              } catch (e: any) { setPublishMsg('❌ ' + e.message); }
              finally { setPublishLoading(false); }
            }}
          >
            {publishLoading ? 'Publishing...' : template.isPublic ? 'Update Listing' : 'Publish to Marketplace'}
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
