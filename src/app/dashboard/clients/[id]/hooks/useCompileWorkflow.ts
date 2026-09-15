import { useState, useEffect, useCallback } from 'react';
import { Cardholder, QuickTemplate, QuickJobResult } from '../types';
import { EmptySlotStrategyType } from '../components/EmptySlotModal';
import { useToast } from '@/components/ui/toast';
import { autoDownloadJobFile } from '@/lib/downloadHelper';

export function useCompileWorkflow({
  clientId,
  cardholders,
  selectedIds,
  quickTemplates,
  setSelectedIds,
}: {
  clientId: number;
  cardholders: Cardholder[];
  selectedIds: number[];
  quickTemplates: QuickTemplate[];
  setSelectedIds: (ids: number[]) => void;
}) {
  const { toast } = useToast();

  const [showCompileModal, setShowCompileModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardCompileType, setWizardCompileType] = useState<'APPROVAL' | 'PRODUCTION' | null>(null);
  const [wizardPaperSize, setWizardPaperSize] = useState('A4');
  const [wizardOrientation, setWizardOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [wizardMarginLeft, setWizardMarginLeft] = useState(40);
  const [wizardMarginRight, setWizardMarginRight] = useState(40);
  const [wizardMarginTop, setWizardMarginTop] = useState(40);
  const [wizardMarginBottom, setWizardMarginBottom] = useState(40);
  const [wizardColGap, setWizardColGap] = useState(15);
  const [wizardRowGap, setWizardRowGap] = useState(15);
  const [wizardBleed, setWizardBleed] = useState(0);
  const [wizardCropMarks, setWizardCropMarks] = useState(true);
  const [wizardFoldLine, setWizardFoldLine] = useState(true);
  const [wizardEmptySlotStrategy, setWizardEmptySlotStrategy] = useState<EmptySlotStrategyType>('LEAVE_BLANK');
  const [wizardCustomCards, setWizardCustomCards] = useState<any[]>([]);
  const [wizardSelectedCustomCardId, setWizardSelectedCustomCardId] = useState('');
  const [wizardUploadingCard, setWizardUploadingCard] = useState(false);

  const [qTemplateId, setQTemplateId] = useState('');
  const [qPricePerCard, setQPricePerCard] = useState('50');
  const [qCompiling, setQCompiling] = useState<string | null>(null);
  const [qJobResult, setQJobResult] = useState<QuickJobResult | null>(null);
  const [qTemplateMixed, setQTemplateMixed] = useState(false);
  const [qDetectedTemplateName, setQDetectedTemplateName] = useState<string | null>(null);

  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showEmptySlotModal, setShowEmptySlotModal] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [emptySlotStrategy, setEmptySlotStrategy] = useState<EmptySlotStrategyType>('LEAVE_BLANK');
  const [pendingCompileType, setPendingCompileType] = useState<'APPROVAL' | 'PRODUCTION' | null>(null);
  const [pendingPaperSize, setPendingPaperSize] = useState('A4');
  const [pendingOrientation, setPendingOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [pendingLayoutConfig, setPendingLayoutConfig] = useState<{ marginLeft: number; marginRight: number; marginTop: number; marginBottom: number; colGap: number; rowGap: number; bleed: number; cropMarks: boolean; foldLine: boolean; } | null>(null);
  const [pendingCustomCardId, setPendingCustomCardId] = useState<string | undefined>(undefined);

  const loadWizardCustomCards = useCallback(async () => {
    try {
      const { getCustomCards } = await import('@/lib/clientDb');
      const list = await getCustomCards();
      setWizardCustomCards(list);
      if (list.length > 0 && !wizardSelectedCustomCardId) {
        setWizardSelectedCustomCardId(list[0].id);
      }
    } catch {}
  }, [wizardSelectedCustomCardId]);

  const handleWizardCustomCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast('Please upload a PDF file only.', 'error'); return; }
    setWizardUploadingCard(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b64 = (reader.result as string).split(',')[1];
        const { saveCustomCard } = await import('@/lib/clientDb');
        const saved = await saveCustomCard(file.name, b64);
        toast(`"${file.name}" saved locally!`, 'success');
        setWizardSelectedCustomCardId(saved.id);
        await loadWizardCustomCards();
      } catch (err: any) {
        toast(err.message || 'Failed to save', 'error');
      } finally { setWizardUploadingCard(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleWizardCustomCardDelete = async (id: string) => {
    if (!confirm('Delete this custom PDF card?')) return;
    try {
      const { deleteCustomCard } = await import('@/lib/clientDb');
      await deleteCustomCard(id);
      toast('Custom PDF card deleted.', 'success');
      if (wizardSelectedCustomCardId === id) setWizardSelectedCustomCardId('');
      await loadWizardCustomCards();
    } catch (err: any) { toast(err.message || 'Failed to delete', 'error'); }
  };

  const handleOpenCompileModal = () => {
    setQJobResult(null);
    const selectedCardholders = cardholders.filter((ch: any) => selectedIds.includes(ch.id));
    const templateIds = [...new Set(
      selectedCardholders
        .map((ch: any) => ch.resolvedTemplateId)
        .filter(Boolean)
    )] as number[];

    if (templateIds.length === 1) {
      setQTemplateId(String(templateIds[0]));
      const tpl = quickTemplates.find(t => String(t.id) === String(templateIds[0]));
      setQDetectedTemplateName(tpl?.name || null);
      setQTemplateMixed(false);
    } else if (templateIds.length > 1) {
      setQTemplateId(String(templateIds[0]));
      setQDetectedTemplateName(null);
      setQTemplateMixed(true);
    } else {
      setQDetectedTemplateName(null);
      setQTemplateMixed(false);
      if (quickTemplates.length > 0 && !qTemplateId) {
        setQTemplateId(String(quickTemplates[0].id));
      }
    }
    setWizardStep(1);
    setWizardCompileType(null);
    setWizardPaperSize('A3');
    setWizardOrientation('PORTRAIT');
    setWizardMarginLeft(40); setWizardMarginRight(40);
    setWizardMarginTop(40); setWizardMarginBottom(40);
    setWizardColGap(15); setWizardRowGap(15);
    setWizardBleed(0); setWizardCropMarks(true); setWizardFoldLine(true);
    setWizardEmptySlotStrategy('LEAVE_BLANK');
    setShowCompileModal(true);
  };

  const handleCompileIndividual = (ch: any) => {
    setSelectedIds([ch.id]);
    if (ch.resolvedTemplateId) {
      setQTemplateId(String(ch.resolvedTemplateId));
      const tpl = quickTemplates.find(t => String(t.id) === String(ch.resolvedTemplateId));
      setQDetectedTemplateName(tpl?.name || null);
      setQTemplateMixed(false);
    } else {
      setQDetectedTemplateName(null);
      setQTemplateMixed(false);
      if (quickTemplates.length > 0) {
        setQTemplateId(String(quickTemplates[0].id));
      }
    }
    setQJobResult(null);
    setWizardStep(1);
    setWizardCompileType(null);
    setWizardPaperSize('A3');
    setWizardOrientation('PORTRAIT');
    setWizardEmptySlotStrategy('LEAVE_BLANK');
    setShowCompileModal(true);
  };

  const handleCompileTable = (targetCardholders: Cardholder[], targetTemplate?: any) => {
    if (!targetCardholders || targetCardholders.length === 0) {
      toast('No cardholders to compile.', 'warning');
      return;
    }
    const ids = targetCardholders.map(c => c.id);
    setSelectedIds(ids);

    if (targetTemplate && targetTemplate.id) {
      setQTemplateId(String(targetTemplate.id));
      setQDetectedTemplateName(targetTemplate.name || null);
      setQTemplateMixed(false);
    } else {
      const templateIds = [...new Set(targetCardholders.map((ch: any) => ch.resolvedTemplateId).filter(Boolean))];
      if (templateIds.length === 1) {
        setQTemplateId(String(templateIds[0]));
        const tpl = quickTemplates.find(t => String(t.id) === String(templateIds[0]));
        setQDetectedTemplateName(tpl?.name || null);
        setQTemplateMixed(false);
      } else if (templateIds.length > 1) {
        setQTemplateId(String(templateIds[0]));
        setQDetectedTemplateName(null);
        setQTemplateMixed(true);
      } else {
        setQDetectedTemplateName(null);
        setQTemplateMixed(false);
        if (quickTemplates.length > 0 && !qTemplateId) {
          setQTemplateId(String(quickTemplates[0].id));
        }
      }
    }

    setQJobResult(null);
    setWizardStep(1);
    setWizardCompileType(null);
    setWizardPaperSize('A3');
    setWizardOrientation('PORTRAIT');
    setWizardEmptySlotStrategy('LEAVE_BLANK');
    setShowCompileModal(true);
  };

  const proceedWithQuickCompile = async (
    type: 'APPROVAL' | 'PRODUCTION',
    skipValidation = false,
    selectedStrategy: EmptySlotStrategyType = 'LEAVE_BLANK',
    overridePaperSize?: string,
    overrideOrientation?: string,
    layoutConfig?: {
      marginLeft: number; marginRight: number; marginTop: number; marginBottom: number;
      colGap: number; rowGap: number; bleed: number; cropMarks: boolean; foldLine: boolean;
    },
    customCardId?: string
  ) => {
    if (!qTemplateId || selectedIds.length === 0) return;
    setQCompiling(type);
    setQJobResult(null);
    try {
      const targetPaperSize = overridePaperSize || 'A3';
      const targetOrientation = overrideOrientation || 'PORTRAIT';
      const lc = layoutConfig || { marginLeft: 40, marginRight: 40, marginTop: 40, marginBottom: 40, colGap: 15, rowGap: 15, bleed: 0, cropMarks: true, foldLine: true };

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          templateId: Number(qTemplateId),
          cardholderIds: selectedIds,
          pricePerCard: Number(qPricePerCard) || 0,
          status: type === 'PRODUCTION' ? 'APPROVED' : 'DRAFT',
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

      const jobBody: any = {
        orderId: orderData.order.id,
        pdfType: type,
        paperSize: (targetPaperSize === 'SRA3' || targetPaperSize === '13x19') ? 'CUSTOM' : targetPaperSize,
        orientation: targetOrientation,
        bleed: lc.bleed,
        cropMarks: lc.cropMarks,
        foldLine: lc.foldLine,
        marginLeft: lc.marginLeft,
        marginRight: lc.marginRight,
        marginTop: lc.marginTop,
        marginBottom: lc.marginBottom,
        colGap: lc.colGap,
        rowGap: lc.rowGap,
        emptySlotStrategy: selectedStrategy,
        bypassValidation: skipValidation,
      };
      if (selectedStrategy === 'FILL_CUSTOM' && customCardId) {
        jobBody.emptySlotCustomCardId = customCardId;
      }
      if (targetPaperSize === 'SRA3') {
        jobBody.customWidth = targetOrientation === 'PORTRAIT' ? 907.09 : 1275.59;
        jobBody.customHeight = targetOrientation === 'PORTRAIT' ? 1275.59 : 907.09;
      } else if (targetPaperSize === '13x19') {
        jobBody.customWidth = targetOrientation === 'PORTRAIT' ? 936 : 1368;
        jobBody.customHeight = targetOrientation === 'PORTRAIT' ? 1368 : 936;
      }

      const jobRes = await fetch('/api/jobs/production-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobBody),
      });
      const jobData = await jobRes.json();
      if (!jobRes.ok) throw new Error(jobData.error || 'Failed to queue PDF job');

      setQJobResult({
        id: jobData.jobId,
        pdfType: type,
        status: 'PENDING',
        progress: 0,
        isLocalJob: true,
        orderId: orderData.order.id,
      });
      
      setShowCompileModal(false);
      window.dispatchEvent(new Event('refresh-profile'));
    } catch (e: any) {
      toast(e.message || 'Compile failed', 'error');
    } finally {
      setQCompiling(null);
      setShowCompileModal(false);
    }
  };

  const handleQuickCompile = async (type: 'APPROVAL' | 'PRODUCTION', cfg?: {
    paperSize: string; orientation: 'PORTRAIT'|'LANDSCAPE';
    marginLeft: number; marginRight: number; marginTop: number; marginBottom: number;
    colGap: number; rowGap: number; bleed: number; cropMarks: boolean; foldLine: boolean;
    emptySlotStrategy: EmptySlotStrategyType;
    customCardId?: string;
  }) => {
    const livePaper = cfg?.paperSize ?? wizardPaperSize;
    const liveOri = cfg?.orientation ?? wizardOrientation;
    const liveML = cfg?.marginLeft ?? wizardMarginLeft;
    const liveMR = cfg?.marginRight ?? wizardMarginRight;
    const liveMT = cfg?.marginTop ?? wizardMarginTop;
    const liveMB = cfg?.marginBottom ?? wizardMarginBottom;
    const liveCG = cfg?.colGap ?? wizardColGap;
    const liveRG = cfg?.rowGap ?? wizardRowGap;
    const liveBl = cfg?.bleed ?? wizardBleed;
    const liveCrp = cfg?.cropMarks ?? wizardCropMarks;
    const liveFl = cfg?.foldLine ?? wizardFoldLine;
    const liveStrategy = cfg?.emptySlotStrategy ?? wizardEmptySlotStrategy;
    const liveCustomId = cfg?.customCardId ?? wizardSelectedCustomCardId;
    if (!qTemplateId || selectedIds.length === 0) return;
    setQCompiling(type);
    setQJobResult(null);
    try {
      const selectedCards = cardholders.filter(c => selectedIds.includes(c.id));
      const tempRes = await fetch(`/api/templates/${qTemplateId}`);
      if (!tempRes.ok) throw new Error('Failed to fetch template details for validation');
      const tempData = await tempRes.json();
      const template = tempData.template;

      const fieldsRes = await fetch(`/api/templates/${qTemplateId}/fields`);
      if (!fieldsRes.ok) throw new Error('Failed to fetch template fields for validation');
      const fieldsData = await fieldsRes.json();
      const templateFields = fieldsData.fields || [];

      const missingList: { cardholderName: string; missingFields: string[]; cardholderId: number }[] = [];
      const requiredFields = templateFields.filter((f: any) => f.isRequired);

      for (const ch of selectedCards) {
        const missingFields: string[] = [];
        let custom: Record<string, any> = {};
        if (ch.customFields) {
          try { custom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields; } catch {}
        }
        for (const f of requiredFields) {
          let hasValue = false;
          const fieldName = f.field.toLowerCase();
          if (fieldName === 'name' || fieldName === 'fullname') {
            hasValue = !!ch.name && ch.name.trim().length > 0;
          } else if (fieldName === 'designation' || fieldName === 'role') {
            const hasCustomDesignation = Object.entries(custom).some(([k, v]) => {
              const kc = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return (kc === 'designation' || kc === 'role' || kc === 'class' || kc === 'grade' || kc === 'standard' || kc === 'position' || kc === 'post') &&
                     v !== undefined && v !== null && String(v).trim().length > 0;
            });
            hasValue = (!!ch.designation && ch.designation.trim().length > 0) || hasCustomDesignation;
          } else if (fieldName === 'photo' || fieldName === 'photourl' || fieldName === 'avatar' || fieldName === 'profile') {
            hasValue = !!ch.photoUrl && ch.photoUrl.trim().length > 0;
          } else if (fieldName === 'uniquekey' || fieldName === 'id' || f.type === 'id') {
            const hasCustomId = Object.entries(custom).some(([k, v]) => {
              const kc = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return (kc === 'uniquekey' || kc === 'id' || kc === 'unique_key') &&
                     v !== undefined && v !== null && String(v).trim().length > 0;
            });
            hasValue = (!!ch.uniqueKey && ch.uniqueKey.trim().length > 0) || hasCustomId;
          } else {
            const targetLower = f.field.toLowerCase().trim();
            let val = undefined;
            for (const [key, v] of Object.entries(custom)) {
              if (key.toLowerCase().trim() === targetLower) { val = v; break; }
            }
            hasValue = val !== undefined && val !== null && String(val).trim().length > 0;
          }
          if (!hasValue) missingFields.push(f.prefix || f.field);
        }
        if (missingFields.length > 0) {
          missingList.push({ cardholderName: ch.name || `Cardholder #${ch.id}`, missingFields, cardholderId: ch.id });
        }
      }

      let pageWidth: number;
      let pageHeight: number;
      if (livePaper === 'SRA3') {
        pageWidth = liveOri === 'PORTRAIT' ? 907.09 : 1275.59;
        pageHeight = liveOri === 'PORTRAIT' ? 1275.59 : 907.09;
      } else if (livePaper === '13x19') {
        pageWidth = liveOri === 'PORTRAIT' ? 936 : 1368;
        pageHeight = liveOri === 'PORTRAIT' ? 1368 : 936;
      } else if (livePaper === 'A4') {
        pageWidth = liveOri === 'PORTRAIT' ? 595.27 : 841.89;
        pageHeight = liveOri === 'PORTRAIT' ? 841.89 : 595.27;
      } else {
        pageWidth = liveOri === 'PORTRAIT' ? 841.89 : 1190.55;
        pageHeight = liveOri === 'PORTRAIT' ? 1190.55 : 841.89;
      }

      const bleedPt = (liveBl || 0) * 2.83464567;
      const isPortraitTemplate = (template.cardWidth || 673) < (template.cardHeight || 1039);
      const cardBaseWidth = isPortraitTemplate ? 153 : 242.6;
      const cardBaseHeight = isPortraitTemplate ? 242.6 : 153;
      const cWidth = cardBaseWidth + bleedPt * 2;
      const cHeight = cardBaseHeight + bleedPt * 2;

      const marginX = liveML; const marginXR = liveMR;
      const marginY = liveMT; const marginYB = liveMB;
      const colGap = liveCG; const rowGap = liveRG;

      const foldGap = 10;
      const isSingleSided = !template.backImageUrl || (template.backFields === '[]' || !template.backFields);
      const cols = Math.floor((pageWidth - marginX - marginXR + colGap) / (cWidth + colGap)) || 1;

      let cardsPerPage: number;
      if (isSingleSided) {
        const fullHeight = pageHeight - marginY - marginYB;
        const rowsPerPage = Math.floor((fullHeight + rowGap) / (cHeight + rowGap)) || 1;
        cardsPerPage = cols * rowsPerPage;
      } else {
        const centerY = pageHeight / 2;
        const halfHeight = centerY - Math.max(marginY, marginYB);
        const rowsPerHalf = Math.floor((halfHeight - foldGap + rowGap) / (cHeight + rowGap)) || 1;
        cardsPerPage = cols * rowsPerHalf;
      }

      const totalCards = selectedCards.length;
      const totalPages = Math.ceil(totalCards / cardsPerPage);
      const totalSlots = totalPages * cardsPerPage;

      const layoutConfig = {
        marginLeft: liveML, marginRight: liveMR,
        marginTop: liveMT, marginBottom: liveMB,
        colGap: liveCG, rowGap: liveRG,
        bleed: liveBl, cropMarks: liveCrp, foldLine: liveFl,
      };

      setValidationResult({ missingFields: missingList, totalCards, totalSlots });
      setPendingCompileType(type);
      setPendingPaperSize(livePaper);
      setPendingOrientation(liveOri);
      setPendingLayoutConfig(layoutConfig);
      setPendingCustomCardId(liveCustomId);
      setQCompiling(null);

      if (missingList.length > 0) {
        setShowValidationModal(true);
      } else if (totalSlots > totalCards && !cfg) {
        setShowEmptySlotModal(true);
      } else {
        await proceedWithQuickCompile(type, false, liveStrategy, livePaper, liveOri, layoutConfig, liveCustomId);
      }
    } catch (err: any) {
      toast(err.message || 'Validation failed', 'error');
      setQCompiling(null);
    }
  };

  useEffect(() => {
    if (!qJobResult || qJobResult.status === 'COMPLETED' || qJobResult.status === 'FAILED') return;
    // A poll that fails silently is indistinguishable from a job that is simply
    // slow: the bar sits at its last value forever. Tolerate the odd blip, then
    // say so rather than leaving the operator watching a frozen percentage.
    let consecutiveFailures = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${qJobResult.id}`);
        if (!res.ok) throw new Error(`Status check failed (HTTP ${res.status})`);
        const data = await res.json();
        if (data.success && data.job) {
          consecutiveFailures = 0;
          setQJobResult(prev => (prev && prev.pollError ? { ...prev, pollError: null } : prev));
          if (data.job.status === 'COMPLETED' && data.job.downloadUrl && !qJobResult.autoDownloaded) {
            if (!data.job.isLocalJob) {
              autoDownloadJobFile(data.job.downloadUrl, data.job.fileName);
            }
          }
          setQJobResult((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              status: data.job.status,
              progress: data.job.progress,
              errorMsg: data.job.errorMsg,
              isLocalJob: data.job.isLocalJob,
              downloadUrl: data.job.downloadUrl,
              chunkCount: data.job.chunkCount,
              chunks: data.job.chunks,
              autoDownloaded: data.job.status === 'COMPLETED' ? true : prev.autoDownloaded
            };
          });
          if (data.job.status === 'COMPLETED' || data.job.status === 'FAILED') {
            window.dispatchEvent(new Event('refresh-profile'));
            setTimeout(() => {
              setQJobResult(null);
            }, 6000);
          }
        }
      } catch (e) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 3) {
          const message = e instanceof Error ? e.message : 'Lost contact with the server.';
          setQJobResult(prev => (prev ? { ...prev, pollError: message } : prev));
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [qJobResult]);

  return {
    showCompileModal, setShowCompileModal,
    wizardStep, setWizardStep,
    wizardCompileType, setWizardCompileType,
    wizardPaperSize, setWizardPaperSize,
    wizardOrientation, setWizardOrientation,
    wizardMarginLeft, setWizardMarginLeft,
    wizardMarginRight, setWizardMarginRight,
    wizardMarginTop, setWizardMarginTop,
    wizardMarginBottom, setWizardMarginBottom,
    wizardColGap, setWizardColGap,
    wizardRowGap, setWizardRowGap,
    wizardBleed, setWizardBleed,
    wizardCropMarks, setWizardCropMarks,
    wizardFoldLine, setWizardFoldLine,
    wizardEmptySlotStrategy, setWizardEmptySlotStrategy,
    wizardCustomCards, setWizardCustomCards,
    wizardSelectedCustomCardId, setWizardSelectedCustomCardId,
    wizardUploadingCard, setWizardUploadingCard,

    qTemplateId, setQTemplateId,
    qPricePerCard, setQPricePerCard,
    qCompiling, setQCompiling,
    qJobResult, setQJobResult,
    qTemplateMixed, setQTemplateMixed,
    qDetectedTemplateName, setQDetectedTemplateName,
    
    showValidationModal, setShowValidationModal,
    showEmptySlotModal, setShowEmptySlotModal,
    validationResult, setValidationResult,
    emptySlotStrategy, setEmptySlotStrategy,
    pendingCompileType, setPendingCompileType,
    pendingPaperSize, setPendingPaperSize,
    pendingOrientation, setPendingOrientation,
    pendingLayoutConfig, setPendingLayoutConfig,
    pendingCustomCardId, setPendingCustomCardId,

    loadWizardCustomCards,
    handleWizardCustomCardUpload,
    handleWizardCustomCardDelete,
    handleOpenCompileModal,
    handleCompileIndividual,
    handleCompileTable,
    proceedWithQuickCompile,
    handleQuickCompile,
  };
}
