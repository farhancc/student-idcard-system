import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

export function useBulkOperations({
  selectedIds,
  setSelectedIds,
  handleRefresh,
  showConfirm,
  closeConfirm,
}: {
  selectedIds: number[];
  setSelectedIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  handleRefresh: () => void;
  showConfirm: (cfg: any) => void;
  closeConfirm: () => void;
}) {
  const { toast } = useToast();

  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkReassignTemplateId, setBulkReassignTemplateId] = useState('');
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    showConfirm({
      title: 'Bulk Delete Cardholders',
      message: `Permanently delete ${selectedIds.length} selected cardholder(s)? This cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.length} Records`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          setBulkOperationLoading(true);
          const res = await fetch('/api/cardholders/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds, action: 'delete' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Bulk delete failed');
          toast(`Deleted ${data.affected} cardholder(s) successfully.`, 'success');
          setSelectedIds([]);
          handleRefresh();
        } catch (err: any) {
          toast(err.message || 'Bulk delete failed', 'error');
        } finally {
          setBulkOperationLoading(false);
          closeConfirm();
        }
      },
    });
  };

  const handleBulkStatusToggle = (activate: boolean) => {
    if (selectedIds.length === 0) return;
    const action = activate ? 'activate' : 'deactivate';
    const label = activate ? 'Activate' : 'Deactivate';
    showConfirm({
      title: `Bulk ${label} Cardholders`,
      message: `${label} ${selectedIds.length} selected cardholder(s)?`,
      confirmLabel: `${label} ${selectedIds.length} Records`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          setBulkOperationLoading(true);
          const res = await fetch('/api/cardholders/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds, action }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Bulk ${action} failed`);
          toast(`${label}d ${data.affected} cardholder(s) successfully.`, 'success');
          setSelectedIds([]);
          handleRefresh();
        } catch (err: any) {
          toast(err.message || `Bulk ${action} failed`, 'error');
        } finally {
          setBulkOperationLoading(false);
          closeConfirm();
        }
      },
    });
  };

  const handleBulkReassign = async () => {
    if (!bulkReassignTemplateId || selectedIds.length === 0) return;
    try {
      setBulkOperationLoading(true);
      const res = await fetch('/api/cardholders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          action: 'reassign_template',
          templateId: Number(bulkReassignTemplateId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk reassign failed');
      toast(`Reassigned ${data.affected} cardholder(s) to new template.`, 'success');
      setSelectedIds([]);
      setShowBulkReassignModal(false);
      setBulkReassignTemplateId('');
      handleRefresh();
    } catch (err: any) {
      toast(err.message || 'Bulk reassign failed', 'error');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  return {
    showBulkReassignModal, setShowBulkReassignModal,
    bulkReassignTemplateId, setBulkReassignTemplateId,
    bulkOperationLoading, setBulkOperationLoading,
    handleBulkDelete,
    handleBulkStatusToggle,
    handleBulkReassign,
  };
}
