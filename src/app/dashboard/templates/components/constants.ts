export const TEMPLATE_CATEGORIES = [
  'ID_CARD', 'CERTIFICATE', 'BADGE', 'LABEL', 'TICKET',
  'VISITOR_PASS', 'LETTER', 'CARD', 'TAG', 'STICKER', 'OTHER',
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  ID_CARD: 'ID Card',
  CERTIFICATE: 'Certificate',
  BADGE: 'Badge',
  LABEL: 'Label',
  TICKET: 'Ticket',
  VISITOR_PASS: 'Visitor Pass',
  LETTER: 'Letter',
  CARD: 'Card',
  TAG: 'Tag',
  STICKER: 'Sticker',
  OTHER: 'Other',
};

export const CATEGORY_COLORS: Record<TemplateCategory, { bg: string; color: string; border: string }> = {
  ID_CARD:      { bg: 'rgba(79,70,229,0.18)',  color: '#818cf8', border: 'rgba(79,70,229,0.4)' },
  CERTIFICATE:  { bg: 'rgba(245,158,11,0.18)', color: '#fbbf24', border: 'rgba(245,158,11,0.4)' },
  BADGE:        { bg: 'rgba(16,185,129,0.18)', color: '#34d399', border: 'rgba(16,185,129,0.4)' },
  LABEL:        { bg: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: 'rgba(59,130,246,0.4)' },
  TICKET:       { bg: 'rgba(236,72,153,0.18)', color: '#f472b6', border: 'rgba(236,72,153,0.4)' },
  VISITOR_PASS: { bg: 'rgba(20,184,166,0.18)', color: '#2dd4bf', border: 'rgba(20,184,166,0.4)' },
  LETTER:       { bg: 'rgba(107,114,128,0.2)', color: '#9ca3af', border: 'rgba(107,114,128,0.4)' },
  CARD:         { bg: 'rgba(239,68,68,0.18)',  color: '#f87171', border: 'rgba(239,68,68,0.4)' },
  TAG:          { bg: 'rgba(251,191,36,0.18)', color: '#fde68a', border: 'rgba(251,191,36,0.4)' },
  STICKER:      { bg: 'rgba(167,139,250,0.2)', color: '#c4b5fd', border: 'rgba(167,139,250,0.4)' },
  OTHER:        { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: 'rgba(255,255,255,0.15)' },
};

// Default dimensions at 300 DPI for each category (width x height in pixels)
export const CATEGORY_DIMENSIONS: Record<TemplateCategory, { w: number; h: number; label: string }> = {
  ID_CARD:      { w: 1013, h: 638,  label: '85.6 × 54 mm (CR80)' },
  CERTIFICATE:  { w: 3508, h: 2480, label: '297 × 210 mm (A4 Landscape)' },
  BADGE:        { w: 756,  h: 1134, label: '64 × 96 mm' },
  LABEL:        { w: 945,  h: 472,  label: '80 × 40 mm' },
  TICKET:       { w: 2244, h: 945,  label: '190 × 80 mm' },
  VISITOR_PASS: { w: 1013, h: 638,  label: '85.6 × 54 mm (CR80)' },
  LETTER:       { w: 2480, h: 3508, label: '210 × 297 mm (A4 Portrait)' },
  CARD:         { w: 1063, h: 688,  label: '90 × 58 mm' },
  TAG:          { w: 591,  h: 945,  label: '50 × 80 mm' },
  STICKER:      { w: 945,  h: 945,  label: '80 × 80 mm' },
  OTHER:        { w: 673,  h: 1039, label: '57 × 88 mm' },
};
