import os
import re

with open('src/app/dashboard/orders/page.tsx', 'r') as f:
    content = f.read()

# Extract renderBatchWizard
start_batch_wizard = content.find('const renderBatchWizard = () => {')
end_batch_wizard = content.find('  // Render full-page wizard when initializing a batch order')
code = content[start_batch_wizard:end_batch_wizard]

# Fix TS errors
code = code.replace('parsedCardholders.map((_, i) => i)', 'parsedCardholders.map((_: any, i: number) => i)')
code = code.replace('filteredCardholders.map((c) => {', 'filteredCardholders.map((c: any) => {')
code = code.replace('setSelectedPreviewIndexes(prev => [...prev, c.originalIndex]);', 'setSelectedPreviewIndexes((prev: number[]) => [...prev, c.originalIndex]);')
code = code.replace('setSelectedPreviewIndexes(prev => prev.filter(idx => idx !== c.originalIndex));', 'setSelectedPreviewIndexes((prev: number[]) => prev.filter((idx: number) => idx !== c.originalIndex));')
code = code.replace('{validationResult.missingFields.map((row, i) => (', '{validationResult.missingFields.map((row: any, i: number) => (')


# Create BatchDispatchModal.tsx
batch_dispatch_code = f"""import React, {{ useEffect, useState }} from 'react';
import Image from 'next/image';
import {{ FileText, ImageIcon, CheckCircle, AlertTriangle, Eye, ArrowLeft, Check, X, Search }} from 'lucide-react';
import CardPreview from '@/app/components/CardPreview';
import {{ formatFieldLabel }} from '@/lib/pdf/card-renderer-client';
import {{ generateApprovalPdfClient }} from '@/lib/pdf/approval-pdf-generator';
import {{ generateProductionPdfClient }} from '@/lib/pdf/production-pdf-generator';

export function BatchDispatchModal({{ 
  batchProps, 
  templates, 
  clients, 
  clientId, 
  setClientId, 
  templateId, 
  setTemplateId, 
  setShowForm, 
  setOrderMethod, 
  isOwner, 
  pricePerCard, 
  setPricePerCard, 
  taxPercent, 
  setTaxPercent,
  handleAnalyzeBatchFiles,
  handleGenerateApprovalProof,
  handleGenerateProductionPdf,
  validTill
}}: any) {{
  const {{
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
    error,
    excelFile, setExcelFile,
    zipFile, setZipFile,
    uploadStatus, setUploadStatus,
    uploadProgress,
    submitting
  }} = batchProps;

{code}

  return renderBatchWizard();
}}
"""

with open('src/app/dashboard/orders/components/BatchDispatchModal.tsx', 'w') as f:
    f.write(batch_dispatch_code)
