import type { LegalDocument } from '../types';
import { SUBPROCESSORS } from '../subprocessors';

/**
 * Our own privacy notice: what we do with personal data for which WE are
 * responsible. Roster data we hold on a press's behalf is covered by the DPA
 * and, for the people on the roster, by the Cardholder Privacy Notice.
 */
export const privacyPolicy: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  shortTitle: 'Privacy Policy',
  summary: 'What personal data we collect, why, who we share it with, how long we keep it, and the rights you can exercise.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['PUBLIC', 'PRESS', 'CLIENT'],
  consentPoints: ['PRESS_SIGNUP'],
  sections: (co) => [
    {
      id: 'who-we-are',
      heading: '1. Who we are and what this covers',
      blocks: [
        {
          kind: 'text',
          text: `${co.entityName} ("${co.brand}", "we") operates ${co.website}, a service printing presses use to collect rosters and photographs from their client organisations and turn them into print-ready identity cards.`,
        },
        {
          kind: 'text',
          text: 'Two different kinds of personal data flow through the Service, and our role differs for each:',
        },
        {
          kind: 'table',
          columns: ['Data', 'Our role', 'Governed by'],
          rows: [
            [
              'Account, billing, support and diagnostic data about the people who use our dashboard',
              'Data Fiduciary / Controller — we decide how it is used',
              'This Privacy Policy',
            ],
            [
              'Roster data: cardholder names, photographs, dates of birth, identification numbers and other card fields',
              'Data Processor — we only act on the instructions of the press and its client organisation',
              'The Data Processing Addendum, and the press’s own privacy notice',
            ],
          ],
        },
        {
          kind: 'note',
          text: 'If you are a student, employee or member whose photograph is on a card, the organisation that asked for your details decides how they are used. Start with them, or read the Cardholder Privacy Notice. You can still contact us using the details in section 11.',
        },
        {
          kind: 'list',
          items: [
            `Registered entity: ${co.entityName}${co.cin ? ` (CIN ${co.cin})` : ''}`,
            `Address: ${co.address}`,
            `Privacy contact: ${co.privacyEmail}`,
          ],
        },
      ],
    },
    {
      id: 'what-we-collect',
      heading: '2. What we collect as controller',
      blocks: [
        {
          kind: 'table',
          columns: ['Category', 'Examples', 'Where it comes from'],
          rows: [
            ['Account data', 'Press name, owner name, work email, mobile number, city, role, hashed password, last sign-in time', 'You, at registration and in settings'],
            ['Client organisation contacts', 'Organisation name and type, contact name, work email, phone, address', 'You, or the organisation when it registers through a signup link'],
            ['Billing data', 'Plan, credit balance and movements, invoices, payment identifiers and GST details. Card numbers go to Stripe directly and never reach our servers.', 'You and our payment processor'],
            ['Usage and audit data', 'Actions taken in the dashboard, job history, downloads, print records, API key use, IP address, user agent, timestamps', 'Automatically, as you use the Service'],
            ['Security data', 'Sign-in attempts, rate-limit counters, revoked session identifiers', 'Automatically'],
            ['Diagnostic data', 'Error reports and stack traces, including the URL and account identifier involved', 'Automatically, via our error monitoring tool'],
            ['Support data', 'Messages, attachments and anything you choose to send us', 'You'],
          ],
        },
        {
          kind: 'text',
          text: 'We do not run advertising, we do not use third-party advertising or analytics trackers, and we do not buy personal data from data brokers.',
        },
      ],
    },
    {
      id: 'why',
      heading: '3. Why we use it, and on what basis',
      blocks: [
        {
          kind: 'table',
          columns: ['Purpose', 'Basis under the DPDP Act, 2023', 'Basis under the GDPR, where it applies'],
          rows: [
            ['Creating and running your account, and providing the Service', 'Certain legitimate use — performance of the service you asked for', 'Art. 6(1)(b) contract'],
            ['Taking payment, issuing invoices and keeping tax records', 'Compliance with law; performance of the contract', 'Art. 6(1)(b) and 6(1)(c)'],
            ['Keeping the Service secure: rate limiting, audit logs, abuse and fraud prevention', 'Certain legitimate use — prevention of fraud and unlawful activity', 'Art. 6(1)(f) legitimate interests'],
            ['Fixing faults and improving reliability', 'Certain legitimate use', 'Art. 6(1)(f) legitimate interests'],
            ['Service announcements, security notices and changes to these documents', 'Performance of the contract; compliance with law', 'Art. 6(1)(b) and 6(1)(c)'],
            ['Marketing emails about new features', 'Consent, which you can withdraw at any time', 'Art. 6(1)(a) consent'],
            ['Responding to a lawful request from a court or authority, or defending a claim', 'Compliance with law', 'Art. 6(1)(c) and 6(1)(f)'],
          ],
        },
        {
          kind: 'text',
          text: 'We do not use your account data, or any roster data, to train machine-learning models, and we do not sell personal data.',
        },
        {
          kind: 'text',
          text: 'We do not make decisions about you by purely automated means that have a legal or similarly significant effect on you.',
        },
      ],
    },
    {
      id: 'children',
      heading: '4. Children',
      blocks: [
        {
          kind: 'text',
          text: 'Our dashboard is for business users and is not directed at children. You must be 18 or over to hold an account.',
        },
        {
          kind: 'text',
          text: 'Cardholders, on the other hand, are often children — most of this service exists to print school ID cards. Where a cardholder is under 18, section 9 of the DPDP Act requires the verifiable consent of a parent or lawful guardian, and prohibits tracking, behavioural monitoring or targeted advertising directed at children. We do none of those things. Obtaining and holding that consent is the responsibility of the press and the school, and the Service provides a guardian-consent step in the enrolment form and records what was agreed.',
        },
        {
          kind: 'note',
          text: 'If you believe a child’s data has been put into the Service without proper consent, write to us at the address in section 11 and we will work with the responsible press to have it removed.',
        },
      ],
    },
    {
      id: 'sharing',
      heading: '5. Who we share data with',
      blocks: [
        {
          kind: 'text',
          text: 'We share personal data only with:',
        },
        {
          kind: 'list',
          items: [
            'the subprocessors listed below, who process it on our instructions under a written contract;',
            'the press whose tenant your record belongs to, and nobody else’s tenant — the application enforces tenant separation on every database query;',
            'professional advisers, auditors and insurers, under a duty of confidence;',
            'an acquirer, if the business is sold or reorganised, on notice to you;',
            'a court, regulator or law-enforcement agency, where we are legally obliged to disclose. We review every request, refuse those that are overbroad or unlawful, and tell the affected customer unless we are legally prohibited from doing so.',
          ],
        },
        {
          kind: 'text',
          text: 'Current subprocessors:',
        },
        {
          kind: 'table',
          columns: ['Service', 'Entity', 'Purpose', 'Data involved', 'Location'],
          rows: SUBPROCESSORS.map(s => [s.name, s.entity, s.purpose, s.dataTouched, s.location]),
        },
        {
          kind: 'text',
          text: 'We will give customers notice before adding a subprocessor that processes roster data, as set out in the Data Processing Addendum.',
        },
      ],
    },
    {
      id: 'transfers',
      heading: '6. International transfers',
      blocks: [
        {
          kind: 'text',
          text: `We are established in ${co.country}. Several of our subprocessors are established outside it, chiefly in the United States and the European Union, so personal data may be processed abroad.`,
        },
        {
          kind: 'list',
          items: [
            'Under the DPDP Act, transfers are permitted to any country not restricted by the Central Government. We will stop transferring to a country that is restricted.',
            'Where the GDPR applies, we rely on the European Commission’s Standard Contractual Clauses, or on an adequacy decision or an approved certification where the recipient has one, together with the supplementary measures described in Annex 1 of the Data Processing Addendum.',
            'You can ask us for a copy of the transfer mechanism relied on for any particular subprocessor.',
          ],
        },
      ],
    },
    {
      id: 'retention',
      heading: '7. How long we keep data',
      blocks: [
        {
          kind: 'table',
          columns: ['Data', 'Retention'],
          rows: [
            ['Account and client organisation records', 'For as long as the account is open, then 30 days for export, then deleted or anonymised'],
            ['Roster data and cardholder photographs', 'On the instructions of the press. Deleted when the press deletes them; purged from object storage by the retention tools and the daily cleanup job'],
            ['Generated PDFs and print files', 'Until their download link expires or the job is deleted, and then removed from object storage'],
            ['Invoices, payment records and tax documents', '8 years, as required by Indian tax and company law'],
            ['Security and audit logs', '12 months, or longer where needed to investigate an incident or defend a claim'],
            ['Error and diagnostic reports', '90 days'],
            ['Backups', 'Rolling, overwritten within 35 days'],
          ],
        },
        {
          kind: 'text',
          text: 'Where law requires us to keep something after you ask us to delete it, we isolate it and stop using it for anything else.',
        },
      ],
    },
    {
      id: 'security',
      heading: '8. How we protect data',
      blocks: [
        {
          kind: 'list',
          items: [
            'Encryption in transit (TLS) and at rest for the database and object storage.',
            'Passwords stored only as bcrypt hashes; sessions as signed, expiring tokens that can be revoked centrally.',
            'Tenant isolation enforced in the data-access layer, so a query that forgets to scope itself to a tenant is blocked rather than silently returning another press’s records.',
            'Role-based access: Owner, Operator and Designer users see and do different things, and credit, deletion and export operations are restricted to Owners.',
            'Rate limiting on authentication, enrolment and export endpoints; CSRF origin checks on state-changing requests; a strict content security policy.',
            'Signed, short-lived URLs for downloads, so a generated PDF is not left publicly addressable.',
            'An append-only audit log of security-relevant actions.',
            'Least-privilege access for our staff, granted on need and reviewed; production access is logged.',
          ],
        },
        {
          kind: 'text',
          text: 'No system is perfectly secure. If a breach affects your personal data we will notify you and the relevant authority as required — in India, the Data Protection Board, and, where the GDPR applies, the lead supervisory authority within 72 hours of becoming aware.',
        },
        {
          kind: 'text',
          text: `To report a vulnerability, write to ${co.securityEmail}. We will not pursue a researcher who tests in good faith, stays within their own tenant, avoids privacy-invasive and destructive testing, and gives us a reasonable chance to fix the issue before disclosing it.`,
        },
      ],
    },
    {
      id: 'rights',
      heading: '9. Your rights',
      blocks: [
        {
          kind: 'text',
          text: 'In relation to data for which we are the controller, you may ask us to:',
        },
        {
          kind: 'list',
          items: [
            'tell you what we hold about you and give you a copy of it;',
            'correct, complete or update anything inaccurate;',
            'erase data we no longer need for the purpose it was collected for;',
            'stop using it for a purpose you previously consented to, by withdrawing that consent;',
            'restrict or object to processing we base on legitimate interests;',
            'receive it in a portable, machine-readable form, where the GDPR applies;',
            'nominate another person to exercise these rights on your behalf if you die or become incapacitated, as the DPDP Act allows.',
          ],
        },
        {
          kind: 'text',
          text: `Write to ${co.privacyEmail}. We will respond within 30 days, and will tell you if we need longer and why. We may ask you to verify your identity; we will not charge you unless a request is manifestly excessive or repetitive.`,
        },
        {
          kind: 'text',
          text: 'If your request concerns roster data a press holds about you, we will forward it to that press and tell you we have done so — we cannot decide on their behalf what happens to data we only hold for them.',
        },
      ],
    },
    {
      id: 'cookies',
      heading: '10. Cookies and local storage',
      blocks: [
        {
          kind: 'text',
          text: 'We set only the cookies that make signing in work, and we use browser storage for a small number of interface preferences. There are no advertising or cross-site tracking cookies, which is why you do not see a consent banner. The detail is in the Cookie and Local Storage Notice.',
        },
      ],
    },
    {
      id: 'contact',
      heading: '11. Contact, complaints and escalation',
      blocks: [
        {
          kind: 'list',
          items: [
            `Privacy and data rights: ${co.privacyEmail}`,
            `Grievance Officer: ${co.grievanceOfficerName} — ${co.grievanceOfficerEmail}, ${co.grievanceOfficerPhone}`,
            `Post: ${co.address}`,
          ],
        },
        {
          kind: 'text',
          text: 'If you are not satisfied with our response, you may complain to the Data Protection Board of India or, where the GDPR applies, to your local supervisory authority. We would rather you came to us first so we can put it right.',
        },
      ],
    },
    {
      id: 'changes',
      heading: '12. Changes to this policy',
      blocks: [
        {
          kind: 'text',
          text: 'This policy carries a version number and an effective date. We will notify account holders by email or in the dashboard before a change of substance takes effect, and will ask you to acknowledge the new version when you next sign in.',
        },
      ],
    },
  ],
};
