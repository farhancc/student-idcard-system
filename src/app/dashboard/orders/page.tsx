'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useOrderList } from './hooks/useOrderList';
import { useBatchOrders } from './hooks/useBatchOrders';
import { OrderFilters } from './components/OrderFilters';
import { OrderTable } from './components/OrderTable';
import { OrderStatsOverview } from './components/OrderStatsOverview';
import { BatchDispatchModal } from './components/BatchDispatchModal';
import { PrintJobStatusModal } from './components/PrintJobStatusModal';
import { WhatsAppNotifyModal } from './components/WhatsAppNotifyModal';

export default function OrdersPage() {
  const {
    orders,
    clients,
    templates,
    loading,
    role,
    pressId,
    page, setPage,
    total,
    pendingPrinting,
    PAGE_SIZE,
    sortBy,
    sortDir,
    search, setSearch,
    debouncedSearch,
    clientId, setClientId,
    templateId, setTemplateId,
    fetchData,
    handleSort
  } = useOrderList();

  const isOwner = role === 'OWNER';

  const batchProps = useBatchOrders(
    pressId,
    templates,
    clients,
    clientId,
    templateId,
    fetchData
  );

  const { showForm, setShowForm, orderMethod, setOrderMethod, error, submitting, handleCreate } = batchProps;

  // Modals state
  const [printJobModalOpen, setPrintJobModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  if (showForm && orderMethod === 'batch') {
    return (
      <BatchDispatchModal
        batchProps={batchProps}
        templates={templates}
        clients={clients}
        clientId={clientId}
        setClientId={setClientId}
        templateId={templateId}
        setTemplateId={setTemplateId}
        setShowForm={setShowForm}
        setOrderMethod={setOrderMethod}
        isOwner={isOwner}
        pricePerCard={batchProps.pricePerCard}
        setPricePerCard={batchProps.setPricePerCard}
        taxPercent={batchProps.taxPercent}
        setTaxPercent={batchProps.setTaxPercent}
        handleAnalyzeBatchFiles={(e: React.FormEvent) => { /* Dummy, implemented inside modal if needed or in hook */ }}
        validTill={batchProps.validTill}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Card Orders</h1>
          <p style={{ marginTop: '4px' }}>Draft client orders, manage status flow, and view billing invoices.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setPrintJobModalOpen(true)}>
            Print Jobs
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> {showForm ? 'Hide Form' : 'Initialize Order'}
          </button>
        </div>
      </div>

      <OrderStatsOverview totalOrders={total} pendingPrinting={pendingPrinting} />

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '32px', width: '100%' }}>
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

          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

            {isOwner && (
              <>
                <div className="form-group">
                  <label className="form-label">Price Per Card (Rs)</label>
                  <input type="number" required className="form-input" value={batchProps.pricePerCard} onChange={e => batchProps.setPricePerCard(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">GST / Tax Percent (%)</label>
                  <input type="number" required className="form-input" value={batchProps.taxPercent} onChange={e => batchProps.setTaxPercent(e.target.value)} />
                </div>
              </>
            )}

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => {
                setShowForm(false);
              }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Analyzing...' : 'Initialize Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      <OrderFilters search={search} setSearch={setSearch} />

      <OrderTable 
        orders={orders}
        loading={loading}
        isOwner={isOwner}
        page={page}
        setPage={setPage}
        total={total}
        pageSize={PAGE_SIZE}
        sortBy={sortBy}
        sortDir={sortDir}
        handleSort={handleSort}
        debouncedSearch={debouncedSearch}
      />

      <PrintJobStatusModal isOpen={printJobModalOpen} onClose={() => setPrintJobModalOpen(false)} />
      <WhatsAppNotifyModal isOpen={whatsappModalOpen} onClose={() => setWhatsappModalOpen(false)} />
    </div>
  );
}
