import { useState, useMemo } from 'react';
import { Cardholder } from '../types';
import { getResolvedFieldValue, isPlaceholderStaticValue, formatFieldLabel, normalizeGoogleDriveUrl } from '@/lib/pdf/card-renderer-client';

export function useCardholderFilters(cardholders: Cardholder[], clientTemplates: any[]) {
  const [search, setSearch] = useState('');
  const [searchId, setSearchId] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterWarningsOnly, setFilterWarningsOnly] = useState(false);

  const getCardholderWarnings = (ch: Cardholder) => {
    const warnings: string[] = [];

    // Parse custom fields safely
    let parsedCustom: Record<string, any> = {};
    if (ch.customFields) {
      try {
        parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
      } catch (e) {}
    }

    const cardholderData = {
      name: ch.name,
      designation: ch.designation,
      uniqueKey: ch.uniqueKey || parsedCustom.uniqueKey || parsedCustom.id || parsedCustom.unique_key || '',
      photoUrl: ch.photoUrl,
      cardSerial: ch.cardSerial,
      customFields: parsedCustom
    };

    // Find template by resolvedTemplateId, templateId, or templateName (using robust string/number & version matching)
    const tmpl = clientTemplates.find(t => 
                   String(t.id) === String(ch.resolvedTemplateId) || 
                   String(t.id) === String((ch as any).templateId)
                 ) || 
                 clientTemplates.find(t => 
                   t.name && ch.templateName && 
                   t.name.trim().toLowerCase().replace(/\s*\(v\d+(\.\d+)?\)$/i, '') === 
                   ch.templateName.trim().toLowerCase().replace(/\s*\(v\d+(\.\d+)?\)$/i, '')
                 ) ||
                 clientTemplates[0];

    // Fallback baseline checks when no template is matched
    if (!tmpl) {
      if (!ch.name || ch.name.trim() === '') warnings.push('Name is required');
      if (!ch.photoUrl || ch.photoUrl.trim() === '') warnings.push('Photo is missing');
      if (!ch.designation || ch.designation.trim() === '') warnings.push('Designation is missing');
      const rawId = ch.uniqueKey || parsedCustom.id || parsedCustom.uniqueKey || parsedCustom.unique_key;
      if (!rawId || String(rawId).trim() === '' || String(rawId).startsWith('C-')) warnings.push('ID is missing');
      return warnings;
    }

    try {
      const front = JSON.parse(tmpl.frontFields || '[]');
      const back = JSON.parse(tmpl.backFields || '[]');
      const allFields: any[] = [...front, ...back];

      const checkedFields = new Set<string>();

      allFields.forEach((f: any) => {
        if (!f || !f.field) return;

        // Only skip if explicitly marked as a static canvas graphic/label (type === 'static_text' || type === 'static_image' || isStatic === true)
        if (f.isStatic === true || f.type === 'static_text' || f.type === 'static_image') {
          return;
        }

        // Skip auto-generated system metadata fields
        const fieldClean = f.field.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (fieldClean === 'validtill' || fieldClean === 'validtilldate' || fieldClean === 'cardserial') {
          return;
        }

        // Avoid duplicate warnings for fields placed multiple times on canvas
        if (checkedFields.has(f.field)) return;
        checkedFields.add(f.field);

        // Standard name field check
        if (fieldClean === 'name' || fieldClean === 'fullname' || fieldClean === 'studentname' || f.isName) {
          const nameVal = getResolvedFieldValue(f.field, cardholderData, ch) || ch.name;
          if (!nameVal || String(nameVal).trim() === '') {
            warnings.push('Name is required');
          }
          return;
        }

        // Standard designation field check
        if (fieldClean === 'designation' || fieldClean === 'role') {
          const desVal = getResolvedFieldValue(f.field, cardholderData, ch) || ch.designation;
          if (!desVal || String(desVal).trim() === '') {
            warnings.push('Designation is missing');
          }
          return;
        }

        // ── ID / Unique Key check ───────────────────────────────────────────
        const isIdField = f.type === 'id' || 
          fieldClean === 'uniquekey' || fieldClean === 'id' || 
          fieldClean === 'studentid' || fieldClean === 'empid' || fieldClean === 'employeeid' ||
          fieldClean === 'rollnumber' || fieldClean === 'rollno' || fieldClean === 'admissionnumber' || fieldClean === 'admno' ||
          fieldClean.endsWith('id') || fieldClean.startsWith('id') || fieldClean.includes('idnumber');

        if (isIdField) {
          const valInCustom = parsedCustom[f.field];
          const idVal = (valInCustom !== undefined && valInCustom !== null && String(valInCustom).trim() !== '')
            ? valInCustom
            : (getResolvedFieldValue(f.field, cardholderData, ch, f.type) || (f.field === 'uniqueKey' ? ch.uniqueKey : null));
          if (!idVal || String(idVal).trim() === '' || String(idVal).startsWith('C-') || String(idVal) === 'null' || String(idVal) === 'undefined') {
            const label = formatFieldLabel(f) || 'ID';
            warnings.push(`${label} is missing`);
          }
          return;
        }

        // Image field check (profile photo or custom image like signature)
        if (f.type === 'image' || f.type === 'photo' || fieldClean.includes('photo') || fieldClean.includes('avatar') || fieldClean.includes('signature')) {
          const imgVal = getResolvedFieldValue(f.field, cardholderData, ch) || (fieldClean.includes('photo') || fieldClean.includes('avatar') || fieldClean.includes('profile') ? ch.photoUrl : null);
          if (!imgVal || String(imgVal).trim() === '' || String(imgVal) === 'null' || String(imgVal) === 'undefined') {
            const label = formatFieldLabel(f);
            warnings.push(`${label} is missing`);
          }
          return;
        }

        // ── All other fields: text, number, date, etc. ──────────────────────
        const val = getResolvedFieldValue(f.field, cardholderData, ch);
        const valStr = val === undefined || val === null ? '' : String(val).trim();
        if (valStr === '' || valStr === 'null' || valStr === 'undefined') {
          const label = formatFieldLabel(f);
          warnings.push(`${label} is missing`);
        }
      });

      // ── Any custom fields present in cardholder data that are empty (only fallback if allFields is empty) ──────
      if (allFields.length === 0) {
        Object.entries(parsedCustom).forEach(([k, v]) => {
          const kClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (kClean === 'validtill' || kClean === 'validtilldate' || kClean === 'cardserial') return;
          if (checkedFields.has(k) || checkedFields.has(kClean)) return;
          checkedFields.add(k);

          const valStr = v === undefined || v === null ? '' : String(v).trim();
          if (valStr === '' || valStr === 'null' || valStr === 'undefined') {
            const label = formatFieldLabel(k);
            if (label) {
              warnings.push(`${label} is missing`);
            }
          }
        });
      }
    } catch (e) {
      console.error('Error validating cardholder', e);
    }
    
    return warnings;
  };

  const filteredCardholders = useMemo(() => {
    return cardholders.filter((c: any) => {
      // 1. General search: Name, Designation
      const matchesSearch = !search.trim() || 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.designation && c.designation.toLowerCase().includes(search.toLowerCase()));

      // 2. ID / Unique key search (searchId)
      const matchesSearchId = !searchId.trim() || (() => {
        const custom = c.customFields ? (typeof c.customFields === 'string' ? JSON.parse(c.customFields) : c.customFields) : {};
        const idVal = c.uniqueKey || custom.uniqueKey || custom.id || custom.unique_key || '';
        return String(idVal).toLowerCase().includes(searchId.toLowerCase());
      })();

      // 3. Template filter
      const matchesTemplate = !filterTemplate ||
        String(c.resolvedTemplateId) === filterTemplate ||
        (c.templateName && c.templateName.toLowerCase() === filterTemplate.toLowerCase());

      // 4. Date range filter (filterStartDate and filterEndDate are 'YYYY-MM-DD')
      let matchesDate = true;
      if (filterStartDate || filterEndDate) {
        const chDate = new Date(c.createdAt).toLocaleDateString('en-CA');
        if (filterStartDate && chDate < filterStartDate) {
          matchesDate = false;
        }
        if (filterEndDate && chDate > filterEndDate) {
          matchesDate = false;
        }
      }

      // 5. Warnings filter
      const matchesWarnings = !filterWarningsOnly || getCardholderWarnings(c).length > 0;

      return matchesSearch && matchesSearchId && matchesTemplate && matchesDate && matchesWarnings;
    });
  }, [cardholders, search, searchId, filterTemplate, filterStartDate, filterEndDate, filterWarningsOnly, clientTemplates]);

  return {
    search, setSearch,
    searchId, setSearchId,
    filterTemplate, setFilterTemplate,
    filterStartDate, setFilterStartDate,
    filterEndDate, setFilterEndDate,
    filterWarningsOnly, setFilterWarningsOnly,
    filteredCardholders,
    getCardholderWarnings
  };
}

