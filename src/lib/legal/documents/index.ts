import type { ConsentPoint, LegalAudience, LegalDocument } from '../types';
import { termsOfService } from './terms';
import { privacyPolicy } from './privacy';
import { dataProcessingAddendum } from './dpa';
import { acceptableUsePolicy } from './aup';
import { billingPolicy } from './billing';
import { cookieNotice } from './cookies';
import { marketplaceTerms } from './marketplace';
import { clientOrganisationTerms } from './clientTerms';
import { cardholderNotice } from './cardholderNotice';
import { grievancePolicy } from './grievance';

/**
 * Every published legal document, in the order they are listed on /legal.
 *
 * Changing a document:
 *   - wording, typos, formatting  → edit in place, leave `version` alone
 *   - anything that changes what a party is agreeing to → bump `version` and
 *     move `effectiveDate`. Every press with an acceptance of the old version
 *     is then re-prompted by the dashboard gate, so do not bump casually.
 */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  termsOfService,
  privacyPolicy,
  acceptableUsePolicy,
  dataProcessingAddendum,
  billingPolicy,
  marketplaceTerms,
  clientOrganisationTerms,
  cardholderNotice,
  cookieNotice,
  grievancePolicy,
];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find(d => d.slug === slug);
}

/**
 * The documents that must be accepted at a given point in the product.
 * Server-side enforcement reads this, so adding a consent point to a document
 * is all it takes to start requiring it.
 */
export function documentsForConsentPoint(point: ConsentPoint): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter(d => d.consentPoints.includes(point));
}

export function documentsForAudience(audience: LegalAudience): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter(d => d.audiences.includes(audience));
}

export {
  termsOfService,
  privacyPolicy,
  dataProcessingAddendum,
  acceptableUsePolicy,
  billingPolicy,
  cookieNotice,
  marketplaceTerms,
  clientOrganisationTerms,
  cardholderNotice,
  grievancePolicy,
};
