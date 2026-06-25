'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Download, RefreshCw, AlertCircle, CheckCircle, XCircle, Eye, X } from 'lucide-react';

export default function PdfJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewJob, setPreviewJob] = useState<any | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const json = await res.json();
        setJobs(json.jobs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 3 seconds for active jobs
  useEffect(() => {
    fetchJobs();

    const interval = setInterval(() => {
      // Check if any job is currently processing or pending
      const hasActiveJobs = jobs.some(j => j.status === 'PROCESSING' || j.status === 'PENDING');
      if (hasActiveJobs || loading) {
        fetchJobs();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs, loading]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-warning">Queued</span>;
      case 'PROCESSING':
        return <span className="badge badge-warning" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Processing</span>;
      case 'COMPLETED':
        return <span className="badge badge-success">Completed</span>;
      case 'FAILED':
        return <span className="badge badge-danger">Failed</span>;
      default:
        return <span className="badge badge-primary">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>PDF compilation jobs</h1>
          <p style={{ marginTop: '4px' }}>Monitor live PDF assembly queue and download completed print files.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { setLoading(true); fetchJobs(); }}>
          <RefreshCw size={16} /> Force Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <Clock size={40} style={{ marginBottom: '16px' }} />
          <h3>No PDF Jobs Registered</h3>
          <p style={{ marginTop: '8px' }}>Go to the Orders screen to trigger a PDF compilation task.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Order</th>
                <th>PDF Type</th>
                <th>Filename</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Expires in</th>
                <th>Download Link</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const isExpired = job.expiresAt ? new Date(job.expiresAt) < new Date() : false;
                const progressPercent = job.progress || 0;
                
                // Expiration display
                const hoursLeft = job.expiresAt ? Math.max(0, Math.round((new Date(job.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60))) : 0;
                const expirationLabel = job.isLocalJob ? (
                  <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Saved to Documents</span>
                ) : !job.expiresAt ? (
                  <span>Never</span>
                ) : isExpired ? (
                  <span style={{ color: 'var(--danger)', fontWeight: '600' }}>Expired</span>
                ) : (
                  <span>{Math.floor(hoursLeft / 24)}d {hoursLeft % 24}h</span>
                );

                return (
                  <tr key={job.id}>
                    <td>#{job.id}</td>
                    <td>
                      <a href={`/dashboard/orders/${job.orderId}`} style={{ color: 'var(--primary)', fontWeight: '500' }}>
                        Order #{job.orderId}
                      </a>
                    </td>
                    <td style={{ fontWeight: '500' }}>{job.pdfType}</td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{job.fileName}</td>
                    <td>{getStatusBadge(job.status)}</td>
                    <td style={{ width: '160px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          flex: 1,
                          height: '6px',
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${progressPercent}%`,
                            height: '100%',
                            background: job.status === 'FAILED' ? 'var(--danger)' : 'var(--primary-gradient)'
                          }}></div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', width: '30px', textAlign: 'right' }}>
                          {progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td>{expirationLabel}</td>
                    <td>
                      {job.status === 'COMPLETED' ? (
                        job.isLocalJob ? (
                          <span style={{ color: '#10b981', fontWeight: '500', fontSize: '0.75rem' }}>Saved to Documents</span>
                        ) : isExpired ? (
                          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Expired (7d limit)</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setPreviewJob(job)}
                            >
                              <Eye size={12} /> View
                            </button>
                            <a 
                              href={`/api/jobs/${job.id}/download`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Download size={12} /> Download
                            </a>
                          </div>
                        )
                      ) : job.status === 'FAILED' ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', fontSize: '0.75rem' }} title={job.errorMsg || 'Compilation failed'}>
                          <AlertCircle size={14} /> Failed
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={12} /> Pending...
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PDF Inline Preview Modal */}
      {previewJob && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 12, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '1000px',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '0',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.01)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  Preview: {previewJob.fileName}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Order #{previewJob.orderId} • {previewJob.pdfType} ({previewJob.label || `v${previewJob.version || 1}`})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <a
                  href={`/api/jobs/${previewJob.id}/download`}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={12} /> Download
                </a>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setPreviewJob(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Content - Embed PDF */}
            <div style={{ flex: 1, background: '#1c1c1e', position: 'relative' }}>
              <iframe
                src={`/api/jobs/${previewJob.id}/download?inline=true`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#1c1c1e'
                }}
                title={previewJob.fileName}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
