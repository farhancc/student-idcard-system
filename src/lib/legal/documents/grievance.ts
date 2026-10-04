import type { LegalDocument } from '../types';

/**
 * Required publication, not a nicety: the Consumer Protection (E-commerce)
 * Rules 2020 r.4(5) and the IT (Intermediary Guidelines) Rules 2021 r.3(2)
 * both require a named Grievance Officer with contact details and published
 * timelines, reachable by any user — not only by paying customers.
 */
export const grievancePolicy: LegalDocument = {
  slug: 'grievance-redressal',
  title: 'Grievance Redressal Policy',
  shortTitle: 'Grievance Redressal',
  summary: 'Who to contact with a complaint, how quickly we will respond, and where to escalate if we get it wrong.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['PUBLIC', 'PRESS', 'CLIENT', 'CARDHOLDER'],
  consentPoints: [],
  sections: (co) => [
    {
      id: 'officer',
      heading: '1. Grievance Officer',
      blocks: [
        {
          kind: 'text',
          text: 'Anyone may complain — a press, a client organisation, a cardholder, a parent, or a member of the public. You do not need an account.',
        },
        {
          kind: 'table',
          columns: ['', ''],
          rows: [
            ['Name', co.grievanceOfficerName],
            ['Designation', 'Grievance Officer'],
            ['Email', co.grievanceOfficerEmail],
            ['Phone', co.grievanceOfficerPhone],
            ['Address', co.address],
            ['Entity', co.entityName],
          ],
        },
        {
          kind: 'text',
          text: `For privacy and data protection requests specifically, ${co.privacyEmail} reaches the same team and is usually faster. To report a security vulnerability, use ${co.securityEmail}.`,
        },
      ],
    },
    {
      id: 'what',
      heading: '2. What to include',
      blocks: [
        {
          kind: 'list',
          items: [
            'Your name and a way to reach you.',
            'Which account, press, organisation or card the complaint concerns, if you know.',
            'What happened, with dates, and what you would like us to do.',
            'For an intellectual property complaint: what work is affected, what rights you hold, and which listing or template is involved.',
            'For a complaint about someone else’s data: your relationship to that person, so we can check you are entitled to act for them.',
          ],
        },
      ],
    },
    {
      id: 'timelines',
      heading: '3. What happens, and when',
      blocks: [
        {
          kind: 'table',
          columns: ['Stage', 'Timeline'],
          rows: [
            ['We acknowledge your complaint and give it a reference', 'Within 48 hours'],
            ['We investigate and respond with a decision and reasons', 'Within 15 days'],
            ['A complaint needing a third party’s input — a press, a client organisation or a supplier', 'Within 30 days; we will tell you if it will take that long and why'],
            ['Content that is unlawful on its face, or a child-safety concern', 'Access removed as soon as we are satisfied, and in any case within 36 hours of a valid order or report'],
            ['A data protection request under the DPDP Act or the GDPR', 'Within 30 days'],
          ],
        },
        {
          kind: 'text',
          text: 'If we need more information from you, the clock pauses until you send it. We will keep you updated rather than leaving you to chase.',
        },
      ],
    },
    {
      id: 'about-a-press',
      heading: '4. If your complaint is about a press or an organisation, not about us',
      blocks: [
        {
          kind: 'text',
          text: 'Much of the data in the Service belongs to a printing press or its client organisation, and they — not we — decide what happens to it. Where that is the case we will tell you who is responsible, pass your complaint to them, and tell you we have done so. If they fail to act on something the law requires, we will follow it up, and we may suspend their access.',
        },
      ],
    },
    {
      id: 'escalation',
      heading: '5. Escalating beyond us',
      blocks: [
        {
          kind: 'text',
          text: 'If you are not satisfied with our response, you can go further, and you do not need our agreement to do so:',
        },
        {
          kind: 'list',
          items: [
            'Data protection — the Data Protection Board of India, or your local supervisory authority if you are in the EU or the UK.',
            'Consumer complaints — the National Consumer Helpline, or the consumer commission for your district or state.',
            'Content and intermediary complaints — the Grievance Appellate Committee established under the IT Rules, 2021.',
            `Anything else — the courts at ${co.jurisdictionCity}.`,
          ],
        },
        {
          kind: 'text',
          text: 'We publish this policy, and the identity of the Grievance Officer, because the law requires it. We would rather fix the problem than be escalated, so please tell us first.',
        },
      ],
    },
  ],
};
