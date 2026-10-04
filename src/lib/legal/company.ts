/**
 * The operator's own legal identity, as published in the legal documents.
 *
 * This is deliberately NOT in `src/lib/env.ts`: that module owns the
 * infrastructure contract the server cannot boot without, and crashing a
 * deployment because a grievance officer's phone number is missing would be
 * wrong. Here a missing value degrades to an honest placeholder and is reported
 * through `legalIdentityWarnings()` instead.
 *
 * Every one of these MUST be set before the service is offered commercially —
 * India's Consumer Protection (E-commerce) Rules 2020 r.4(2)/5(3) and the
 * DPDP Act 2023 s.5 notice duty both require a real, reachable identity.
 */

export interface LegalIdentity {
  /** Trading / product name. */
  brand: string;
  /** Registered legal name of the entity that contracts with customers. */
  entityName: string;
  /** e.g. "a private limited company incorporated in India". */
  entityForm: string;
  /** Corporate Identity Number, or '' when not a registered company yet. */
  cin: string;
  /** GST Identification Number, or ''. */
  gstin: string;
  /** Registered office, single line. */
  address: string;
  /** Country of establishment — drives the data-transfer clauses. */
  country: string;
  /** City whose courts have exclusive jurisdiction. */
  jurisdictionCity: string;
  /** Governing law. */
  governingLaw: string;
  website: string;
  contactEmail: string;
  /** Receives DPDP / GDPR data-principal and data-subject requests. */
  privacyEmail: string;
  /** Grievance Officer — required by the e-commerce and IT rules. */
  grievanceOfficerName: string;
  grievanceOfficerEmail: string;
  grievanceOfficerPhone: string;
  /** Security disclosures. */
  securityEmail: string;
}

const PLACEHOLDER = {
  entityName: 'the operator of IDexo (registered legal name not yet published)',
  entityForm: 'the entity identified at the address below',
  address: 'Registered office address not yet published — please use the email contacts below',
  grievanceOfficerName: 'The Grievance Officer',
  phone: 'Not yet published — please use email',
} as const;

/** Env vars that must be set before the documents are fit to publish. */
const REQUIRED_VARS = [
  'LEGAL_ENTITY_NAME',
  'LEGAL_ENTITY_FORM',
  'LEGAL_ADDRESS',
  'LEGAL_CONTACT_EMAIL',
  'LEGAL_PRIVACY_EMAIL',
  'LEGAL_GRIEVANCE_OFFICER_NAME',
  'LEGAL_GRIEVANCE_OFFICER_EMAIL',
  'LEGAL_GRIEVANCE_OFFICER_PHONE',
  'LEGAL_WEBSITE',
] as const;

function read(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

export function getLegalIdentity(): LegalIdentity {
  const brand = read('LEGAL_BRAND', 'IDexo');
  const website = read('LEGAL_WEBSITE', 'https://idexo.app');
  const contactEmail = read('LEGAL_CONTACT_EMAIL', 'legal@idexo.app');

  return {
    brand,
    entityName: read('LEGAL_ENTITY_NAME', PLACEHOLDER.entityName),
    entityForm: read('LEGAL_ENTITY_FORM', PLACEHOLDER.entityForm),
    cin: read('LEGAL_CIN', ''),
    gstin: read('LEGAL_GSTIN', ''),
    address: read('LEGAL_ADDRESS', PLACEHOLDER.address),
    country: read('LEGAL_COUNTRY', 'India'),
    jurisdictionCity: read('LEGAL_JURISDICTION_CITY', 'Bengaluru, Karnataka'),
    governingLaw: read('LEGAL_GOVERNING_LAW', 'the laws of India'),
    website,
    contactEmail,
    privacyEmail: read('LEGAL_PRIVACY_EMAIL', contactEmail),
    grievanceOfficerName: read('LEGAL_GRIEVANCE_OFFICER_NAME', PLACEHOLDER.grievanceOfficerName),
    grievanceOfficerEmail: read('LEGAL_GRIEVANCE_OFFICER_EMAIL', contactEmail),
    grievanceOfficerPhone: read('LEGAL_GRIEVANCE_OFFICER_PHONE', PLACEHOLDER.phone),
    securityEmail: read('LEGAL_SECURITY_EMAIL', contactEmail),
  };
}

/**
 * Which required identity values are still falling back to a placeholder.
 * Surfaced on /legal outside production, and logged once on the server, so an
 * unconfigured deployment cannot quietly publish policies naming nobody.
 */
export function legalIdentityWarnings(): string[] {
  return REQUIRED_VARS.filter(name => {
    const raw = process.env[name];
    return !raw || !raw.trim();
  });
}
