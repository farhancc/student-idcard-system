import { useState, useEffect } from 'react';
import { Cardholder, Template, Client } from '../types';

export function useBatchOrders(
  pressId: number | null, 
  templates: Template[],
  clients: Client[],
  clientId: string,
  templateId: string,
  fetchData: () => void
) {
  const [showForm, setShowForm] = useState(false);
  const [orderMethod, setOrderMethod] = useState<'standard' | 'batch'>('standard');
  const [pricePerCard, setPricePerCard] = useState('50');
  const [taxPercent, setTaxPercent] = useState('18');
  const [validTill, setValidTill] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const [batchWizardStep, setBatchWizardStep] = useState<1 | 2 | 3>(1);
  const [rosterSearch, setRosterSearch] = useState('');
  const [acceptMissingFields, setAcceptMissingFields] = useState(false);
  const [showPreviewStep, setShowPreviewStep] = useState(false);
  const [parsedCardholders, setParsedCardholders] = useState<Cardholder[]>([]);
  const [selectedPreviewIndexes, setSelectedPreviewIndexes] = useState<number[]>([]);
  const [photosMap, setPhotosMap] = useState<Map<string, { blob: Blob; url: string; dataUri?: string }>>(new Map());
  const [selectedCardholderForDetails, setSelectedCardholderForDetails] = useState<Cardholder | null>(null);
  const [selectedCardholderIndexForDetails, setSelectedCardholderIndexForDetails] = useState<number | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [detailsPreviewSide, setDetailsPreviewSide] = useState<'front' | 'back'>('front');
  const [loadedPressFonts, setLoadedPressFonts] = useState<any[]>([]);

  useEffect(() => {
    if (pressId) {
      fetch('/api/fonts', {
        headers: { 'x-press-id': String(pressId) }
      })
        .then(res => res.ok ? res.json() : null)
        .then(json => {
          if (json?.fonts) {
            setLoadedPressFonts(json.fonts);
          }
        })
        .catch(err => console.error('Failed to load press fonts for preview:', err));
    }
  }, [pressId]);

  const handleSaveCardholderEdit = () => {
    if (selectedCardholderIndexForDetails === null || !selectedCardholderForDetails) return;
    
    const name = selectedCardholderForDetails.name || '';
    const uniqueKey = selectedCardholderForDetails.uniqueKey || '';
    const imageId = selectedCardholderForDetails.imageId || '';
    const matchKey = imageId || uniqueKey || name;
    const baseSanitized = matchKey.toLowerCase().replace(/[^a-zA-Z0-9_\\-]/g, '_');
    
    let foundPhotoKey = baseSanitized;
    let hasPhoto = photosMap.has(baseSanitized);
    
    if (!hasPhoto) {
      const photoCandidates = [
        `${baseSanitized}_photo`,
        `${baseSanitized}_image`,
        `${baseSanitized}_pic`
      ];
      for (const cand of photoCandidates) {
        if (photosMap.has(cand)) {
          hasPhoto = true;
          foundPhotoKey = cand;
          break;
        }
      }
    }
    
    const photoData = photosMap.get(foundPhotoKey);
    const updatedPhotoUrl = hasPhoto && photoData ? (photoData.dataUri || photoData.url) : selectedCardholderForDetails.photoUrl;

    const updated = [...parsedCardholders];
    updated[selectedCardholderIndexForDetails] = {
      ...selectedCardholderForDetails,
      hasPhoto,
      sanitizedKey: foundPhotoKey,
      photoUrl: updatedPhotoUrl
    };
    
    setParsedCardholders(updated);
    setSelectedCardholderForDetails(updated[selectedCardholderIndexForDetails]);
    setIsEditingDetail(false);
  };

  const [paperSize, setPaperSize] = useState<'A3' | 'A4' | 'SRA3' | '13x19' | 'CUSTOM'>('A4');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [bleedMm, setBleedMm] = useState<string>('3');
  const [cropMarks, setCropMarks] = useState<boolean>(true);
  const [foldLine, setFoldLine] = useState<boolean>(true);
  const [customSheetWidthMm, setCustomSheetWidthMm] = useState<string>('320');
  const [customSheetHeightMm, setCustomSheetHeightMm] = useState<string>('450');

  const [prePrintValidationResult, setPrePrintValidationResult] = useState<{
    missingFields: Array<{ index: number; name: string; fields: string[] }>;
    totalCards: number;
    totalSlots: number;
  } | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showEmptySlotModal, setShowEmptySlotModal] = useState(false);
  const [emptySlotStrategy, setEmptySlotStrategy] = useState<'leave_blank' | 'repeat_last' | 'repeat_first'>('leave_blank');
  const [pendingGenerationType, setPendingGenerationType] = useState<'production' | null>(null);

  const getSheetDimensions = () => {
    const MM_TO_PT = 2.8346;
    switch (paperSize) {
      case 'A4':   return { w: 595.27, h: 841.89 };
      case 'A3':   return { w: 841.89, h: 1190.55 };
      case 'SRA3': return { w: 907.09, h: 1275.59 };
      case '13x19':return { w: 936,    h: 1368 };
      case 'CUSTOM': return {
        w: Number(customSheetWidthMm) * MM_TO_PT || 907.09,
        h: Number(customSheetHeightMm) * MM_TO_PT || 1275.59,
      };
      default: return { w: 907.09, h: 1275.59 };
    }
  };

  const runPrePrintValidation = (cards: any[], template: any) => {
    let frontFields: any[] = [];
    let backFields: any[] = [];
    try { frontFields = JSON.parse(template.frontFields || '[]'); } catch {}
    try { backFields = JSON.parse(template.backFields || '[]'); } catch {}
    const requiredFields = [...frontFields, ...backFields]
      .filter((f: any) => f.required || f.isRequired)
      .map((f: any) => f.field as string);

    const missingFields: Array<{ index: number; name: string; fields: string[] }> = [];
    cards.forEach((card, idx) => {
      const customData = card.customFields || {};
      const missing = requiredFields.filter(field => {
        const val = card[field] ?? customData[field];
        return !val || String(val).trim() === '';
      });
      if (missing.length > 0) {
        missingFields.push({ index: idx, name: card.name || `Record ${idx + 1}`, fields: missing });
      }
    });

    const { w: pageW, h: pageH } = getSheetDimensions();
    const bleedPt = Number(bleedMm) * 2.83464567;
    const selectedTemplate = template;
    const isPortrait = (selectedTemplate.cardWidth || 673) < (selectedTemplate.cardHeight || 1039);
    const cardBaseW = isPortrait ? 153 : 242.6;
    const cardBaseH = isPortrait ? 242.6 : 153;
    const cW = cardBaseW + bleedPt * 2;
    const cH = cardBaseH + bleedPt * 2;
    const marginX = 28.35;
    const marginY = 28.35;
    const gap = 5.67;
    const isSingleSided = !selectedTemplate.backImageUrl;
    const cols = Math.max(1, Math.floor((pageW - marginX * 2 + gap) / (cW + gap)));
    let rowsPerPage: number;
    if (isSingleSided) {
      rowsPerPage = Math.max(1, Math.floor((pageH - marginY * 2 + gap) / (cH + gap)));
    } else {
      const halfH = pageH / 2 - marginY;
      rowsPerPage = Math.max(1, Math.floor((halfH - 10 + gap) / (cH + gap)));
    }
    const cardsPerPage = cols * rowsPerPage;
    const totalPages = Math.ceil(cards.length / cardsPerPage);
    const totalSlots = totalPages * cardsPerPage;

    return { missingFields, totalCards: cards.length, totalSlots };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!clientId || !templateId) throw new Error('Client and Template must be selected');

      const chRes = await fetch(`/api/clients/${clientId}/cardholders`);
      if (!chRes.ok) throw new Error('Failed to fetch cardholders for the selected client');
      const chData = await chRes.json();
      const cardholderIds = (chData.cardholders || []).map((ch: any) => ch.id);

      if (cardholderIds.length === 0) {
        throw new Error('Selected client registry has no cardholders. Please register cardholders for this client first.');
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientId),
          templateId: Number(templateId),
          cardholderIds,
          pricePerCard: Number(pricePerCard) || 0,
          taxPercent: Number(taxPercent) || 0,
          validTill: validTill ? new Date(validTill) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create order');

      setShowForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    showForm, setShowForm,
    orderMethod, setOrderMethod,
    pricePerCard, setPricePerCard,
    taxPercent, setTaxPercent,
    validTill, setValidTill,
    excelFile, setExcelFile,
    zipFile, setZipFile,
    submitting, setSubmitting,
    error, setError,
    uploadStatus, setUploadStatus,
    uploadProgress, setUploadProgress,
    batchWizardStep, setBatchWizardStep,
    rosterSearch, setRosterSearch,
    acceptMissingFields, setAcceptMissingFields,
    showPreviewStep, setShowPreviewStep,
    parsedCardholders, setParsedCardholders,
    selectedPreviewIndexes, setSelectedPreviewIndexes,
    photosMap, setPhotosMap,
    selectedCardholderForDetails, setSelectedCardholderForDetails,
    selectedCardholderIndexForDetails, setSelectedCardholderIndexForDetails,
    isEditingDetail, setIsEditingDetail,
    detailsPreviewSide, setDetailsPreviewSide,
    loadedPressFonts, setLoadedPressFonts,
    paperSize, setPaperSize,
    orientation, setOrientation,
    bleedMm, setBleedMm,
    cropMarks, setCropMarks,
    foldLine, setFoldLine,
    customSheetWidthMm, setCustomSheetWidthMm,
    customSheetHeightMm, setCustomSheetHeightMm,
    prePrintValidationResult, setPrePrintValidationResult,
    showValidationModal, setShowValidationModal,
    showEmptySlotModal, setShowEmptySlotModal,
    emptySlotStrategy, setEmptySlotStrategy,
    pendingGenerationType, setPendingGenerationType,
    handleSaveCardholderEdit,
    getSheetDimensions,
    runPrePrintValidation,
    handleCreate
  };
}
