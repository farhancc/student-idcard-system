import { useState } from 'react';
import { TemplateCategory } from '../components/constants';
import { FieldCoordinate } from '@/lib/pdf/card-renderer-client';

export function useTemplateForm() {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [cardWidth, setCardWidth] = useState(673);
  const [cardHeight, setCardHeight] = useState(1039);
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [backImageUrl, setBackImageUrl] = useState('');
  const [frontOriginalUrl, setFrontOriginalUrl] = useState('');
  const [backOriginalUrl, setBackOriginalUrl] = useState('');
  const [frontLocalPath, setFrontLocalPath] = useState('');
  const [backLocalPath, setBackLocalPath] = useState('');
  const [frontWebUrl, setFrontWebUrl] = useState('');
  const [backWebUrl, setBackWebUrl] = useState('');
  const [frontFields, setFrontFields] = useState<FieldCoordinate[]>([]);
  const [backFields, setBackFields] = useState<FieldCoordinate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [category, setCategory] = useState<TemplateCategory>('OTHER');
  const [sides, setSides] = useState<1 | 2>(1);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  
  return {
    showForm, setShowForm,
    editingTemplateId, setEditingTemplateId,
    name, setName,
    cardWidth, setCardWidth,
    cardHeight, setCardHeight,
    frontImageUrl, setFrontImageUrl,
    backImageUrl, setBackImageUrl,
    frontOriginalUrl, setFrontOriginalUrl,
    backOriginalUrl, setBackOriginalUrl,
    frontLocalPath, setFrontLocalPath,
    backLocalPath, setBackLocalPath,
    frontWebUrl, setFrontWebUrl,
    backWebUrl, setBackWebUrl,
    frontFields, setFrontFields,
    backFields, setBackFields,
    submitting, setSubmitting,
    error, setError,
    uploadingFront, setUploadingFront,
    uploadingBack, setUploadingBack,
    category, setCategory,
    sides, setSides,
    selectedClientIds, setSelectedClientIds,
    clients, setClients
  };
}
