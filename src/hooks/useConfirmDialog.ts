'use client';
import { useState, useCallback } from 'react';
export interface ConfirmConfig {
  title: string; message: string; confirmLabel: string;
  variant: 'danger' | 'warning'; onConfirm: () => void;
}
export function useConfirmDialog() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const showConfirm = useCallback((cfg: ConfirmConfig) => { setConfirmConfig(cfg); setConfirmOpen(true); }, []);
  const closeConfirm = useCallback(() => { setConfirmOpen(false); setConfirmConfig(null); }, []);
  return { confirmOpen, confirmConfig, showConfirm, closeConfirm };
}
