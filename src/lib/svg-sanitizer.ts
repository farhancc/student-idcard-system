/**
 * SVG Content Sanitizer
 * Strips script tags, event handler attributes (on*), javascript: URIs,
 * and dangerous DTD entity definitions to prevent XSS / XXE attacks.
 */
export function sanitizeSvg(svgContent: string): string {
  if (!svgContent || typeof svgContent !== 'string') return '';

  let sanitized = svgContent;

  // 1. Remove XML DTD / Entity declarations (prevent XXE)
  sanitized = sanitized.replace(/<!ENTITY\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<!DOCTYPE\b[^>]*>/gi, '');

  // 2. Remove <script> elements and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 3. Remove inline event handlers (onload, onerror, onclick, onmouseover, etc.)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 4. Neutralize javascript: URIs in href / xlink:href / src attributes
  sanitized = sanitized.replace(/(href|xlink:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1="about:blank"');

  // 5. Remove <foreignObject> elements (often used to embed arbitrary HTML/JS)
  sanitized = sanitized.replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '');

  return sanitized;
}
