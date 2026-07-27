/**
 * Utility helper for resolving field values from cardholder records and customFields JSON,
 * supporting case-insensitive normalization, key alias mapping, and fallback standard fields.
 */

/**
 * Universal photo URL resolver matching the Client Directory table column logic.
 */
export function resolveCardholderPhotoUrl(
  cardholder?: {
    photoUrl?: string | null;
    customFields?: string | null | Record<string, any>;
  } | null,
  customData?: Record<string, any>
): string | null {
  if (!cardholder) return null;

  // 1. Direct photoUrl property
  if (
    cardholder.photoUrl &&
    typeof cardholder.photoUrl === 'string' &&
    cardholder.photoUrl.trim() !== '' &&
    cardholder.photoUrl !== 'null' &&
    cardholder.photoUrl !== 'undefined'
  ) {
    return cardholder.photoUrl.trim();
  }

  // 2. Custom fields
  let customObj: Record<string, any> = customData || {};
  if (!customData && cardholder.customFields) {
    if (typeof cardholder.customFields === 'string') {
      try {
        customObj = JSON.parse(cardholder.customFields);
      } catch (e) {}
    } else if (typeof cardholder.customFields === 'object') {
      customObj = cardholder.customFields || {};
    }
  }

  if (customObj && typeof customObj === 'object') {
    const photoKeys = [
      'photo',
      'photourl',
      'photo_url',
      'avatar',
      'image',
      'picture',
      'student_photo',
      'employee_photo',
      'studentphoto',
      'employeephoto',
      'pic',
      'profile',
      'profilephoto',
      'profile_photo',
      'photopath',
      'photo_path',
    ];

    // Priority search by key
    for (const key of Object.keys(customObj)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (photoKeys.includes(cleanKey)) {
        const val = customObj[key];
        if (val && typeof val === 'string' && val.trim() !== '' && val !== 'null' && val !== 'undefined') {
          return val.trim();
        }
      }
    }

    // Fallback: search values for image URLs or base64
    for (const [_, val] of Object.entries(customObj)) {
      if (val && typeof val === 'string') {
        const cleanVal = val.trim();
        if (
          cleanVal.startsWith('http://') ||
          cleanVal.startsWith('https://') ||
          cleanVal.startsWith('data:image/') ||
          cleanVal.startsWith('/uploads/') ||
          cleanVal.startsWith('uploads/') ||
          cleanVal.startsWith('/api/uploads/') ||
          cleanVal.startsWith('local://') ||
          cleanVal.startsWith('file://')
        ) {
          return cleanVal;
        }
      }
    }
  }

  return null;
}

