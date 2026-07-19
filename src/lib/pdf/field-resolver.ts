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

  // 1. Try exact match in data object first
  if (data[fieldKey] !== undefined && data[fieldKey] !== null && String(data[fieldKey]).trim() !== '') {
    return data[fieldKey];
  }

  // Helper to normalize strings for comparison (lowercase, strip non-alphanumeric)
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetClean = clean(fieldKey);

  // 2. Try normalized search across data keys
  if (targetClean) {
    for (const k of Object.keys(data)) {
      if (clean(k) === targetClean) {
        if (data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== '') {
          return data[k];
        }
      }
    }
  }

  // Parse customFields if it's a JSON string or object
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

  // 3. Try exact match in customObj
  if (customObj[fieldKey] !== undefined && customObj[fieldKey] !== null && String(customObj[fieldKey]).trim() !== '') {
    return customObj[fieldKey];
  }

  // 4. Try normalized search inside customObj keys
  if (targetClean && customObj) {
    for (const [ck, cv] of Object.entries(customObj)) {
      if (clean(ck) === targetClean) {
        if (cv !== undefined && cv !== null && String(cv).trim() !== '') {
          return cv;
        }
      }
    }
  }

  // 5. Fallbacks for standard fields:
  // NAME resolution
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

  if (isNameField) {
    if (cardholder.name && String(cardholder.name).trim() !== '') {
      return cardholder.name;
    }
    // Check if customFields has any key matching name
    for (const [ck, cv] of Object.entries(customObj)) {
      const ckClean = clean(ck);
      if ((ckClean.includes('name') || ckClean === 'stname') && cv && String(cv).trim() !== '') {
        return cv;
      }
    }
  }

  // DESIGNATION resolution
  const isDesignationField =
    targetClean === 'designation' ||
    targetClean === 'class' ||
    targetClean === 'grade' ||
    targetClean === 'role' ||
    targetClean === 'standard' ||
    targetClean.includes('designation') ||
    targetClean.includes('class');

  if (isDesignationField) {
    if (cardholder.designation && String(cardholder.designation).trim() !== '') {
      return cardholder.designation;
    }
  }

  // UNIQUE ID resolution
  const isIdField =
    targetClean === 'id' ||
    targetClean === 'uniqueekey' ||
    targetClean === 'uniquekey' ||
    targetClean === 'admissionnumber' ||
    targetClean === 'rollnumber' ||
    targetClean === 'admissionno' ||
    targetClean === 'studentid' ||
    targetClean === 'employeeid' ||
    targetClean.includes('unique') ||
    targetClean.includes('studentid') ||
    targetClean.includes('rollno') ||
    targetClean.includes('admno') ||
    targetClean.includes('empid');

  if (isIdField) {
    if (cardholder.uniqueKey && String(cardholder.uniqueKey).trim() !== '') return cardholder.uniqueKey;
    if (cardholder.id) return String(cardholder.id);
  }

  // PHOTO URL resolution
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

  // SERIAL resolution
  const isSerialField =
    targetClean === 'serial' ||
    targetClean === 'cardserial' ||
    targetClean === 'serialno' ||
    targetClean.includes('serial');

  if (isSerialField) {
    if (cardholder.cardSerial && String(cardholder.cardSerial).trim() !== '') return cardholder.cardSerial;
  }

  // 6. Ultimate fallback for name if field is name-related
  if (cardholder.name && String(cardholder.name).trim() !== '') {
    if (targetClean === 'name' || targetClean === 'studentname' || targetClean === 'employeename' || targetClean.includes('name')) {
      return cardholder.name;
    }
  }

  return undefined;
}
