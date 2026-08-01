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

    // Fallback: search values for image URLs or base64 (excluding secondary image fields like signature/logo)
    for (const [key, val] of Object.entries(customObj)) {
      if (val && typeof val === 'string') {
        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (['signature', 'sig', 'sign', 'logo', 'stamp', 'seal', 'barcode', 'qrcode', 'qr', 'badge', 'thumb'].some(k => cleanKey.includes(k))) {
          continue;
        }
        const cleanVal = val.trim();
        if (
          cleanVal.startsWith('http://') ||
          cleanVal.startsWith('https://') ||
          cleanVal.startsWith('data:image/') ||
          cleanVal.startsWith('/uploads/') ||
          cleanVal.startsWith('uploads/') ||
          cleanVal.startsWith('/api/uploads/') ||
          cleanVal.startsWith('local://') ||
          cleanVal.startsWith('file://') ||
          cleanVal.startsWith('blob:')
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

  // Check normalized keys in customFields (exact & partial matching)
  for (const [k, v] of Object.entries(customObj)) {
    const ckClean = clean(k);
    if (
      (ckClean === targetClean ||
        (targetClean.length >= 3 && (ckClean.includes(targetClean) || targetClean.includes(ckClean)))) &&
      v !== undefined &&
      v !== null &&
      !isPlaceholderValue(v)
    ) {
      if (!isIdField || k !== 'cardSerial') {
        return v;
      }
    }
  }

  // 4. Standard Field Alias Resolution

  // SIGNATURE / SECONDARY IMAGE resolution
  const isSignatureField = targetClean.includes('sig') || targetClean.includes('sign') || targetClean.includes('signature');
  if (isSignatureField) {
    for (const [ck, cv] of Object.entries(customObj)) {
      const ckClean = clean(ck);
      if ((ckClean.includes('sig') || ckClean.includes('sign') || ckClean.includes('signature')) && cv && !isPlaceholderValue(cv)) {
        return cv;
      }
    }
  }

  // ID resolution
  if (isIdField) {
    // Priority 1: Check if customObj has an explicit ID field
    for (const [ck, cv] of Object.entries(customObj)) {
      const ckClean = clean(ck);
      if ((ckClean === 'id' || ckClean === 'studentid' || ckClean === 'employeeid' || ckClean === 'rollno' || ckClean === 'admno') && cv && !isPlaceholderValue(cv)) {
        return cv;
      }
    }
    // Priority 2: Use cardholder's uniqueKey if set (fallback to customFields keys)
    const chUniqueKey = cardholder.uniqueKey || customObj.uniqueKey || customObj.id || customObj.unique_key;
    if (chUniqueKey && String(chUniqueKey).trim() !== '') {
      return chUniqueKey;
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
    const designationAliases = ['designation', 'role', 'class', 'grade', 'standard', 'position', 'post', 'jobtitle'];
    for (const alias of designationAliases) {
      for (const [k, v] of Object.entries(customObj)) {
        if (clean(k) === clean(alias) && v !== undefined && v !== null && String(v).trim() !== '' && !isPlaceholderValue(v)) {
          return String(v).trim();
        }
      }
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
    const chUniqueKeyFallback = cardholder.uniqueKey || customObj.uniqueKey || customObj.id || customObj.unique_key;
    if (chUniqueKeyFallback && String(chUniqueKeyFallback).trim() !== '') {
      return chUniqueKeyFallback;
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

  if (
    lower.includes('images.unsplash.com') ||
    lower.includes('via.placeholder.com') ||
    lower === 'sample image' ||
    lower === 'placeholder'
  ) {
    return true;
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
    'field_10',
    'text_1',
    'text_2',
    'text_3',
    'text_4',
    'text_5'
  ];

  if (canvasPlaceholders.includes(lower)) return true;
  if (lower.startsWith('field_') || lower.startsWith('text_')) return true;

  return false;
}

export function isValidImageUrl(val: any): boolean {
  if (typeof val !== 'string' || !val.trim()) return false;
  const lower = val.toLowerCase().trim();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('/uploads/') ||
    lower.startsWith('uploads/') ||
    lower.startsWith('/api/uploads/') ||
    lower.startsWith('local://') ||
    lower.startsWith('file://') ||
    lower.startsWith('blob:')
  );
}

export function formatDate(dateVal: any, formatStr?: string): string {
  if (dateVal === undefined || dateVal === null || String(dateVal).trim() === '') return '';
  let date: Date;
  if (dateVal instanceof Date) {
    date = dateVal;
  } else if (typeof dateVal === 'number') {
    date = new Date(dateVal);
  } else {
    // String - try parsing
    const parsed = Date.parse(String(dateVal));
    if (isNaN(parsed)) {
      // Try parsing DD/MM/YYYY or DD-MM-YYYY manually if standard parse fails
      const str = String(dateVal).trim();
      const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (match) {
        // Assume day, month, year
        const d = parseInt(match[1], 10);
        const m = parseInt(match[2], 10) - 1;
        const y = parseInt(match[3], 10);
        date = new Date(y, m, d);
      } else {
        return String(dateVal); // return original if not parsable
      }
    } else {
      date = new Date(parsed);
    }
  }

  if (isNaN(date.getTime())) {
    return String(dateVal);
  }

  const format = formatStr || 'DD/MM/YYYY';
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const yyyy = date.getFullYear();
  const yy = String(yyyy).slice(-2);
  const m = date.getMonth(); // 0-11
  const mm = pad(m + 1);
  const d = date.getDate();
  const dd = pad(d);

  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const mmm = monthsShort[m];
  const mmmm = monthsLong[m];

  return format
    .replace(/YYYY/g, String(yyyy))
    .replace(/YY/g, yy)
    .replace(/MMMM/g, mmmm)
    .replace(/MMM/g, mmm)
    .replace(/MM/g, mm)
    .replace(/DD/g, dd)
    .replace(/\bD\b/g, String(d))
    .replace(/\bM\b/g, String(m + 1));
}

export function resolveFieldRawValue(
  f: { field: string; type?: string; staticValue?: string | null; prefix?: string; suffix?: string; dateFormat?: string; [key: string]: any },
  data: Record<string, any>,
  cardholder: {
    id?: number;
    name?: string | null;
    designation?: string | null;
    photoUrl?: string | null;
    cardSerial?: string | null;
    uniqueKey?: string | null;
    customFields?: string | null | Record<string, any>;
  } | null | undefined
): any {
  if (!f || !f.field) return undefined;

  const staticImg = f.staticValue || (f as any).imageUrl || (f as any).sampleValue || (f as any).value || (f as any).src || (f as any).url || (f as any).defaultUrl || (f as any).defaultValue;

  // 1. Try dynamic cardholder resolution first
  let resolved = getResolvedFieldValue(f.field, data, cardholder || {}, f.type);

  // 2. ID type fallback
  if ((resolved === undefined || resolved === null || String(resolved).trim() === '') && f.type === 'id') {
    let customObj: Record<string, any> = {};
    if (cardholder?.customFields) {
      if (typeof cardholder.customFields === 'string') {
        try {
          customObj = JSON.parse(cardholder.customFields);
        } catch (e) {}
      } else if (typeof cardholder.customFields === 'object') {
        customObj = cardholder.customFields;
      }
    }
    resolved = cardholder?.uniqueKey || customObj.uniqueKey || customObj.id || customObj.unique_key || cardholder?.cardSerial || '';
  }

  // 3. Image type vs Text/Other type handling
  if (f.type === 'image') {
    // If not a valid image URL yet, try photoUrl fallback for primary photo fields
    if (!isValidImageUrl(resolved) && isPrimaryPhotoField(f.field)) {
      resolved = resolveCardholderPhotoUrl(cardholder, data) || cardholder?.photoUrl || resolved;
    }
    // If still not valid, try staticImg if provided
    if (!isValidImageUrl(resolved) && staticImg) {
      resolved = staticImg;
    }
  } else {
    // If dynamic value is empty/null, fall back to staticValue if valid and not a placeholder
    if ((resolved === undefined || resolved === null || String(resolved).trim() === '') && staticImg && !isPlaceholderStaticValue(staticImg, f.field)) {
      resolved = staticImg;
    }
  }

  // 4. Date formatting fallback
  if (f.type === 'date' && resolved !== undefined && resolved !== null) {
    resolved = formatDate(resolved, f.dateFormat);
  }

  return resolved;
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

export function formatFieldLabel(field: string): string {
  if (!field) return '';
  
  // Replace underscores and hyphens with spaces
  let formatted = field.replace(/[_-]+/g, ' ');
  
  // Insert space before uppercase letters (camelCase / PascalCase)
  // but don't insert space if it's already separated or between multiple uppercase letters
  formatted = formatted.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  
  // Split into words, capitalize each word unless it's a short acronym (like ID, DOB)
  return formatted
    .split(' ')
    .filter(Boolean)
    .map(word => {
      // If the word is entirely uppercase
      if (word === word.toUpperCase()) {
        if (word.length <= 3) return word; // Keep DOB, ID, etc.
        return word.charAt(0) + word.slice(1).toLowerCase();
      }
      // If the word has mixed case (e.g. CamelCase or already capitalized)
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

