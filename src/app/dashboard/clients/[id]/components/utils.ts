export const getCustomFieldValueCaseInsensitive = (parsedCustom: Record<string, any>, key: string): any => {
  if (!parsedCustom) return undefined;
  if (parsedCustom[key] !== undefined && parsedCustom[key] !== null) {
    return parsedCustom[key];
  }
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetClean = clean(key);
  for (const k of Object.keys(parsedCustom)) {
    if (clean(k) === targetClean) {
      return parsedCustom[k];
    }
  }
  return undefined;
};

export const getEffectivePhotoUrl = (ch: any): string | null => {
  if (!ch) return null;
  if (ch.photoUrl && typeof ch.photoUrl === 'string' && ch.photoUrl.trim() !== '' && ch.photoUrl !== 'null' && ch.photoUrl !== 'undefined') {
    return ch.photoUrl.trim();
  }
  if (ch.customFields) {
    try {
      const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
      if (parsed && typeof parsed === 'object') {
        for (const photoKey of ['photo', 'photoUrl', 'photo_url', 'avatar', 'image', 'picture', 'student_photo', 'employee_photo']) {
          const val = getCustomFieldValueCaseInsensitive(parsed, photoKey);
          if (val && typeof val === 'string' && val.trim() !== '' && val !== 'null' && val !== 'undefined') {
            return val.trim();
          }
        }
        for (const [key, val] of Object.entries(parsed)) {
          if (val && typeof val === 'string') {
            const cleanVal = val.trim();
            if (
              cleanVal.startsWith('http://') ||
              cleanVal.startsWith('https://') ||
              cleanVal.startsWith('data:image/') ||
              cleanVal.startsWith('/uploads/') ||
              cleanVal.startsWith('/api/uploads/') ||
              cleanVal.startsWith('blob:')
            ) {
              return cleanVal;
            }
          }
        }
      }
    } catch (e) {}
  }
  return null;
};
