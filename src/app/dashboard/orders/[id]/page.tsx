'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useOrderDetail } from './hooks/useOrderDetail';
import { useOrderPDFJob } from './hooks/useOrderPDFJob';
import { OrderDetailHeader } from './components/OrderDetailHeader';
import { OrderCardholderTable } from './components/OrderCardholderTable';
import { CardholderEditModal } from './components/CardholderEditModal';
import { PressDispatchModal } from './components/PressDispatchModal';

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = Number(params.id);

  const {
    order, logs, notes, loading, isOwner, transitioning, noteContent,
    setNoteContent, fetchData, handleWorkflowAction, handleClone,
    handleAddNote
  } = useOrderDetail(orderId);

  const {
    pdfLoading, setPdfLoading, previewJob, setPreviewJob,
    pendingCompileType, setPendingCompileType, getLatestJob,
  } = useOrderPDFJob(order, fetchData);

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

  return (
    <div>
      <OrderDetailHeader
        order={order} currentStep={getStatusStep()} steps={steps} transitioning={transitioning}
        pdfLoading={pdfLoading} isOwner={isOwner} handleClone={handleClone} fetchData={fetchData}
        handleWorkflowAction={handleWorkflowAction} activeJobsNode={null}
      />

      <div className="dashboard-grid-32">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <OrderCardholderTable />
        </div>
      </div>

      <CardholderEditModal />
      <PressDispatchModal />
    </div>
  );
}
