import type { LegalDocument } from '../types';

/**
 * Accepted by a school, company or other organisation registering itself under
 * a press at /client-signup. Short on purpose: these people have no commercial
 * relationship with us, and the one thing we need from them is the warranty
 * that they are entitled to hand us a roster of children's photographs.
 */
export const clientOrganisationTerms: LegalDocument = {
  slug: 'client-terms',
  title: 'Client Organisation Terms',
  shortTitle: 'Client Organisation Terms',
  summary: 'For schools, colleges, companies and other organisations registering with a printing press: what you are confirming when you share a roster.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['CLIENT'],
  consentPoints: ['CLIENT_SIGNUP'],
  sections: (co) => [
    {
      id: 'who',
      heading: '1. Who you are dealing with',
      blocks: [
        {
          kind: 'text',
          text: `You are registering your organisation with a printing press that uses ${co.brand} to produce identity cards. Your commercial agreement — what the cards cost, when they are delivered — is with that press, not with us. ${co.entityName} supplies the software and stores the data on the press’s instructions.`,
        },
        {
          kind: 'text',
          text: 'In data protection terms: your organisation decides what data is collected about its cardholders, the press processes it to produce your cards, and we process it for the press. Your questions about your own data start with the press; if they cannot help, our contacts are in section 6.',
        },
      ],
    },
    {
      id: 'what-you-confirm',
      heading: '2. What you confirm by registering',
      blocks: [
        {
          kind: 'list',
          ordered: true,
          items: [
            'You are authorised to register this organisation and to share its data with the press.',
            'You have a lawful basis for collecting each cardholder’s details and photograph and for having them processed to produce a card, and you have given the cardholders the notice the law requires.',
            'Where a cardholder is under 18, you hold the verifiable consent of a parent or lawful guardian, or another lawful basis available to you as an educational institution.',
            'The data you upload is accurate, is yours to share, and is limited to what the card actually needs.',
            'You will keep the enrolment and organisation links we generate confidential and will share them only with the people who should be submitting details — anyone holding a link can submit a record.',
            'You will tell the press when a cardholder leaves, so their data can be removed.',
          ],
        },
        {
          kind: 'note',
          text: 'Please do not put data on a card that the card does not need. A photograph and a name are enough for most purposes; a date of birth, a blood group or a home address each add risk if a card is lost.',
        },
      ],
    },
    {
      id: 'use',
      heading: '3. How the data is used',
      blocks: [
        {
          kind: 'text',
          text: 'Roster data you provide is used to render and print the cards you asked for, and for nothing else. We do not sell it, do not use it for advertising, and do not use it to train machine-learning models. Only the press you registered under can see it — the application separates every press’s data at the database layer.',
        },
        {
          kind: 'text',
          text: 'Cardholder photographs and generated card files are stored in encrypted object storage, and card files are served only through signed links that expire.',
        },
      ],
    },
    {
      id: 'retention',
      heading: '4. How long it is kept, and deletion',
      blocks: [
        {
          kind: 'text',
          text: 'Your press decides retention; we hold the data until they delete it. Ask your press to delete a cardholder, a batch or your whole organisation at any point, and the records and their photographs are removed from the database and from object storage. If the press is unresponsive, write to us and we will contact them and, where we are satisfied of your authority, act.',
        },
      ],
    },
    {
      id: 'conduct',
      heading: '5. Your obligations',
      blocks: [
        {
          kind: 'list',
          items: [
            'Use the Service only to get cards produced for your own cardholders.',
            'Do not ask for a card that imitates a government, police, military or regulatory credential, or that is designed to mislead anyone about who the holder is. The Acceptable Use Policy applies to you as well.',
            'Do not upload anyone’s photograph without their knowledge, or artwork and logos you are not entitled to use.',
            'Do not attempt to reach data belonging to another organisation or another press.',
          ],
        },
        {
          kind: 'text',
          text: 'We may suspend an organisation’s portal links where we reasonably believe these terms have been breached, and will tell the press why.',
        },
      ],
    },
    {
      id: 'contact',
      heading: '6. Contact',
      blocks: [
        {
          kind: 'list',
          items: [
            `Privacy and data requests: ${co.privacyEmail}`,
            `Grievance Officer: ${co.grievanceOfficerName} — ${co.grievanceOfficerEmail}, ${co.grievanceOfficerPhone}`,
            `Post: ${co.address}`,
          ],
        },
        {
          kind: 'text',
          text: 'The Privacy Policy, Acceptable Use Policy and Cardholder Privacy Notice all apply alongside these terms, and a cardholder can read the last of those for themselves.',
        },
      ],
    },
  ],
};
