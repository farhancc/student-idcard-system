/**
 * Utility helper for resolving field values from cardholder records and customFields JSON,
 * supporting case-insensitive normalization, key alias mapping, and fallback standard fields.
 */
export function getResolvedFieldValue(
  fieldKey: string,
  data: Record<string, any>,
  cardholder: {
    id?: number;
    name?: string | null;
    designation?: string | null;
    photoUrl?: string | null;
    cardSerial?: string | null;
    uniqueKey?: string | null;
    customFields?: string | null | Record<string, any>;
  }
): any {
  if (!fieldKey) return undefined;

  // Helper to normalize strings for comparison (lowercase, strip non-alphanumeric)
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetClean = clean(fieldKey);

  // Checks if a value is just a generic builder placeholder string (e.g., "Field_1", "Static Text")
  const isPlaceholderValue = (val: any) => {
    if (val === undefined || val === null) return true;
    const str = String(val).trim();
    if (!str) return true;
    const lower = str.toLowerCase();
    
    // Only filter generic drag-and-drop template builder text placeholders
    const canvasPlaceholders = [
      'static text',
      'sample text',
      'field_1',
      'field_2',
      'field_3',
      'field_4',
      'field_5',
      'field_6',
      'text_1',
      'text_2',
      'text_3',
      'text_4',
      'text_5'
    ];
    if (canvasPlaceholders.includes(lower)) return true;
    if (lower.startsWith('field_') || lower.startsWith('text_')) return true;

    return false;
  };

  // Check for standard field types
  const isNameField =
    targetClean === 'name' ||
    targetClean === 'studentname' ||
    targetClean === 'employeename' ||
    targetClean === 'cardholdername' ||
    targetClean === 'fullname' ||
    targetClean === 'candidatename' ||
    targetClean === 'stname' ||
    targetClean === 'firstlastname' ||
    targetClean.includes('name');

  const isIdField =
    targetClean === 'id' ||
    targetClean === 'idnumber' ||
    targetClean === 'idno' ||
    targetClean === 'cardid' ||
    targetClean === 'cardno' ||
    targetClean === 'uniqueekey' ||
    targetClean === 'uniquekey' ||
    targetClean === 'admissionnumber' ||
    targetClean === 'rollnumber' ||
    targetClean === 'admissionno' ||
    targetClean === 'studentid' ||
    targetClean === 'employeeid' ||
    targetClean === 'regno' ||
    targetClean === 'registrationno' ||
    targetClean === 'memberid' ||
    targetClean.includes('unique') ||
    targetClean.includes('studentid') ||
    targetClean.includes('roll') ||
    targetClean.includes('admno') ||
    targetClean.includes('empid') ||
    targetClean.includes('idno') ||
    targetClean.includes('idnumber') ||
    targetClean.includes('cardid') ||
    targetClean.includes('regno');

  const isSerialField =
    targetClean === 'serial' ||
    targetClean === 'cardserial' ||
    targetClean === 'serialno' ||
    targetClean === 'serialnumber' ||
    targetClean.includes('serial');

  // Parse customFields if present
  let customObj: Record<string, any> = {};
  if (cardholder.customFields) {
    if (typeof cardholder.customFields === 'string') {
      try {
        customObj = JSON.parse(cardholder.customFields);
      } catch (e) {}
    } else if (typeof cardholder.customFields === 'object') {
      customObj = cardholder.customFields || {};
    }
  }

  // 1. Try exact match in data object first (if not a placeholder and not cardSerial for ID fields)
  if (data[fieldKey] !== undefined && data[fieldKey] !== null && !isPlaceholderValue(data[fieldKey])) {
    if (!isIdField || fieldKey !== 'cardSerial') {
      return data[fieldKey];
    }
  }

  // 2. Try normalized search across data keys
  if (targetClean) {
    for (const k of Object.keys(data)) {
      if (clean(k) === targetClean) {
        if (data[k] !== undefined && data[k] !== null && !isPlaceholderValue(data[k])) {
          if (!isIdField || k !== 'cardSerial') {
            return data[k];
          }
        }
      }
    }
  }

  // 3. Try exact match in customObj
  if (customObj[fieldKey] !== undefined && customObj[fieldKey] !== null && !isPlaceholderValue(customObj[fieldKey])) {
    return customObj[fieldKey];
  }

  // 4. Try normalized search inside customObj keys
  if (targetClean && customObj) {
    for (const [ck, cv] of Object.entries(customObj)) {
      if (clean(ck) === targetClean) {
        if (cv !== undefined && cv !== null && !isPlaceholderValue(cv)) {
          return cv;
        }
      }
    }
  }

  // 5. NAME resolution fallback
  if (isNameField) {
    if (cardholder.name && String(cardholder.name).trim() !== '' && !isPlaceholderValue(cardholder.name)) {
      return cardholder.name;
    }
    for (const [ck, cv] of Object.entries(customObj)) {
      const ckClean = clean(ck);
      if ((ckClean.includes('name') || ckClean === 'stname') && cv && !isPlaceholderValue(cv)) {
        return cv;
      }
    }
  }

  // 6. UNIQUE ID resolution fallback (Always prioritize uniqueKey and custom ID fields over cardSerial!)
  if (isIdField) {
    if (cardholder.uniqueKey && String(cardholder.uniqueKey).trim() !== '' && !isPlaceholderValue(cardholder.uniqueKey)) {
      return cardholder.uniqueKey;
    }
    // Search customObj for any key that looks like an ID / Roll / Admission / Reg Number
    for (const [ck, cv] of Object.entries(customObj)) {
      const ckClean = clean(ck);
      if (
        (ckClean.includes('id') || ckClean.includes('roll') || ckClean.includes('adm') || ckClean.includes('unique') || ckClean.includes('reg') || ckClean.includes('cardno')) &&
        cv &&
        !isPlaceholderValue(cv)
      ) {
        return cv;
      }
    }
    // Ultimate fallback for ID field if cardSerial is set and not an auto-generated random format
    if (cardholder.cardSerial && String(cardholder.cardSerial).trim() !== '' && !cardholder.cardSerial.startsWith('C-')) {
      return cardholder.cardSerial;
    }
  }

  // DESIGNATION resolution fallback
  const isDesignationField =
    targetClean === 'designation' ||
    targetClean === 'class' ||
    targetClean === 'grade' ||
    targetClean === 'role' ||
    targetClean === 'standard' ||
    targetClean.includes('designation') ||
    targetClean.includes('class');

  if (isDesignationField) {
    if (cardholder.designation && String(cardholder.designation).trim() !== '' && !isPlaceholderValue(cardholder.designation)) {
      return cardholder.designation;
    }
  }

  // PHOTO URL resolution fallback
  const isPhotoField =
    targetClean === 'photo' ||
    targetClean === 'photourl' ||
    targetClean === 'image' ||
    targetClean === 'picture' ||
    targetClean === 'avatar' ||
    targetClean.includes('photo') ||
    targetClean.includes('picture') ||
    targetClean.includes('avatar');

  if (isPhotoField) {
    if (cardholder.photoUrl && String(cardholder.photoUrl).trim() !== '') return cardholder.photoUrl;
    for (const [ck, cv] of Object.entries(customObj)) {
      if (typeof cv === 'string' && (cv.startsWith('http') || cv.startsWith('data:image'))) {
        return cv;
      }
    }
  }

  // SERIAL resolution fallback
  if (isSerialField) {
    // If customObj has explicit serial field, use it
    for (const [ck, cv] of Object.entries(customObj)) {
      const ckClean = clean(ck);
      if ((ckClean === 'cardserial' || ckClean === 'serial' || ckClean === 'serialno') && cv && !isPlaceholderValue(cv)) {
        return cv;
      }
    }
    if (cardholder.cardSerial && String(cardholder.cardSerial).trim() !== '' && !cardholder.cardSerial.startsWith('C-')) {
      return cardholder.cardSerial;
    }
    // If cardSerial is not set, fall back to uniqueKey for serial field
    if (cardholder.uniqueKey && String(cardholder.uniqueKey).trim() !== '') {
      return cardholder.uniqueKey;
    }
    if (cardholder.cardSerial && String(cardholder.cardSerial).trim() !== '') {
      return cardholder.cardSerial;
    }
  }

  // Ultimate fallback for name
  if (isNameField && cardholder.name && String(cardholder.name).trim() !== '') {
    return cardholder.name;
  }

  return undefined;
}
