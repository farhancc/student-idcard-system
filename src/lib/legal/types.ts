/**
 * Shape of the published legal documents.
 *
 * Documents are data, not JSX: the same section tree is rendered as a web page,
 * quoted in a consent checkbox, and diffed when a version is bumped. Keeping it
 * structured also means `tests/unit/legal-documents.test.ts` can assert that
 * every document the consent flows depend on actually exists and is complete.
 */

import type { LegalIdentity } from './company';

export type LegalBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  /** Called out visually — used for the things a reader must not miss. */
  | { kind: 'note'; text: string };

export interface LegalSection {
  /** Stable anchor, so a clause can be linked to from a support reply. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

/** Who a document is written for. Drives the grouping on /legal. */
export type LegalAudience = 'PRESS' | 'CLIENT' | 'CARDHOLDER' | 'PUBLIC';

/**
 * The places in the product where agreement to a document is captured.
 * A document listing a consent point is enforced server-side at that point.
 */
export type ConsentPoint =
  | 'PRESS_SIGNUP'
  | 'CLIENT_SIGNUP'
  | 'CARDHOLDER_ENROLMENT'
  | 'MARKETPLACE_PUBLISH';

export interface LegalDocument {
  /** URL segment under /legal. */
  slug: string;
  title: string;
  /** Used in checkbox labels and nav, where the full title is too long. */
  shortTitle: string;
  /** One sentence, shown on the /legal index. */
  summary: string;
  /**
   * Bump on any change of substance. Acceptance is recorded against this value,
   * and presses are re-prompted when it moves, so cosmetic edits must NOT bump
   * it — see `docs` note in documents/index.ts.
   */
  version: string;
  /** ISO date (YYYY-MM-DD). */
  effectiveDate: string;
  audiences: LegalAudience[];
  consentPoints: ConsentPoint[];
  sections: (identity: LegalIdentity) => LegalSection[];
}
