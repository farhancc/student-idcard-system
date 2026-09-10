import { useState, useCallback } from 'react';

export function useGlobalFonts() {
  const [globalFonts, setGlobalFonts] = useState<any[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  const [fontModalOpen, setFontModalOpen] = useState(false);
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontName, setFontName] = useState('');
  const [fontLanguage, setFontLanguage] = useState('en');
  const [fontSubmitting, setFontSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchGlobalFonts = useCallback(async () => {
    setFontsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/fonts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch global fonts');
      setGlobalFonts(data.fonts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load global fonts.');
    } finally {
      setFontsLoading(false);
    }
  }, []);

  const handleSaveFont = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fontFile && !fontName) {
      setError('Font file and name are required');
      return;
    }
    setFontSubmitting(true);
    try {
      const formData = new FormData();
      if (fontFile) formData.append('file', fontFile);
      formData.append('name', fontName);
      formData.append('language', fontLanguage);

      const res = await fetch('/api/superadmin/fonts', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save font');

      setFontModalOpen(false);
      setFontFile(null);
      setFontName('');
      setFontLanguage('en');
      fetchGlobalFonts();
    } catch (err: any) {
      setError(err.message || 'Failed to save font.');
    } finally {
      setFontSubmitting(false);
    }
  };

  const handleDeleteFont = async (id: number) => {
    if (!confirm('Are you sure you want to delete this global font? This action cannot be undone.')) return;
    
    setError('');
    try {
      const res = await fetch(`/api/superadmin/fonts/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete font');

      fetchGlobalFonts();
    } catch (err: any) {
      setError(err.message || 'Failed to delete font.');
    }
  };

  return {
    globalFonts, setGlobalFonts,
    fontsLoading, setFontsLoading,
    fontModalOpen, setFontModalOpen,
    fontFile, setFontFile,
    fontName, setFontName,
    fontLanguage, setFontLanguage,
    fontSubmitting, setFontSubmitting,
    error, setError,
    fetchGlobalFonts,
    handleSaveFont,
    handleDeleteFont
  };
}
