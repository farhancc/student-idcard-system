import type { LegalDocument } from '../types';

/**
 * The master agreement with a printing press (the paying customer / tenant).
 * Accepted at /signup; a version bump re-prompts every press owner through the
 * dashboard gate.
 */
export const termsOfService: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  shortTitle: 'Terms of Service',
  summary: 'The agreement between your printing press and us covering accounts, credits, data responsibilities, liability and termination.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['PRESS'],
  consentPoints: ['PRESS_SIGNUP'],
  sections: (co) => [
    {
      id: 'parties',
      heading: '1. Who this agreement is between',
      blocks: [
        {
          kind: 'text',
          text: `These Terms of Service ("Terms") are a binding agreement between ${co.entityName}, ${co.entityForm} ("${co.brand}", "we", "us"), and the printing press, print shop, bureau or other organisation that registers an account ("you", "the Press").`,
        },
        {
          kind: 'text',
          text: `By creating an account, ticking the acceptance box at registration, or using the Service, you confirm that you are at least 18 years old, that you are authorised to bind the Press, and that the Press accepts these Terms and the documents incorporated into them.`,
        },
        {
          kind: 'list',
          items: [
            'Acceptable Use Policy — what you may and may not produce with the Service.',
            'Billing, Credits and Refunds Policy — how credits, plans, taxes and refunds work.',
            'Data Processing Addendum — our obligations when we process personal data on your behalf.',
            'Privacy Policy — how we handle personal data for which we are responsible.',
            'Marketplace Terms — additional terms if you list or buy templates.',
          ],
        },
        {
          kind: 'note',
          text: 'If there is a conflict, an individually signed Order Form prevails over the Data Processing Addendum, which prevails over these Terms, which prevail over the other policies.',
        },
      ],
    },
    {
      id: 'definitions',
      heading: '2. Definitions',
      blocks: [
        {
          kind: 'list',
          items: [
            '"Service" — the IDexo web application, desktop client, API and related software we make available to you.',
            '"Client Organisation" — a school, college, company, NGO or government body for which you produce cards, registered under your account.',
            '"Cardholder" — the individual, such as a student or employee, whose details appear on a card.',
            '"Customer Data" — everything you, a Client Organisation or a Cardholder puts into the Service: rosters, photographs, field values, artwork, templates and generated output.',
            '"Credits" — the prepaid units consumed when the Service compiles print-ready output.',
            '"Output" — the PDFs, images and print files the Service generates from Customer Data and a template.',
          ],
        },
      ],
    },
    {
      id: 'service',
      heading: '3. The Service',
      blocks: [
        {
          kind: 'text',
          text: 'We grant you a non-exclusive, non-transferable, revocable right to use the Service during the term of this agreement for your internal business purpose of producing identity cards and badges for your Client Organisations.',
        },
        {
          kind: 'text',
          text: 'We may change, add to or withdraw features. Where a change materially reduces functionality you are actively using, we will give you at least 30 days notice by email or in the dashboard, unless the change is required for security, legal compliance or to stop abuse.',
        },
        {
          kind: 'text',
          text: 'The Service is a tool. You remain the producer of the cards you print, and you are responsible for checking Output before it is printed, issued or relied on.',
        },
      ],
    },
    {
      id: 'accounts',
      heading: '4. Accounts, users and security',
      blocks: [
        {
          kind: 'list',
          items: [
            'You are responsible for everything done under your account, including by your Owner, Operator and Designer users, by your API keys, and by anyone you give a portal or enrolment link to.',
            'Keep credentials confidential. Do not share logins between people; create a user per person so the audit trail is meaningful.',
            'Give each user the lowest role that lets them do their job. Only Owners may purchase credits, delete data or export and purge records.',
            'API keys act with the authority of your account. Rotate them when a person with access leaves, and revoke any key you believe is exposed.',
            `Tell us immediately at ${co.securityEmail} if you suspect unauthorised access.`,
          ],
        },
        {
          kind: 'text',
          text: 'We may require you to reset credentials, or suspend a user or key, where we reasonably believe it is compromised.',
        },
      ],
    },
    {
      id: 'your-data-duties',
      heading: '5. Your responsibilities for roster data',
      blocks: [
        {
          kind: 'text',
          text: 'The Service exists to process personal data about real people, many of them children. For the data you and your Client Organisations put into it, you are the Data Fiduciary (under India’s Digital Personal Data Protection Act, 2023) or Controller (under the GDPR, where it applies), and we act on your instructions as Data Processor. You therefore warrant that:',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            'you have a lawful basis — consent, or another ground available to you — for collecting each roster, photograph and field value and for having us process it;',
            'the required notices have been given to Cardholders and, where a Cardholder is a child, verifiable consent has been obtained from a parent or lawful guardian;',
            'you have the authority of each Client Organisation to upload its roster, and the Client Organisation has the authority of its Cardholders;',
            'you will not upload special or sensitive categories of data (for example health, caste, religion or biometric identifiers) in a field that does not require it, and you accept that doing so is your decision and your risk;',
            'you will keep Customer Data accurate and will action correction and erasure requests you receive, using the tools the Service provides;',
            'you will not use the Service to produce a card for anyone whose data you no longer have the right to process.',
          ],
        },
        {
          kind: 'note',
          text: 'Cardholder photographs are personal data and, in the hands of a school, data about children. Treat the enrolment links you generate as sensitive: anyone with the link can submit a record.',
        },
        {
          kind: 'text',
          text: 'Our respective data protection obligations are set out in full in the Data Processing Addendum, which forms part of these Terms.',
        },
      ],
    },
    {
      id: 'content-ip',
      heading: '6. Ownership of data, templates and output',
      blocks: [
        {
          kind: 'text',
          text: 'You keep all rights in Customer Data. You grant us a worldwide, royalty-free licence to host, copy, transmit, render, resize and otherwise process Customer Data strictly to provide, secure and support the Service, and for no other purpose. We do not sell Customer Data, and we do not use Cardholder photographs or roster data to train machine-learning models.',
        },
        {
          kind: 'text',
          text: 'We keep all rights in the Service itself, including the application, the card rendering engine, the bundled font library, the templates we publish, our documentation and our trade marks. Nothing here transfers any of that to you.',
        },
        {
          kind: 'text',
          text: 'Templates you design in the Service are yours. Templates supplied by us, or bought through the Marketplace, are licensed, not sold — see the Marketplace Terms.',
        },
        {
          kind: 'text',
          text: 'You may not copy, decompile, reverse engineer or create derivative works of the Service, benchmark it for a competitor, or remove any proprietary notice, except to the extent that restriction is unenforceable under applicable law.',
        },
      ],
    },
    {
      id: 'credits',
      heading: '7. Credits, plans and payment',
      blocks: [
        {
          kind: 'text',
          text: 'Compiling Output consumes Credits at the rates shown in the dashboard at the time of compilation. Credits are prepaid, are consumed when a job completes, and are returned to your balance if a job fails or is cancelled before completion.',
        },
        {
          kind: 'text',
          text: 'Prices, taxes, invoicing, promotional credits, cancellation and refunds are governed by the Billing, Credits and Refunds Policy. Non-payment may lead to suspension under clause 10.',
        },
      ],
    },
    {
      id: 'acceptable-use',
      heading: '8. Acceptable use',
      blocks: [
        {
          kind: 'text',
          text: 'Your use of the Service is subject to the Acceptable Use Policy. It prohibits, among other things, producing cards that imitate government, police, military or regulatory credentials, or any card intended to deceive someone about who the holder is or what they are entitled to do.',
        },
        {
          kind: 'note',
          text: 'Breach of the Acceptable Use Policy is a material breach of these Terms and may result in immediate suspension without notice, and in reporting to law enforcement where we are required or permitted to do so.',
        },
      ],
    },
    {
      id: 'third-parties',
      heading: '9. Third-party services',
      blocks: [
        {
          kind: 'text',
          text: 'The Service runs on infrastructure and uses tools operated by third parties — hosting, database, object storage, image delivery, payments, rate limiting and error monitoring. The current list is published in the Privacy Policy and in Annex 2 of the Data Processing Addendum. We remain responsible to you for their processing of Customer Data as our subprocessors.',
        },
        {
          kind: 'text',
          text: 'If you connect the Service to something of your own — a print vendor, a spreadsheet import, our API — that integration is your responsibility and the third party’s terms apply to it.',
        },
      ],
    },
    {
      id: 'suspension',
      heading: '10. Suspension and termination',
      blocks: [
        {
          kind: 'text',
          text: 'You may stop using the Service and close your account at any time from the dashboard or by writing to us. Closing the account does not refund unused Credits except as set out in the Billing, Credits and Refunds Policy.',
        },
        {
          kind: 'text',
          text: 'We may suspend or terminate your access:',
        },
        {
          kind: 'list',
          items: [
            'immediately, for a breach of the Acceptable Use Policy, for unlawful activity, or where continued access creates a security or legal risk to us, to Cardholders or to other customers;',
            'on 14 days notice, for an unremedied payment default;',
            'on 30 days notice, for any other material breach you have not remedied after being told about it;',
            'on 90 days notice, if we withdraw the Service entirely, in which case we will refund Credits you have paid for and not used.',
          ],
        },
        {
          kind: 'text',
          text: 'On termination your licence ends. For 30 days afterwards you may export your Customer Data using the export tools. After that window we delete or irreversibly anonymise Customer Data in accordance with the Data Processing Addendum, except where law requires us to keep it (for example tax records and audit logs).',
        },
      ],
    },
    {
      id: 'availability',
      heading: '11. Availability and support',
      blocks: [
        {
          kind: 'text',
          text: 'We aim to keep the Service available and to make a reasonable effort to resolve faults promptly, but unless your Order Form includes a written service level, the Service is provided without an availability commitment. Planned maintenance will be announced in advance where practicable.',
        },
        {
          kind: 'text',
          text: 'You are responsible for keeping your own copies of anything you cannot afford to lose. Our backups exist to let us recover the Service, not to serve as your archive.',
        },
      ],
    },
    {
      id: 'confidentiality',
      heading: '12. Confidentiality',
      blocks: [
        {
          kind: 'text',
          text: 'Each party will keep the other’s non-public information confidential, use it only for this agreement, protect it with at least reasonable care, and disclose it only to people who need it and are bound to equivalent obligations. This does not apply to information that is public without breach, independently developed, or required to be disclosed by law — in which case the disclosing party will be told where legally permitted.',
        },
      ],
    },
    {
      id: 'warranties',
      heading: '13. Disclaimers',
      blocks: [
        {
          kind: 'text',
          text: 'We warrant that we will provide the Service with reasonable skill and care. Beyond that, and to the maximum extent the law allows, the Service is provided "as is" and we disclaim all other warranties, express or implied, including fitness for a particular purpose and non-infringement.',
        },
        {
          kind: 'text',
          text: 'In particular we do not warrant that the Service will be uninterrupted or error-free, that Output will exactly match any particular printer, laminate, card stock or colour profile, that barcodes or QR codes will be readable by every scanner, or that imported data will be free of errors introduced upstream. Check a proof before a production run.',
        },
      ],
    },
    {
      id: 'liability',
      heading: '14. Limitation of liability',
      blocks: [
        {
          kind: 'text',
          text: 'Neither party is liable for indirect or consequential loss, loss of profit, loss of anticipated savings, loss of business or reputational harm, even if it was foreseeable.',
        },
        {
          kind: 'text',
          text: 'Each party’s total aggregate liability arising out of or in connection with this agreement is limited to the greater of (a) the fees you paid us in the 12 months before the event giving rise to the claim, and (b) INR 10,000.',
        },
        {
          kind: 'text',
          text: 'These limits do not apply to, and nothing in this agreement excludes or limits liability for:',
        },
        {
          kind: 'list',
          items: [
            'death or personal injury caused by negligence;',
            'fraud or fraudulent misrepresentation;',
            'your obligation to pay fees properly due;',
            'the indemnities in clause 15;',
            'any liability that cannot lawfully be excluded or limited, including under the Consumer Protection Act, 2019 where it applies to you.',
          ],
        },
      ],
    },
    {
      id: 'indemnity',
      heading: '15. Indemnities',
      blocks: [
        {
          kind: 'text',
          text: 'You will indemnify us against claims, fines, penalties, losses and reasonable legal costs arising from:',
        },
        {
          kind: 'list',
          items: [
            'your or your Client Organisation’s processing of Customer Data without a lawful basis, without required notices, or without verifiable parental consent where a Cardholder is a child;',
            'Output used in breach of the Acceptable Use Policy, including any card that imitates an official credential;',
            'a third party’s claim that artwork, a logo, a photograph, a font or a template you uploaded or listed infringes their rights;',
            'your breach of clause 5 or clause 8.',
          ],
        },
        {
          kind: 'text',
          text: 'We will indemnify you against a third-party claim that the Service as supplied by us infringes that third party’s intellectual property rights, provided you tell us promptly, let us control the defence, and do not settle without our consent. This does not cover Customer Data, your templates, or your modifications or use contrary to this agreement.',
        },
      ],
    },
    {
      id: 'changes',
      heading: '16. Changes to these Terms',
      blocks: [
        {
          kind: 'text',
          text: 'We may update these Terms. Every document carries a version number and an effective date, and previous versions remain available on request.',
        },
        {
          kind: 'text',
          text: 'For changes of substance we will give at least 30 days notice by email or in the dashboard, and you will be asked to accept the new version when you next sign in. We record which version you accepted, when, and from which IP address. If you do not accept a new version you may terminate before it takes effect; continuing to use the Service after that date means you accept it.',
        },
      ],
    },
    {
      id: 'force-majeure',
      heading: '17. Force majeure',
      blocks: [
        {
          kind: 'text',
          text: 'Neither party is liable for a failure or delay caused by something beyond its reasonable control, including natural disaster, war, civil unrest, epidemic, labour dispute, failure of a utility or telecommunications provider, government action, or a widespread internet or cloud-provider outage. The affected party will mitigate and will tell the other promptly. If the event continues for more than 60 days, either party may terminate.',
        },
      ],
    },
    {
      id: 'grievance',
      heading: '18. Complaints and dispute resolution',
      blocks: [
        {
          kind: 'text',
          text: `Please raise any complaint first with our Grievance Officer, ${co.grievanceOfficerName}, at ${co.grievanceOfficerEmail}. We will acknowledge within 48 hours and aim to resolve within 15 days, as described in the Grievance Redressal Policy.`,
        },
        {
          kind: 'text',
          text: `If a dispute is not resolved within 30 days of being raised in writing, either party may pursue it in the courts. This agreement is governed by ${co.governingLaw}, and the courts at ${co.jurisdictionCity} have exclusive jurisdiction, except that either party may seek urgent injunctive relief anywhere.`,
        },
        {
          kind: 'text',
          text: 'Nothing in this clause prevents you from approaching a consumer forum, a data protection authority, or the Data Protection Board of India where you are entitled to do so.',
        },
      ],
    },
    {
      id: 'general',
      heading: '19. General',
      blocks: [
        {
          kind: 'list',
          items: [
            `Notices to us: ${co.contactEmail}, or in writing to ${co.address}. Notices to you: the email address on your account, or a notice in the dashboard.`,
            'Assignment: you may not assign this agreement without our written consent. We may assign it as part of a merger, reorganisation or sale of the business, on notice to you.',
            'No partnership: nothing here creates a partnership, agency or employment relationship.',
            'Severability: if a clause is held unenforceable, the rest stands and the clause is read down to the minimum extent necessary.',
            'No waiver: not enforcing a right is not a waiver of it.',
            'Entire agreement: these Terms and the documents they incorporate are the whole agreement and replace earlier discussions. Neither party relies on any statement not written here.',
            'Survival: clauses 6, 12, 13, 14, 15, 18 and this clause survive termination.',
            'Language: the English version prevails over any translation.',
          ],
        },
      ],
    },
  ],
};
