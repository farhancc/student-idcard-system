import type { LegalDocument } from '../types';

/**
 * The only legal document in this set written for someone who did not choose to
 * be here: a student, parent or employee filling in an enrolment link. Plain
 * language, short sentences, no cross-references they cannot follow. It is
 * linked from the enrolment form and is the notice required by DPDP s.5.
 */
export const cardholderNotice: LegalDocument = {
  slug: 'cardholder-notice',
  title: 'Cardholder Privacy Notice',
  shortTitle: 'Cardholder Privacy Notice',
  summary: 'For students, parents and employees filling in an ID card form: what happens to your details and your photo, and how to say no.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['CARDHOLDER', 'PUBLIC'],
  consentPoints: ['CARDHOLDER_ENROLMENT'],
  sections: (co) => [
    {
      id: 'why',
      heading: 'Why you are being asked for this',
      blocks: [
        {
          kind: 'text',
          text: 'Your school, college or employer is having identity cards made. They have asked a printing press to do it, and the press uses software called IDexo to collect the details and print the cards. This page explains what happens to what you type in.',
        },
        {
          kind: 'text',
          text: 'If you are a parent filling this in for your child, the same explanation applies to your child’s details.',
        },
      ],
    },
    {
      id: 'what',
      heading: 'What is collected',
      blocks: [
        {
          kind: 'text',
          text: 'Only what the card itself needs. The form shows you exactly which fields those are — usually a name and a photograph, and sometimes a class or department, an identification number, a date of birth or a blood group. Nothing is collected in the background: there is no tracking, no location, no contact-list access, and no advertising.',
        },
        {
          kind: 'text',
          text: 'Your photograph is used to print your card. It is not used to identify you anywhere else, is not matched against any face database, and is not used to train any kind of artificial intelligence.',
        },
      ],
    },
    {
      id: 'who',
      heading: 'Who can see it',
      blocks: [
        {
          kind: 'list',
          items: [
            'Your organisation — the school, college or employer that asked for the card.',
            'The printing press producing the card, and nobody else’s press: the software keeps each press’s records separate.',
            `${co.brand}, which runs the software and the storage, and the technology suppliers listed in our Privacy Policy. We only act on the press’s instructions.`,
          ],
        },
        {
          kind: 'text',
          text: 'Your details are not sold, not shared for advertising, and not given to anyone else unless the law requires it.',
        },
      ],
    },
    {
      id: 'children',
      heading: 'If the cardholder is under 18',
      blocks: [
        {
          kind: 'text',
          text: 'A parent or lawful guardian must agree before a child’s details and photograph are submitted. The form asks who is giving that agreement and records the answer. We do not track children, profile them, or show them advertising — and under India’s Digital Personal Data Protection Act, 2023 we are not permitted to.',
        },
      ],
    },
    {
      id: 'how-long',
      heading: 'How long it is kept',
      blocks: [
        {
          kind: 'text',
          text: 'Your organisation decides. Normally the details are kept while you are a student, member or employee, and are deleted when the organisation no longer needs them. When they are deleted, the photograph is deleted from storage too. The printed card itself is yours; only the digital copy is deleted.',
        },
      ],
    },
    {
      id: 'rights',
      heading: 'What you can ask for',
      blocks: [
        {
          kind: 'list',
          items: [
            'To see what is held about you.',
            'To have a mistake corrected — a misspelt name, the wrong class, a bad photograph.',
            'To have your details deleted when the card is no longer needed.',
            'To withdraw agreement you gave, including agreement a parent gave for a child. If you do this before the card is printed, the card will not be printed.',
            'To nominate someone to act for you if you become unable to.',
          ],
        },
        {
          kind: 'text',
          text: 'Ask your school, college or employer first — they decide, and they can act fastest. If they do not help, or you cannot reach them, write to us:',
        },
        {
          kind: 'list',
          items: [
            `Email: ${co.privacyEmail}`,
            `Grievance Officer: ${co.grievanceOfficerName} — ${co.grievanceOfficerEmail}, ${co.grievanceOfficerPhone}`,
            `Post: ${co.address}`,
          ],
        },
        {
          kind: 'text',
          text: 'We will acknowledge within 48 hours and respond within 30 days. We will pass your request to the organisation responsible and tell you that we have.',
        },
      ],
    },
    {
      id: 'complain',
      heading: 'If you are not happy with the answer',
      blocks: [
        {
          kind: 'text',
          text: 'You can complain to the Data Protection Board of India. If you are in the EU or the UK, you can complain to your local data protection authority instead. You do not need our permission, and it costs you nothing.',
        },
      ],
    },
    {
      id: 'care',
      heading: 'One thing to be careful about',
      blocks: [
        {
          kind: 'note',
          text: 'The link you used to open the form lets anyone who has it submit a record. Do not forward it to a group chat or post it publicly — send it only to the people who are supposed to be filling it in.',
        },
      ],
    },
  ],
};
