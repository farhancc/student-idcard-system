import type { LegalDocument } from '../types';

/**
 * The policy that matters most for this particular product: a tool that mass
 * produces identity credentials is a tool that can mass produce forged ones.
 */
export const acceptableUsePolicy: LegalDocument = {
  slug: 'acceptable-use',
  title: 'Acceptable Use Policy',
  shortTitle: 'Acceptable Use Policy',
  summary: 'What you may and may not produce with the Service — in particular, the prohibition on cards that imitate official credentials.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['PRESS', 'CLIENT'],
  consentPoints: ['PRESS_SIGNUP'],
  sections: (co) => [
    {
      id: 'purpose',
      heading: '1. Why this policy exists',
      blocks: [
        {
          kind: 'text',
          text: 'The Service produces identity credentials at scale. In the wrong hands that is a forgery machine. This policy sets the line, and we enforce it: a breach is a material breach of the Terms of Service and can result in immediate suspension without notice.',
        },
        {
          kind: 'text',
          text: 'It applies to you, to your users, to your client organisations, and to anyone you give an enrolment or portal link to. You are responsible for their conduct on your account.',
        },
      ],
    },
    {
      id: 'permitted',
      heading: '2. What the Service is for',
      blocks: [
        {
          kind: 'text',
          text: 'Producing identity cards, badges and passes for an organisation that is entitled to issue them to its own students, employees, members, contractors or visitors — for example school and college ID cards, staff badges, library cards, membership cards, visitor passes, event passes and gate passes.',
        },
      ],
    },
    {
      id: 'prohibited-credentials',
      heading: '3. Prohibited: cards that imitate official credentials',
      blocks: [
        {
          kind: 'note',
          text: 'You must not use the Service to produce, or help anyone produce, a card that an ordinary person could mistake for an official or regulated credential.',
        },
        {
          kind: 'text',
          text: 'This includes anything that reproduces, imitates or could be passed off as:',
        },
        {
          kind: 'list',
          items: [
            'a government-issued identity document — Aadhaar, PAN, voter ID, driving licence, passport, ration card, or any national or state identity card;',
            'police, armed forces, paramilitary, intelligence or prison-service identification, or any card bearing their insignia;',
            'the identification of a court, legislature, tax authority, customs or any other public authority or regulator;',
            'a press card, a bar council or medical council registration, a pilot or aviation credential, or any professional licence that a regulator issues;',
            'a credential of an organisation you do not represent and have not been authorised by;',
            'a card bearing the emblem, seal, flag or insignia of a government or international body, where its use is restricted by law — in India, including the Emblems and Names (Prevention of Improper Use) Act, 1950;',
            'a payment card, or anything designed to resemble one.',
          ],
        },
        {
          kind: 'text',
          text: 'Producing a genuine card for a public body that has engaged you to do so is permitted. The prohibition is on imitation and on work you are not authorised to do. We may ask you to evidence that authority, and may suspend the work until you do.',
        },
      ],
    },
    {
      id: 'prohibited-conduct',
      heading: '4. Prohibited: other uses',
      blocks: [
        {
          kind: 'list',
          items: [
            'Producing a card intended to deceive anyone about who the holder is, how old they are, or what they are entitled to access, do or claim.',
            'Entering data about a person you have no lawful basis to process, or a child’s data without verifiable parental or guardian consent.',
            'Uploading someone else’s photograph without their knowledge, or scraping photographs from social media or any other source.',
            'Uploading artwork, logos, fonts, images or templates you do not have the rights to use, or listing them on the Marketplace.',
            'Using roster data for anything other than producing the cards it was collected for — no marketing, no profiling, no onward sale.',
            'Uploading malware, or a file crafted to exploit the image, PDF, font or import pipeline.',
            'Probing, scanning or load-testing the Service, attempting to reach another tenant’s data, bypassing rate limits, tenant scoping, credit accounting or signed URLs, or using an API key you were not issued.',
            'Automated access that degrades the Service for others, or scraping the Service or the Marketplace in bulk.',
            'Reselling or sublicensing access to the Service, or operating it as your own white-label product, without a written agreement with us.',
            'Anything unlawful, including identity fraud, impersonation, harassment, and infringement of intellectual property or privacy rights.',
          ],
        },
      ],
    },
    {
      id: 'reporting',
      heading: '5. Reporting and enforcement',
      blocks: [
        {
          kind: 'text',
          text: `Report suspected misuse to ${co.contactEmail}. Marketplace listings can also be reported from the listing itself.`,
        },
        {
          kind: 'text',
          text: 'Where we reasonably believe this policy has been breached we may, proportionately to the severity: ask you for an explanation; remove or delist specific content; suspend a user, an API key, a template or the whole account; and terminate the agreement. For a serious and unambiguous breach — forged official credentials, child-safety concerns, or an attack on the Service — we act first and explain afterwards.',
        },
        {
          kind: 'text',
          text: 'We will report conduct to law enforcement where we are required to, and we may do so where we believe there is a risk of serious harm. We will cooperate with a lawful investigation.',
        },
        {
          kind: 'text',
          text: 'Suspension for breach of this policy does not entitle you to a refund of unused credits.',
        },
      ],
    },
  ],
};
