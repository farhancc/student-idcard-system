import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { TemplateCategory } from '../components/constants';

export function useTemplateList() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [viewTab, setViewTab] = useState<'my' | 'starter'>('my');
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'ALL'>('ALL');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/templates');
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates || []);
        setGlobalTemplates(json.globalTemplates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCloneTemplate = useCallback(async (tmpl: any) => {
    setLoading(true);
    try {
      let baseName = `${tmpl.name} (Copy)`;
      let uniqueName = baseName;
      let counter = 2;
      while (templates.some(t => t.name.trim().toLowerCase() === uniqueName.trim().toLowerCase())) {
        uniqueName = `${baseName} ${counter}`;
        counter++;
      }

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: uniqueName,
          cardWidth: tmpl.cardWidth,
          cardHeight: tmpl.cardHeight,
          frontImageUrl: tmpl.frontImageUrl,
          backImageUrl: tmpl.backImageUrl || null,
          frontOriginalUrl: tmpl.frontOriginalUrl || null,
          backOriginalUrl: tmpl.backOriginalUrl || null,
          frontFields: tmpl.frontFields,
          backFields: tmpl.backFields,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to clone template');

      toast(`Successfully cloned "${tmpl.name}" to your library!`, 'success');
      setViewTab('my');
      fetchTemplates();
    } catch (err: any) {
      toast(err.message || 'Error cloning template', 'error');
      setLoading(false);
    }
  }, [templates, toast, fetchTemplates]);

  const handleDeleteTemplate = useCallback(async (id: number, showConfirm: any, closeConfirm: any) => {
    showConfirm({
      title: 'Delete Template',
      message: 'All history and field configurations for this layout will be permanently removed. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
          if (res.ok) { fetchTemplates(); }
          else { const data = await res.json(); toast(data.error || 'Failed to delete template', 'error'); }
        } catch (err) { console.error(err); toast('Error deleting template', 'error'); }
      },
    });
  }, [fetchTemplates, toast]);

  return {
    templates,
    setTemplates,
    globalTemplates,
    viewTab,
    setViewTab,
    loading,
    setLoading,
    filterCategory,
    setFilterCategory,
    fetchTemplates,
    handleCloneTemplate,
    handleDeleteTemplate
  };
}
