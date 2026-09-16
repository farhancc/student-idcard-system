'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useOrderDetail } from './hooks/useOrderDetail';
import { useOrderPDFJob } from './hooks/useOrderPDFJob';
import { OrderDetailHeader } from './components/OrderDetailHeader';
import { OrderPDFCompilerCard } from './components/OrderPDFCompilerCard';
import { OrderCardholderTable } from './components/OrderCardholderTable';
import { CardholderEditModal } from './components/CardholderEditModal';
import { PressDispatchModal } from './components/PressDispatchModal';
import { BatchImportWizard } from './components/BatchImportWizard';
import { Users, Upload } from 'lucide-react';

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = Number(params.id);

  const {
    order, logs, notes, loading, isOwner, transitioning, noteContent,
    setNoteContent, fetchData, handleWorkflowAction, handleClone,
    handleWhatsAppShare, handleAddNote
  } = useOrderDetail(orderId);

  const {
    pdfLoading, setPdfLoading, previewJob, setPreviewJob,
    pendingCompileType, setPendingCompileType, getLatestJob,
    proceedWithCompile
  } = useOrderPDFJob(orderId, order, fetchData);

  const [layoutConfig] = useState({
    paperSize: 'A4', orientation: 'PORTRAIT',
    marginLeft: 40, marginTop: 40, marginRight: 40, marginBottom: 40,
    colGap: 15, rowGap: 15, bleed: 0, cropMarks: true, foldLine: true
  });
  const [activeTab, setActiveTab] = useState<'cardholders' | 'batch-import'>('cardholders');

  if (loading) return <div>Loading...</div>;

  const steps = [
    { num: 1, label: 'Draft Config', key: 'DRAFT' },
    { num: 2, label: 'Approval Sent', key: 'APPROVAL_PDF_SENT' },
    { num: 3, label: 'Approved layout', key: 'APPROVED' },
    { num: 4, label: 'Printing Press', key: 'PRINTING' },
    { num: 5, label: 'Delivered', key: 'DELIVERED' }
  ];

  const getStatusStep = () => {
    if (!order) return 0;
    switch (order.status) {
      case 'DRAFT': return 1;
      case 'APPROVAL_PDF_SENT': return 2;
      case 'APPROVED': return 3;
      case 'PRINTING': return 4;
      case 'DELIVERED': return 5;
      default: return 1;
    }
  };

  const cardholderCount = order?._count?.cardholders ?? order?.cardholders?.length ?? 0;

  return (
    <div>
      <OrderDetailHeader
        order={order} currentStep={getStatusStep()} steps={steps} transitioning={transitioning}
        pdfLoading={pdfLoading} isOwner={isOwner} handleClone={handleClone} fetchData={fetchData}
        handleWorkflowAction={handleWorkflowAction} activeJobsNode={null}
      />

      {/* Tab Bar */}
      <div className="glass-panel" style={{
        marginBottom: '24px',
        padding: '4px',
        display: 'inline-flex',
        gap: '4px',
        borderRadius: '10px',
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('cardholders')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'cardholders' ? 600 : 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            background: activeTab === 'cardholders'
              ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.08))'
              : 'transparent',
            color: activeTab === 'cardholders' ? '#a5b4fc' : 'var(--muted)',
            boxShadow: activeTab === 'cardholders'
              ? '0 2px 8px rgba(99,102,241,0.15)'
              : 'none',
          }}
        >
          <Users size={16} />
          Cardholders
          {cardholderCount > 0 && (
            <span style={{
              background: 'rgba(99,102,241,0.2)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#818cf8',
            }}>
              {cardholderCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('batch-import')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'batch-import' ? 600 : 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            background: activeTab === 'batch-import'
              ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.08))'
              : 'transparent',
            color: activeTab === 'batch-import' ? '#a5b4fc' : 'var(--muted)',
            boxShadow: activeTab === 'batch-import'
              ? '0 2px 8px rgba(99,102,241,0.15)'
              : 'none',
          }}
        >
          <Upload size={16} />
          Batch Import
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'cardholders' && (
        <div className="dashboard-grid-32">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <OrderPDFCompilerCard handleWhatsAppShare={handleWhatsAppShare} />
            <OrderCardholderTable />
          </div>
        </div>
      )}

      {activeTab === 'batch-import' && (
        <BatchImportWizard
          orderId={orderId}
          order={order}
          fetchData={fetchData}
          proceedWithCompile={(type: string) => proceedWithCompile(type, false, 'LEAVE_BLANK', layoutConfig)}
        />
      )}

      <CardholderEditModal />
      <PressDispatchModal />
    </div>
  );
}
