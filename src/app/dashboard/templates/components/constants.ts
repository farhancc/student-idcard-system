import { lengthToPx } from '@/lib/units';

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

/**
 * The physical size of each category's stock, in millimetres. This is the
 * definition — an ID card really is ISO/IEC 7810 ID-1, 85.6 x 53.98 mm — and
 * the 300 DPI pixels below are derived from it.
 *
 * Previously the pixels were hand-written alongside a hand-written millimetre
 * label, and the two had drifted: ID_CARD was 1013 px, which is 3.375 in (the
 * US approximation of CR80) rather than the 85.6 mm its own label claimed.
 */
const CATEGORY_SIZES_MM: Record<TemplateCategory, { w: number; h: number; name?: string }> = {
  ID_CARD:      { w: 85.6, h: 53.98, name: 'CR80' },
  CERTIFICATE:  { w: 297,  h: 210,   name: 'A4 Landscape' },
  BADGE:        { w: 64,   h: 96 },
  LABEL:        { w: 80,   h: 40 },
  TICKET:       { w: 190,  h: 80 },
  VISITOR_PASS: { w: 85.6, h: 53.98, name: 'CR80' },
  LETTER:       { w: 210,  h: 297,   name: 'A4 Portrait' },
  CARD:         { w: 90,   h: 58 },
  TAG:          { w: 50,   h: 80 },
  STICKER:      { w: 80,   h: 80 },
  OTHER:        { w: 57,   h: 88 },
};

/** Default card size per category, in the 300 DPI pixels templates are stored in. */
export const CATEGORY_DIMENSIONS = Object.fromEntries(
  Object.entries(CATEGORY_SIZES_MM).map(([category, size]) => [
    category,
    { w: lengthToPx(size.w, 'MM'), h: lengthToPx(size.h, 'MM'), name: size.name },
  ])
) as Record<TemplateCategory, { w: number; h: number; name?: string }>;
