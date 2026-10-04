import type { LegalDocument } from '../types';
import { SUBPROCESSORS } from '../subprocessors';

/**
 * Processor terms for the roster data a press puts into the Service.
 * Written to satisfy both DPDP s.8(2) (processor under contract) and GDPR
 * Art. 28(3), so a press with EU or UK client organisations can onboard them
 * without negotiating a bespoke agreement.
 */
export const dataProcessingAddendum: LegalDocument = {
  slug: 'data-processing-addendum',
  title: 'Data Processing Addendum',
  shortTitle: 'Data Processing Addendum',
  summary: 'Our binding obligations when we process cardholder data on your behalf, including security measures, subprocessors, audits, deletion and breach notification.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['PRESS', 'CLIENT'],
  consentPoints: ['PRESS_SIGNUP'],
  sections: (co) => [
    {
      id: 'scope',
      heading: '1. Scope and roles',
      blocks: [
        {
          kind: 'text',
          text: `This Addendum forms part of the Terms of Service between ${co.entityName} ("Processor", "we") and the Press ("Controller", "you"). It applies whenever we process personal data on your behalf, and it prevails over the Terms of Service on any question of data protection.`,
        },
        {
          kind: 'list',
          items: [
            'You are the Data Fiduciary under the DPDP Act, 2023 and the Controller under the GDPR and UK GDPR where they apply. You determine the purposes and means of processing.',
            'We are the Data Processor. We process personal data only on your documented instructions.',
            'Where a Client Organisation is itself the controller and you act as its processor, you enter into this Addendum on its behalf as well, and warrant that you are authorised to do so. We may be instructed through you only.',
          ],
        },
        {
          kind: 'text',
          text: 'Your use of the Service — the templates you build, the fields you define, the enrolment links you issue, the exports and deletions you perform — constitutes your documented instructions. Any instruction outside the Service must be agreed in writing.',
        },
      ],
    },
    {
      id: 'obligations',
      heading: '2. Our obligations',
      blocks: [
        {
          kind: 'list',
          ordered: true,
          items: [
            'Process personal data only for the purposes in Annex 1, and only as instructed. We will tell you if we believe an instruction breaches applicable law, and may suspend that instruction until it is resolved.',
            'Not sell, rent or disclose personal data, and not use it for our own purposes, including product analytics beyond aggregate, non-identifying operational metrics, and never to train machine-learning models.',
            'Keep the technical and organisational measures in Annex 1 in place and not materially weaken them during the term.',
            'Ensure our personnel with access are bound by confidentiality, trained, and granted access only where needed for their role.',
            'Assist you, at your cost where the work is more than trivial, with data-principal and data-subject requests, impact assessments, breach notification and dealings with an authority.',
            'Make available the information reasonably necessary to demonstrate our compliance with this Addendum.',
          ],
        },
      ],
    },
    {
      id: 'controller-obligations',
      heading: '3. Your obligations',
      blocks: [
        {
          kind: 'list',
          items: [
            'Have a lawful basis for the processing, and give the notices applicable law requires.',
            'Obtain verifiable parental or guardian consent before a child’s personal data is put into the Service.',
            'Only put into the Service the data you actually need on a card. Do not place sensitive data in a field that does not need it.',
            'Keep your users’ credentials and your API keys secure, and treat enrolment and portal links as confidential — anyone holding a link can submit a record.',
            'Respond to data-principal requests you receive about your own cardholders, using the Service’s search, correction, export and deletion tools.',
            'Delete data you no longer need. We cannot know when your purpose has ended.',
          ],
        },
      ],
    },
    {
      id: 'subprocessors',
      heading: '4. Subprocessors',
      blocks: [
        {
          kind: 'text',
          text: 'You give general authorisation for us to engage the subprocessors listed in Annex 2. We impose data protection obligations on each of them that are no less protective than this Addendum, and we remain liable to you for their acts and omissions.',
        },
        {
          kind: 'text',
          text: 'We will give you at least 30 days notice, by email or in the dashboard, before a new subprocessor starts processing personal data. If you have a reasonable, data-protection-related objection within that period, tell us; we will work with you on a solution, and if none is available you may terminate the affected part of the Service and receive a pro-rata refund of prepaid, unused fees.',
        },
      ],
    },
    {
      id: 'breach',
      heading: '5. Personal data breaches',
      blocks: [
        {
          kind: 'text',
          text: 'We will notify you without undue delay, and in any case within 48 hours, of becoming aware of a personal data breach affecting personal data we process for you. The notification will describe the nature of the breach, the categories and approximate volume of data and individuals affected, the likely consequences, the measures taken or proposed, and a contact point for more information. Where we cannot provide all of that at once, we will provide it in phases.',
        },
        {
          kind: 'text',
          text: 'We will not notify an authority or an individual about a breach affecting your data on your behalf unless you ask us to or the law requires us to do so directly. Notifying the Data Protection Board and affected data principals is your responsibility as Data Fiduciary.',
        },
      ],
    },
    {
      id: 'audit',
      heading: '6. Audits and information rights',
      blocks: [
        {
          kind: 'text',
          text: 'On request, and no more than once in any 12-month period unless an authority requires otherwise or we have suffered a breach affecting you, we will provide our current security documentation and answer a reasonable security questionnaire.',
        },
        {
          kind: 'text',
          text: 'Where applicable law entitles you to an on-site audit, it will be conducted on at least 30 days notice, during business hours, under confidentiality, by you or an independent auditor who is not our competitor, in a way that does not disrupt the Service or risk other customers’ data, and at your cost.',
        },
      ],
    },
    {
      id: 'deletion',
      heading: '7. Return and deletion',
      blocks: [
        {
          kind: 'text',
          text: 'You can export your data at any time using the Service’s export tools, and delete it using the deletion and retention tools. Deletion through those tools removes the records from the database and the associated photographs and generated files from object storage.',
        },
        {
          kind: 'text',
          text: 'On termination, you have 30 days to export. After that we delete or irreversibly anonymise personal data we hold for you, including in object storage, within a further 30 days, and instruct our subprocessors to do the same. Backups are overwritten on their normal rolling cycle, within 35 days. We may retain the minimum data that law requires us to keep, and audit-log entries recording that an action occurred, which we isolate and use for no other purpose. We will confirm deletion in writing on request.',
        },
      ],
    },
    {
      id: 'transfers',
      heading: '8. International transfers',
      blocks: [
        {
          kind: 'text',
          text: `We are established in ${co.country}. Where we transfer personal data across a border we do so only to a country not restricted under the DPDP Act, and, where the GDPR or UK GDPR applies to the transfer, under the European Commission’s Standard Contractual Clauses (Module Two, controller to processor, or Module Three where we act as your sub-processor) and the UK International Data Transfer Addendum, each of which is incorporated into this Addendum by reference and completed with the details in Annexes 1 and 2. Where those Clauses conflict with this Addendum, the Clauses prevail.`,
        },
        {
          kind: 'text',
          text: 'We will tell you if we receive a government or law-enforcement request for personal data we process for you, unless legally prohibited, and we will challenge requests we consider unlawful or overbroad.',
        },
      ],
    },
    {
      id: 'liability',
      heading: '9. Liability and term',
      blocks: [
        {
          kind: 'text',
          text: 'This Addendum takes effect when you accept the Terms of Service and continues for as long as we process personal data for you. The limitations of liability in the Terms of Service apply to this Addendum, except where applicable data protection law does not permit them to.',
        },
      ],
    },
    {
      id: 'annex-1',
      heading: 'Annex 1 — Details of processing and security measures',
      blocks: [
        {
          kind: 'table',
          columns: ['Item', 'Detail'],
          rows: [
            ['Subject matter', 'Provision of the IDexo identity-card production service'],
            ['Duration', 'The term of the Terms of Service, plus the deletion windows in clause 7'],
            ['Nature and purpose', 'Storage, retrieval, rendering, image processing, PDF generation, export, backup and deletion of roster data for the production of identity cards and badges'],
            ['Categories of data principals / data subjects', 'Cardholders (students, employees, members, visitors), contacts at client organisations, and your own users'],
            ['Categories of personal data', 'Names, photographs, designations, dates of birth, enrolment and employee numbers, blood group and similar card fields chosen by you, contact details, and card serial numbers'],
            ['Special / sensitive categories', 'Only if you choose to place them in a card field. Facial photographs, and any health-related field such as blood group, should be treated as sensitive. We apply no additional restriction beyond the measures below, so avoid collecting what the card does not need.'],
            ['Children’s data', 'Frequently. Cardholders at schools are usually under 18.'],
            ['Frequency', 'Continuous, during your use of the Service'],
            ['Retention', 'As instructed by you; see clause 7 and the Privacy Policy'],
          ],
        },
        {
          kind: 'text',
          text: 'Technical and organisational measures:',
        },
        {
          kind: 'list',
          items: [
            'Encryption of personal data in transit (TLS 1.2+) and at rest in the database and object storage.',
            'Pseudonymisation where feasible, and signed, short-lived URLs for access to generated files.',
            'Tenant isolation enforced in the data-access layer on every query, with unscoped queries blocked rather than allowed to return cross-tenant rows.',
            'Role-based access control with least privilege; credit, export and destructive operations restricted to Owner users.',
            'Authentication with bcrypt-hashed passwords, signed expiring session tokens and central session revocation.',
            'Rate limiting on authentication, registration, enrolment, export and purge endpoints; CSRF origin validation; strict content security policy and security headers.',
            'Append-only audit logging of security-relevant and money-relevant actions, with actor, IP address and user agent.',
            'Scoped, token-authorised purge: destructive purges act only on the exact record set listed in a signed export manifest, so a caller cannot widen the scope.',
            'Error monitoring configured to collect diagnostics, not cardholder photographs.',
            'Backups with a rolling 35-day cycle, restore procedures tested periodically.',
            'Staff access on need, logged, removed on role change or departure; confidentiality obligations in employment and contractor terms.',
            'Vulnerability management: dependency updates, and remediation of reported vulnerabilities on a risk-prioritised basis.',
          ],
        },
      ],
    },
    {
      id: 'annex-2',
      heading: 'Annex 2 — Authorised subprocessors',
      blocks: [
        {
          kind: 'table',
          columns: ['Subprocessor', 'Entity', 'Processing', 'Data', 'Location'],
          rows: SUBPROCESSORS.map(s => [s.name, s.entity, s.purpose, s.dataTouched, s.location]),
        },
        {
          kind: 'note',
          text: `The current list is always the one published at ${co.website}/legal/data-processing-addendum#annex-2.`,
        },
      ],
    },
  ],
};
