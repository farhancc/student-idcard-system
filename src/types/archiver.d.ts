/**
 * Minimal declarations for archiver v8.
 *
 * v8 is pure ESM and ships no types of its own, and `@types/archiver` describes
 * the v7 default-export API (`archiver(...)`) which v8 removed — so depending on
 * it would typecheck calls that crash at runtime. Only the surface this codebase
 * uses is declared here; extend it if more is needed.
 */
declare module 'archiver' {
  import { Readable } from 'stream';

  export interface ArchiveEntryData {
    name: string;
  }

  export interface ZipArchiveOptions {
    zlib?: { level?: number };
  }

  export class ZipArchive extends Readable {
    constructor(options?: ZipArchiveOptions);
    append(source: Buffer | Readable | string, data: ArchiveEntryData): this;
    finalize(): Promise<void>;
    pointer(): number;
  }
}
