/**
 * Utility helper for resolving field values from cardholder records and customFields JSON,
 * supporting case-insensitive normalization, key alias mapping, and fallback standard fields.
 */

/**
 * Transforms Google Drive / Google Form file upload URLs into direct, high-res renderable image URLs.
 * Handles formats like:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/thumbnail?id=FILE_ID
 * - Comma-separated multi-file uploads from Google Forms
 */
export function normalizeGoogleDriveUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  let trimmed = url.trim();
  if (!trimmed) return null;

  // Handle multi-file upload links separated by commas (e.g. Google Forms multi-file upload)
  if (trimmed.includes(',')) {
    trimmed = trimmed.split(',')[0].trim();
  }

  // Check if it's a Google Drive/Docs/usercontent link
  if (
    trimmed.includes('drive.google.com') ||
    trimmed.includes('docs.google.com') ||
    trimmed.includes('googleusercontent.com')
  ) {
    if (trimmed.includes('lh3.googleusercontent.com/d/')) {
      return trimmed;
    }

    const match = trimmed.match(/(?:file\/d\/|id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  // Convert unauthenticated Cloudflare R2 S3 endpoints to local /api/uploads proxy
  if (trimmed.includes('.r2.cloudflarestorage.com/')) {
    const key = trimmed.split('.r2.cloudflarestorage.com/')[1];
    if (key) return `/api/uploads/${key.split('?')[0]}`;
  }

  return trimmed;
}

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
    return normalizeGoogleDriveUrl(cardholder.photoUrl.trim());
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
          return normalizeGoogleDriveUrl(val.trim());
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
          cleanVal.startsWith('blob:') ||
          cleanVal.includes('drive.google.com') ||
          cleanVal.includes('docs.google.com')
        ) {
          return normalizeGoogleDriveUrl(cleanVal);
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
  let hasCustomObj = false;
  if (cardholder.customFields) {
    if (typeof cardholder.customFields === 'string') {
      try {
        customObj = JSON.parse(cardholder.customFields);
        hasCustomObj = true;
      } catch (e) {}
    } else if (typeof cardholder.customFields === 'object') {
      customObj = cardholder.customFields;
      hasCustomObj = true;
    }
  }

  // If the target field key is explicitly defined in customFields:
  if (hasCustomObj && Object.prototype.hasOwnProperty.call(customObj, fieldKey)) {
    const val = customObj[fieldKey];
    if (val !== undefined && val !== null && !isPlaceholderValue(val) && String(val).trim() !== '') {
      if (!isIdField || fieldKey !== 'cardSerial') {
        return val;
      }
    } else if (val === '' || val === null || (typeof val === 'string' && val.trim() === '')) {
      // Field was explicitly submitted empty on form. Do not fall back to other fields.
      return undefined;
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
      !isPlaceholderValue(v) &&
      String(v).trim() !== ''
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
    if (chUniqueKey && String(chUniqueKey).trim() !== '' && !String(chUniqueKey).startsWith('C-')) {
      return chUniqueKey;
    }
    // Priority 3: Fall back to cardSerial if uniqueKey isn't available and not an auto-generated C- timestamp serial
    if (cardholder.cardSerial && String(cardholder.cardSerial).trim() !== '' && !cardholder.cardSerial.startsWith('C-')) {
      return cardholder.cardSerial;
    }
    return undefined;
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
  let date: Date | null = null;
  if (dateVal instanceof Date) {
    date = dateVal;
  } else if (typeof dateVal === 'number') {
    date = new Date(dateVal);
  } else {
    // String - try parsing
    const str = String(dateVal).trim();
    
    // Check if it's in YYYY-MM-DD format (e.g. from input type="date" or ISO string)
    const matchYMD = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    // Check if it's DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const matchDMY = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    // Check if it's DD/MM/YY, DD-MM-YY, DD.MM.YY
    const matchShort = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);

    if (matchYMD) {
      const y = parseInt(matchYMD[1], 10);
      const m = parseInt(matchYMD[2], 10) - 1;
      const d = parseInt(matchYMD[3], 10);
      date = new Date(y, m, d);
    } else if (matchDMY) {
      const d = parseInt(matchDMY[1], 10);
      const m = parseInt(matchDMY[2], 10) - 1;
      const y = parseInt(matchDMY[3], 10);
      date = new Date(y, m, d);
    } else if (matchShort) {
      const d = parseInt(matchShort[1], 10);
      const m = parseInt(matchShort[2], 10) - 1;
      let y = parseInt(matchShort[3], 10);
      y += y < 50 ? 2000 : 1900;
      date = new Date(y, m, d);
    } else {
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        date = new Date(parsed);
      } else {
        return String(dateVal); // return original if not parsable
      }
    }
  }

  if (!date || isNaN(date.getTime())) {
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

export function isImageField(f: any): boolean {
  if (!f) return false;
  const t = (f.type || '').toLowerCase();
  const k = (f.field || f.key || '').toLowerCase();
  return (
    t === 'image' ||
    t === 'photo' ||
    t === 'signature' ||
    t === 'sig' ||
    t === 'logo' ||
    t === 'stamp' ||
    t === 'img' ||
    t === 'picture' ||
    t === 'static_image' ||
    t === 'static_img' ||
    k === 'photo' ||
    k === 'signature' ||
    k === 'logo' ||
    k === 'stamp'
  );
}

export function getPlaceholderImageForField(fieldKey?: string): string {
  const clean = (fieldKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Signature fields (signature, sig, sign, parent_signature, guardian_signature)
  if (clean.includes('sign') || clean.includes('sig')) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120" fill="none"><rect width="300" height="120" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="4 4"/><path d="M 40 70 Q 70 30 90 70 T 140 60 T 190 75 T 230 45 T 260 70" stroke="#1E293B" stroke-width="3" stroke-linecap="round" fill="none"/><text x="150" y="102" font-family="sans-serif" font-size="11" font-weight="600" fill="#64748B" text-anchor="middle">SPECIMEN SIGNATURE</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // 2. Stamp / Seal / Logo fields
  if (clean.includes('stamp') || clean.includes('seal') || clean.includes('logo')) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none"><rect width="160" height="160" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/><circle cx="80" cy="80" r="56" fill="none" stroke="#2563EB" stroke-width="3" stroke-dasharray="6 3"/><circle cx="80" cy="80" r="42" fill="none" stroke="#2563EB" stroke-width="1.5"/><path d="M 80 48 L 84 60 L 96 60 L 86 68 L 90 80 L 80 72 L 70 80 L 74 68 L 64 60 L 76 60 Z" fill="#2563EB"/><text x="80" y="104" font-family="sans-serif" font-size="10" font-weight="700" fill="#1E40AF" text-anchor="middle">OFFICIAL STAMP</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // 3. Guardian / Father / Mother / Parent Photo
  if (clean.includes('guardian') || clean.includes('father') || clean.includes('mother') || clean.includes('parent')) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240" fill="none"><rect width="200" height="240" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="2"/><circle cx="100" cy="85" r="40" fill="#94A3B8"/><path d="M 35 200 C 35 145, 165 145, 165 200 Z" fill="#94A3B8"/><rect x="20" y="208" width="160" height="24" rx="6" fill="#334155"/><text x="100" y="224" font-family="sans-serif" font-size="11" font-weight="700" fill="#FFFFFF" text-anchor="middle">GUARDIAN PHOTO</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // 4. Default Student / Employee Photo
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240" fill="none"><rect width="200" height="240" rx="12" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/><circle cx="100" cy="85" r="42" fill="#64748B"/><path d="M 30 205 C 30 145, 170 145, 170 205 Z" fill="#64748B"/><rect x="25" y="208" width="150" height="24" rx="6" fill="#1E293B"/><text x="100" y="224" font-family="sans-serif" font-size="11" font-weight="700" fill="#FFFFFF" text-anchor="middle">PHOTO PLACEHOLDER</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function isDateField(fieldKey?: string, fieldType?: string): boolean {
  if (fieldType && fieldType.toLowerCase() === 'date') return true;
  if (!fieldKey) return false;
  const clean = fieldKey.toLowerCase().replace(/[^a-z]/g, '');
  if (
    clean.includes('no') ||
    clean.includes('num') ||
    clean.includes('id') ||
    clean.includes('place') ||
    clean.includes('branch') ||
    clean.includes('cert')
  ) {
    return false;
  }
  return (
    clean.includes('date') ||
    clean.includes('dob') ||
    clean.includes('doj') ||
    clean.includes('expiry') ||
    clean.includes('valid') ||
    clean.includes('issue')
  );
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

  // 2. ID type fallback (ONLY for generic 'uniqueKey' or 'id' field, NOT for distinct custom fields like 'field_2' or 'rollNumber')
  const fieldClean = f.field.toLowerCase().replace(/[^a-z0-9]/g, '');
  if ((resolved === undefined || resolved === null || String(resolved).trim() === '') && (fieldClean === 'uniquekey' || fieldClean === 'id')) {
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
    const realId = cardholder?.uniqueKey || customObj.uniqueKey || customObj.id || customObj.unique_key;
    if (realId && String(realId).trim() !== '' && !String(realId).startsWith('C-')) {
      resolved = realId;
    } else if (cardholder?.cardSerial && !cardholder.cardSerial.startsWith('C-')) {
      resolved = cardholder.cardSerial;
    } else {
      resolved = undefined;
    }
  }

  // 3. Image type vs Text/Other type handling
  if (isImageField(f)) {
    // If not a valid image URL yet, try photoUrl fallback for primary photo fields
    if (!isValidImageUrl(resolved) && isPrimaryPhotoField(f.field)) {
      resolved = resolveCardholderPhotoUrl(cardholder, data) || cardholder?.photoUrl || resolved;
    }
    // If still not valid, try staticImg if provided
    if (!isValidImageUrl(resolved) && staticImg) {
      resolved = staticImg;
    }
    if (resolved && typeof resolved === 'string') {
      resolved = normalizeGoogleDriveUrl(resolved);
    }
  } else {
    // If dynamic value is empty/null, fall back to staticValue if valid and not a placeholder
    if ((resolved === undefined || resolved === null || String(resolved).trim() === '') && staticImg && !isPlaceholderStaticValue(staticImg, f.field)) {
      resolved = staticImg;
    }
    if (resolved && typeof resolved === 'string') {
      resolved = normalizeGoogleDriveUrl(resolved);
    }
  }

  const fType = (f.type || '').toLowerCase();

  // 4. Date formatting fallback
  if ((fType === 'date' || isDateField(f.field, f.type)) && resolved !== undefined && resolved !== null) {
    resolved = formatDate(resolved, f.dateFormat);
  }

  // 5. Number field min/max cap fallback
  if (fType === 'number' && resolved !== undefined && resolved !== null && String(resolved).trim() !== '') {
    let num = parseFloat(String(resolved).replace(/[^0-9.-]/g, ''));
    if (!isNaN(num)) {
      if (f.min !== undefined && f.min !== null && !isNaN(Number(f.min)) && num < Number(f.min)) {
        num = Number(f.min);
      }
      if (f.max !== undefined && f.max !== null && !isNaN(Number(f.max)) && num > Number(f.max)) {
        num = Number(f.max);
      }
      resolved = String(num);
    }
  }

  // 6. Text field min/max character cap fallback
  if ((fType === 'text' || !fType) && resolved !== undefined && resolved !== null) {
    let str = String(resolved);
    if (f.max !== undefined && f.max !== null && !isNaN(Number(f.max)) && Number(f.max) > 0 && str.length > Number(f.max)) {
      str = str.substring(0, Number(f.max));
    }
    resolved = str;
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

export function formatFieldLabel(fieldInput: string | any): string {
  if (!fieldInput) return '';
  const fieldStr = typeof fieldInput === 'string' 
    ? fieldInput 
    : (fieldInput.label || fieldInput.field || fieldInput.prefix || '');
  if (!fieldStr) return '';
  
  // Replace underscores and hyphens with spaces and strip trailing colons
  let formatted = fieldStr.replace(/[_-]+/g, ' ').replace(/:$/, '').trim();
  
  // Insert space before uppercase letters (camelCase / PascalCase)
  formatted = formatted.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  
  // Split into words, capitalize each word unless it's a short acronym (like ID, DOB)
  return formatted
    .split(' ')
    .filter(Boolean)
    .map((word: string) => {
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