export function isPrimaryPhotoField(fieldKey?: string): boolean {
  if (!fieldKey) return true;
  const cleanKey = fieldKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanKey) return true;

  const secondaryKeywords = [
    'signature', 'sig', 'sign',
    'logo', 'stamp', 'seal',
    'barcode', 'qrcode', 'qr',
    'back', 'bg', 'background',
    'watermark', 'badge', 'banner',
    'thumb', 'fingerprint'
  ];

  if (secondaryKeywords.some(kw => cleanKey.includes(kw))) {
    return false;
  }

  if (/^(image|photo|img|picture)[_]?\d+$/.test(cleanKey) && !cleanKey.endsWith('1')) {
    return false;
  }

  return true;
}

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
  },
  fieldType?: string
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
      'field_7',
      'field_8',
      'field_9',
      'field_10'
    ];

    return canvasPlaceholders.includes(lower);
  };

  const isIdField = targetClean === 'id' || fieldType === 'id';

  // 1. Try exact match in data object first (if not a placeholder or invalid value)
  if (data[fieldKey] !== undefined && data[fieldKey] !== null && !isPlaceholderValue(data[fieldKey])) {
    if (!isIdField || fieldKey !== 'cardSerial') {
      return data[fieldKey];
    }
  }

  // 2. Try normalized exact match in data
  for (const [k, v] of Object.entries(data)) {
    if (clean(k) === targetClean && v !== undefined && v !== null && !isPlaceholderValue(v)) {
      if (!isIdField || k !== 'cardSerial') {
        return v;
      }
    }
  }

  // 3. Try customFields JSON if passed as string or object
  let customObj: Record<string, any> = {};
  if (cardholder.customFields) {
    if (typeof cardholder.customFields === 'string') {
      try {
        customObj = JSON.parse(cardholder.customFields);
      } catch (e) {}
    } else if (typeof cardholder.customFields === 'object') {
      customObj = cardholder.customFields;
    }
  }

  // Check normalized keys in customFields
  for (const [k, v] of Object.entries(customObj)) {
    if (clean(k) === targetClean && v !== undefined && v !== null && !isPlaceholderValue(v)) {
      if (!isIdField || k !== 'cardSerial') {
        return v;
      }
    }
  }

  // 4. Standard Field Alias Resolution

  // ID resolution
  if (isIdField) {
    // Priority 1: Check if customObj has an explicit ID field
    for (const [ck, cv] of Object.entries(customObj)) {
      const ckClean = clean(ck);
      if ((ckClean === 'id' || ckClean === 'studentid' || ckClean === 'employeeid' || ckClean === 'rollno' || ckClean === 'admno') && cv && !isPlaceholderValue(cv)) {
        return cv;
      }
    }
    // Priority 2: Use cardholder's uniqueKey if set
    if (cardholder.uniqueKey && String(cardholder.uniqueKey).trim() !== '') {
      return cardholder.uniqueKey;
    }
    // Priority 3: Fall back to cardSerial if uniqueKey isn't available
    if (cardholder.cardSerial && String(cardholder.cardSerial).trim() !== '') {
      return cardholder.cardSerial;
    }
  }

  // NAME resolution fallback
  const isNameField =
    targetClean === 'name' ||
    targetClean === 'fullname' ||
    targetClean === 'studentname' ||
    targetClean === 'employeename' ||
    targetClean.includes('name');

  if (isNameField) {
    if (cardholder.name && String(cardholder.name).trim() !== '' && !isPlaceholderValue(cardholder.name)) {
      return cardholder.name;
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
    targetClean === 'picture' ||
    targetClean === 'avatar' ||
    targetClean.includes('photo') ||
    targetClean.includes('picture') ||
    targetClean.includes('avatar') ||
    (fieldType === 'image' && isPrimaryPhotoField(fieldKey));

  if (isPhotoField) {
    const resolvedPhoto = resolveCardholderPhotoUrl(cardholder, customObj);
    if (resolvedPhoto) return resolvedPhoto;
  }

  // SERIAL resolution fallback
  const isSerialField = targetClean === 'cardserial' || targetClean === 'serial' || targetClean === 'serialno';
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

export function isPlaceholderStaticValue(val: any, fieldKey?: string): boolean {
  if (val === undefined || val === null) return true;
  const str = String(val).trim();
  if (!str) return true;
  const lower = str.toLowerCase();
  
  // If fieldKey is 'id', do not treat values as placeholders unless strictly generic builder text
  if (fieldKey && (fieldKey.toLowerCase() === 'id' || fieldKey.toLowerCase().replace(/[^a-z0-9]/g, '') === 'id')) {
    return lower === 'field_1' || lower === 'static text' || lower === 'sample text';
  }

  const canvasPlaceholders = [
    'static text',
    'sample text',
    'field_1',
    'field_2',
    'field_3',
    'field_4',
    'field_5',
    'field_6',
    'field_7',
    'field_8',
    'field_9',
    'field_10'
  ];

  return canvasPlaceholders.includes(lower);
}

export function computeYOffsets(
  fields: Array<any>,
  measureTextWidth: (field: any, text: string) => number,
  getFieldValueStr: (field: any) => string
): Map<number, number> {
  const yOffsets = new Map<number, number>();

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.verticalAlign !== 'bottom') continue;

    const baseValStr = getFieldValueStr(f);
    if (!baseValStr) continue;

    const baseWidth = measureTextWidth(f, baseValStr);
    const textHeight = f.fontSize || 20;

    let shiftY = 0;
    for (let j = 0; j < i; j++) {
      const topF = fields[j];
      if (topF.verticalAlign === 'bottom') continue;

      const topValStr = getFieldValueStr(topF);
      if (!topValStr) continue;

      const topWidth = measureTextWidth(topF, topValStr);
      const leftOverlap = Math.max(f.x, topF.x);
      const rightOverlap = Math.min(f.x + baseWidth, topF.x + topWidth);

      if (leftOverlap < rightOverlap) {
        shiftY += textHeight;
      }
    }
    yOffsets.set(i, shiftY);
  }

  return yOffsets;
}
