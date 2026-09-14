import React from 'react';
import Link from 'next/link';
import { FolderOpen, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Order } from '../types';

interface OrderTableProps {
  orders: Order[];
  loading: boolean;
  isOwner: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  total: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  handleSort: (col: string) => void;
  debouncedSearch: string;
}

export function OrderTable({
  orders,
  loading,
  isOwner,
  page,
  setPage,
  total,
  pageSize,
  sortBy,
  sortDir,
  handleSort,
  debouncedSearch,
}: OrderTableProps) {
  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ChevronsUpDown size={12} style={{ marginLeft: 4, opacity: 0.4 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: 4, color: '#4f46e5' }} />
      : <ChevronDown size={12} style={{ marginLeft: 4, color: '#4f46e5' }} />;
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
        <h3>{debouncedSearch ? 'No Matching Orders' : 'No Orders Found'}</h3>
        <p style={{ marginTop: '8px' }}>
          {debouncedSearch 
            ? `We couldn't find any orders matching "${debouncedSearch}".` 
            : 'Create your first order to assemble layout sheets, assign serials, and print.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="custom-table" style={{ minWidth: '800px' }}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th
                onClick={() => handleSort('client')}
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
              >
                Client Registry <SortIcon col="client" />
              </th>
              <th
                onClick={() => handleSort('status')}
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
              >
                Status <SortIcon col="status" />
              </th>
              <th
                onClick={() => handleSort('template')}
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
              >
                Template <SortIcon col="template" />
              </th>
              <th>Cards</th>
              {isOwner && (
                <>
                  <th>Payment</th>
                  <th>Total</th>
                </>
              )}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((ord) => {
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
                  <td>{cardholderCount}</td>
                  {isOwner && (
                    <>
                      <td>{paymentStatus}</td>
                      <td>{totalInvoiceAmount}</td>
                    </>
                  )}
                  <td>
                    <Link href={`/dashboard/orders/${ord.id}`} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      <FolderOpen size={12} /> Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} orders
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            {Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => i + 1)
              .filter(p => p === 1 || p === Math.ceil(total / pageSize) || Math.abs(p - page) <= 1)
              .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--muted)', fontSize: '0.82rem' }}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer',
                      border: page === p ? 'none' : '1px solid var(--glass-border)',
                      background: page === p ? '#4f46e5' : 'rgba(255,255,255,0.04)',
                      color: page === p ? '#ffffff' : 'var(--muted)',
                      fontWeight: page === p ? '700' : '400',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              disabled={page * pageSize >= total}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
