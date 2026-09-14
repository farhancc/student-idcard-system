import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  resolveWithinDir,
  isPublicAddress,
  fetchPublicAsset,
  UnsafeAssetError,
} from '@/lib/safe-fetch';

const BASE = path.resolve('/srv/app/public/uploads');

describe('resolveWithinDir', () => {
  it('accepts keys that stay inside the base directory', () => {
    expect(resolveWithinDir(BASE, 'photos/a.png')).toBe(path.join(BASE, 'photos/a.png'));
    expect(resolveWithinDir(BASE, '/photos/a.png')).toBe(path.join(BASE, 'photos/a.png'));
    expect(resolveWithinDir(BASE, 'a/b/../c.png')).toBe(path.join(BASE, 'a/c.png'));
  });

  it('rejects every shape that escapes the base directory', () => {
    for (const evil of [
      '../secret',
      '../../.env',
      '../../../../etc/passwd',
      'a/../../../etc/hostname',
      '/../../.env',
    ]) {
      expect(resolveWithinDir(BASE, evil), evil).toBeNull();
    }
  });

  it('does not treat a sibling directory with a shared prefix as inside', () => {
    expect(resolveWithinDir(BASE, '../uploads-backup/x')).toBeNull();
  });
});

describe('isPublicAddress', () => {
  it('rejects loopback, private, link-local and reserved ranges', () => {
    for (const ip of [
      '127.0.0.1', '127.1.2.3', '0.0.0.0',
      '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1',
      '169.254.169.254',          // cloud instance metadata
      '100.64.0.1',               // CGNAT
      '198.18.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1',
      '224.0.0.1', '255.255.255.255',
      '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1',
      '::ffff:127.0.0.1',         // IPv4-mapped loopback
      '::ffff:169.254.169.254',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it('accepts routable addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700::1111']) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it('rejects anything that is not an IP', () => {
    expect(isPublicAddress('example.com')).toBe(false);
    expect(isPublicAddress('')).toBe(false);
  });
});

describe('fetchPublicAsset', () => {
  const code = async (url: string, opts = {}) => {
    try {
      await fetchPublicAsset(url, opts);
      return 'NO_THROW';
    } catch (e) {
      return e instanceof UnsafeAssetError ? e.code : `OTHER:${e}`;
    }
  };

  it('refuses non-http schemes', async () => {
    expect(await code('file:///etc/passwd')).toBe('INVALID_URL');
    expect(await code('gopher://x/')).toBe('INVALID_URL');
    expect(await code('not a url')).toBe('INVALID_URL');
  });

  it('refuses IP literals in blocked ranges without connecting', async () => {
    expect(await code('http://127.0.0.1:1/x')).toBe('BLOCKED_ADDRESS');
    expect(await code('http://169.254.169.254/latest/meta-data/')).toBe('BLOCKED_ADDRESS');
    expect(await code('http://[::1]:1/x')).toBe('BLOCKED_ADDRESS');
  });

  it('refuses hostnames that resolve into a blocked range', async () => {
    expect(await code('http://localhost:1/x')).toBe('BLOCKED_ADDRESS');
  });

  it('enforces the host allowlist before any connection', async () => {
    expect(
      await code('https://evil.example/x.pdf', { allowedHosts: new Set(['res.cloudinary.com']) })
    ).toBe('HOST_NOT_ALLOWED');
  });
});