export function getTemplateColumns(tmpl: any) {
  if (!tmpl) return [];
  try {
    const front = JSON.parse(tmpl.frontFields || '[]');
    const back = JSON.parse(tmpl.backFields || '[]');
    const all = [...front, ...back];
    
    const seen = new Set<string>();
    const cols: { key: string; label: string; type: string }[] = [];

    all.forEach((f: any) => {
      if (!f.field || seen.has(f.field) || f.type === 'qr' || f.type === 'barcode') return;
      seen.add(f.field);

      let label = (f.label || f.name || f.field).trim();
      if (!f.label && !f.name) {
        label = formatFieldLabel(f.field);
      }

      cols.push({
        key: f.field,
        label,
        type: f.type || 'text',
      });
    });

    return cols;
  } catch (e) {
    return [];
  }
}

export function getFieldValue(ch: any, colKey: string, getCustomFieldValueCaseInsensitive: any, getEffectivePhotoUrl: any): string {
  if (!ch) return '';
  if (colKey === 'name' || colKey === 'fullName') return (ch.name !== 'Cardholder' ? ch.name : '') || '';
  if (colKey === 'designation' || colKey === 'role') return ch.designation || '';
  if (colKey === 'photoUrl' || colKey === 'photo' || colKey === 'avatar') return getEffectivePhotoUrl(ch) || '';

  const cleanKey = colKey.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (ch.customFields) {
    try {
      const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
      const val = getCustomFieldValueCaseInsensitive ? getCustomFieldValueCaseInsensitive(parsed, colKey) : parsed[colKey];
      if (val !== undefined && val !== null && String(val).trim() !== '' && String(val) !== 'null' && String(val) !== 'undefined') {
        const strVal = String(val).trim();
        return normalizeGoogleDriveUrl(strVal) || strVal;
      }
    } catch (e) {}
  }

  if (colKey === 'uniqueKey' || cleanKey === 'uniquekey' || cleanKey === 'id' || cleanKey === 'unique_key') {
    const custom = ch.customFields ? (typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields) : {};
    const rawId = ch.uniqueKey || custom.uniqueKey || custom.id || custom.unique_key;
    if (rawId && !String(rawId).startsWith('C-') && String(rawId) !== 'null' && String(rawId) !== 'undefined') {
      return String(rawId);
    }
  }

  if (cleanKey.includes('photo') || cleanKey.includes('avatar') || cleanKey.includes('image') || cleanKey.includes('picture')) {
    return getEffectivePhotoUrl(ch) || '';
  }

  return '';
}
