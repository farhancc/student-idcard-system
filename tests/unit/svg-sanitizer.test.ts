import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '@/lib/svg-sanitizer';

describe('SVG Sanitizer', () => {
  it('strips <script> tags and JS content', () => {
    const malicious = '<svg><script>alert("xss")</script><rect width="100" height="100"/></svg>';
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert');
    expect(clean).toContain('<rect');
  });

  it('strips inline on* event attributes', () => {
    const malicious = '<svg onload="alert(1)" onerror="alert(2)"><circle cx="50" cy="50" r="40"/></svg>';
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('<circle');
  });

  it('neutralizes javascript: URIs in href attributes', () => {
    const malicious = '<svg><a href="javascript:alert(1)"><text>Click me</text></a></svg>';
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('javascript:alert(1)');
    expect(clean).toContain('href="about:blank"');
  });

  it('strips DTD entity declarations', () => {
    const malicious = '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>';
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('!ENTITY');
    expect(clean).not.toContain('!DOCTYPE');
  });
});
