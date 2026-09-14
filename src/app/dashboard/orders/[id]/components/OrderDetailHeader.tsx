import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, RefreshCw, Zap, CheckCircle, Activity } from 'lucide-react';

export function OrderDetailHeader({
  order,
  currentStep,
  steps,
  transitioning,
  pdfLoading,
  isOwner,
  handleClone,
  fetchData,
  handleWorkflowAction,
  activeJobsNode
}: any) {
  if (!order) return null;

  let nextActionLabel = '';
  let nextStatus = '';
  let actionDescription = '';

  switch (order.status) {
    case 'DRAFT':
      nextActionLabel = 'Send for Approval';
      nextStatus = 'APPROVAL_PDF_SENT';
      actionDescription = 'This will generate watermarked PDF proofs and transition the order to the "Approval Sent" stage.';
      break;
    case 'APPROVAL_PDF_SENT':
      nextActionLabel = 'Approve Layout';
      nextStatus = 'APPROVED';
      actionDescription = 'The client has approved the layout. Transition the order to the "Approved layout" stage.';
      break;
    case 'APPROVED':
      nextActionLabel = 'Send to Printing Press';
      nextStatus = 'PRINTING';
      actionDescription = 'This will compile the CMYK print grids on A3 layout sheets and lock printing credits.';
      break;
    case 'PRINTING':
      nextActionLabel = 'Mark as Delivered';
      nextStatus = 'DELIVERED';
      actionDescription = 'The cards have been printed and delivered. This will generate the invoice PDF.';
      break;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard/orders" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--glass-border)',
            background: 'rgba(255,255,255,0.02)', color: '#fff'
          }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Card Print Pipeline</span>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '1.75rem' }}>
              Order #{order.id} <span style={{ fontSize: '1.1rem', color: 'var(--muted)', fontWeight: '400' }}>({order.client?.name})</span>
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleClone}>
            <Copy size={14} /> Duplicate Order
          </button>
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh Logs
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '32px', padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', overflowX: 'auto' }}>
          <div style={{
            position: 'absolute', top: '20px', left: '30px', right: '30px', height: '4px',
            background: 'rgba(255,255,255,0.08)', zIndex: 1
          }}>
            <div style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
              height: '100%', background: 'var(--primary-gradient)'
            }}></div>
          </div>
          {steps.map((step: any) => {
            const isCompleted = currentStep > step.num;
            const isActive = currentStep === step.num;

            let circleBg = '#1e293b';
            let circleBorder = '2px solid #334155';
            let circleColor = '#94a3b8';
            let circleShadow = 'none';

            if (isActive) {
              circleBg = 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)';
              circleBorder = '3px solid #a5b4fc';
              circleColor = '#ffffff';
              circleShadow = '0 0 16px rgba(99, 102, 241, 0.7)';
            } else if (isCompleted) {
              circleBg = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
              circleBorder = '2px solid #34d399';
              circleColor = '#ffffff';
            }

            return (
              <div key={step.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1, minWidth: '100px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: circleBg,
                  border: circleBorder,
                  color: circleColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '1rem',
                  boxShadow: circleShadow,
                  transition: 'all 0.2s ease'
                }}>
                  {isCompleted ? '✓' : step.num}
                </div>
                <span style={{
                  marginTop: '12px',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? '700' : (isCompleted ? '600' : '500'),
                  color: isActive ? '#ffffff' : (isCompleted ? '#a5b4fc' : '#e2e8f0'),
                  textAlign: 'center'
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel" style={{ 
        marginBottom: '32px', padding: '24px', border: '1px solid rgba(99, 102, 241, 0.15)', 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(0, 0, 0, 0.2) 100%)',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', background: 'var(--primary)', filter: 'blur(60px)', opacity: 0.1, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Zap size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600' }}>Pipeline Workflow Controller</h3>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '4px 0 0 0' }}>
                Current status: <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>{order.status.replace(/_/g, ' ')}</span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {nextStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleWorkflowAction(nextStatus)}
                  disabled={transitioning || pdfLoading !== null}
                  style={{
                    padding: '10px 20px', fontSize: '0.85rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.25)',
                    background: nextStatus === 'PRINTING' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--primary-gradient)'
                  }}
                >
                  {transitioning || pdfLoading ? (
                    <><span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1px' }}></span><span>Processing...</span></>
                  ) : (
                    <><Zap size={14} /><span>{nextActionLabel}</span></>
                  )}
                </button>
                {actionDescription && (
                  <span style={{ fontSize: '0.72rem', color: '#a5b4fc', textAlign: 'right', maxWidth: '350px' }}>{actionDescription}</span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.8rem', fontWeight: '500' }}>
                <CheckCircle size={14} /> Order Completed & Delivered
              </div>
            )}
            <div style={{ height: '36px', width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>Force Jump Stage</label>
              <select
                className="form-input"
                style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff', borderRadius: '6px', cursor: 'pointer' }}
                value={order.status}
                onChange={(e) => handleWorkflowAction(e.target.value)}
                disabled={transitioning || pdfLoading !== null}
              >
                <option value="DRAFT" style={{ background: '#0f172a', color: '#ffffff' }}>1. Draft Config</option>
                <option value="APPROVAL_PDF_SENT" style={{ background: '#0f172a', color: '#ffffff' }}>2. Approval Sent</option>
                <option value="APPROVED" style={{ background: '#0f172a', color: '#ffffff' }}>3. Approved layout</option>
                <option value="PRINTING" style={{ background: '#0f172a', color: '#ffffff' }}>4. Printing Press</option>
                <option value="DELIVERED" style={{ background: '#0f172a', color: '#ffffff' }}>5. Delivered</option>
              </select>
            </div>
          </div>
        </div>
        {activeJobsNode}
      </div>
    </>
  );
}
