import { useState, useMemo } from 'react';
import { Cardholder } from '../types';
import { getResolvedFieldValue, isPlaceholderStaticValue, formatFieldLabel } from '@/lib/pdf/card-renderer-client';

export function useCardholderFilters(cardholders: Cardholder[], clientTemplates: any[]) {
  const [search, setSearch] = useState('');
  const [searchId, setSearchId] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterWarningsOnly, setFilterWarningsOnly] = useState(false);

  const getCardholderWarnings = (ch: Cardholder) => {
    const warnings: string[] = [];
    
    // Find the template by resolvedTemplateId or templateName
    const tmpl = clientTemplates.find(t => t.id === ch.resolvedTemplateId) || 
                 clientTemplates.find(t => t.name === ch.templateName) ||
                 clientTemplates[0];
                 
    if (!tmpl) return [];
    
    try {
      const front = JSON.parse(tmpl.frontFields || '[]');
      const back = JSON.parse(tmpl.backFields || '[]');
      const allFields: any[] = [...front, ...back];

      // Parse custom fields
      let parsedCustom: Record<string, any> = {};
      if (ch.customFields) {
        parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
      }

      const cardholderData = {
        name: ch.name,
        designation: ch.designation,
        uniqueKey: ch.uniqueKey || parsedCustom.uniqueKey || parsedCustom.id || parsedCustom.unique_key || '',
        photoUrl: ch.photoUrl,
        cardSerial: ch.cardSerial,
        customFields: parsedCustom
      };

      const checkedFields = new Set<string>();

      allFields.forEach((f: any) => {
        if (!f || !f.field) return;

        // Skip static text/image overrides explicitly hardcoded on template background canvas
        if (f.staticValue !== undefined && f.staticValue !== null && !isPlaceholderStaticValue(f.staticValue, f.field)) {
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
        if (fieldClean === 'name' || fieldClean === 'fullname' || fieldClean === 'studentname') {
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
        // IMPORTANT: Do NOT fall back to cardSerial here — cardSerial is
        // auto-generated and is NOT a user-provided ID. If it's the only
        // thing present, the ID field is genuinely missing for the user.
        if (f.type === 'id' || fieldClean === 'uniquekey' || fieldClean === 'id' || fieldClean === 'studentid' || fieldClean === 'rollnumber' || fieldClean === 'admissionnumber' || fieldClean.includes('id')) {
          const idFromCustom = parsedCustom.uniqueKey || parsedCustom.id || parsedCustom.unique_key ||
            Object.entries(parsedCustom).find(([k]) => {
              const kc = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return kc === 'id' || kc === 'studentid' || kc === 'rollno' || kc === 'rollnumber' || kc === 'admno' || kc === 'admissionnumber' || kc === 'empid' || kc === 'employeeid';
            })?.[1];
          const idVal = ch.uniqueKey || idFromCustom;
          if (!idVal || String(idVal).trim() === '' || String(idVal).startsWith('C-') || String(idVal) === 'null' || String(idVal) === 'undefined') {
            const label = formatFieldLabel(f.field) || 'ID';
            warnings.push(`${label} is missing`);
          }
          return;
        }

        // Image field check (profile photo or custom image like signature)
        if (f.type === 'image') {
          const imgVal = getResolvedFieldValue(f.field, cardholderData, ch) || (fieldClean.includes('photo') || fieldClean.includes('avatar') || fieldClean.includes('profile') ? ch.photoUrl : null);
          if (!imgVal || String(imgVal).trim() === '' || String(imgVal) === 'null' || String(imgVal) === 'undefined') {
            const label = formatFieldLabel(f.field);
            warnings.push(`${label} is missing`);
          }
          return;
        }

        // ── All other fields: text, number, date, etc. ──────────────────────
        // Use resolveFieldRawValue to match the exact same resolution as the renderer
        const val = getResolvedFieldValue(f.field, cardholderData, ch);
        const valStr = val === undefined || val === null ? '' : String(val).trim();
        if (valStr === '' || valStr === 'null' || valStr === 'undefined') {
          const label = formatFieldLabel(f.field);
          warnings.push(`${label} is missing`);
        }
      });
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
  if (colKey === 'name' || colKey === 'fullName') return ch.name || '';
  if (colKey === 'designation' || colKey === 'role') return ch.designation || '';
  if (colKey === 'uniqueKey') {
    const custom = ch.customFields ? (typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields) : {};
    return ch.uniqueKey || custom.uniqueKey || custom.id || custom.unique_key || '';
  }
  if (colKey === 'photoUrl' || colKey === 'photo' || colKey === 'avatar') return getEffectivePhotoUrl(ch) || '';

  if (ch.customFields) {
    try {
      const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
      const val = getCustomFieldValueCaseInsensitive(parsed, colKey);
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
    } catch (e) {}
  }

  const cleanKey = colKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanKey.includes('photo') || cleanKey.includes('avatar') || cleanKey.includes('image') || cleanKey.includes('picture')) {
    return getEffectivePhotoUrl(ch) || '';
  }

  return '';
}
