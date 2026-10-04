import type { LegalDocument } from '../types';

/**
 * Credits are the product's unit of account, and the code already defines their
 * behaviour precisely (holds, capture on completion, refund on failure or
 * cancellation, promo credits that are not purchased). This document states
 * that behaviour as a commitment, which the e-commerce rules require to be
 * published before a customer pays.
 */
export const billingPolicy: LegalDocument = {
  slug: 'billing',
  title: 'Billing, Credits and Refunds Policy',
  shortTitle: 'Billing & Refunds',
  summary: 'How credits are priced and consumed, how plans and invoices work, and when you get your money or credits back.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['PRESS'],
  consentPoints: ['PRESS_SIGNUP'],
  sections: (co) => [
    {
      id: 'credits',
      heading: '1. How credits work',
      blocks: [
        {
          kind: 'list',
          items: [
            'Credits are prepaid units. You buy them in advance and spend them when the Service compiles print-ready output.',
            'The credit cost of each type of output is shown in the dashboard before you confirm a job. The rate that applies is the one shown at the moment you confirm.',
            'When you start a job, the credits it needs are placed on hold so they cannot be spent twice. They are charged when the job completes successfully.',
            'If a job fails, or you cancel it before it completes, the held credits are returned to your balance in full. You are not charged for output you did not receive.',
            'Credits are tied to your account. They are not money, carry no interest, and cannot be transferred to another press, exchanged or encashed.',
            'Credits do not expire while your account is open and in good standing.',
          ],
        },
        {
          kind: 'text',
          text: 'Promotional credits — for example the welcome balance on a new account, or credits we grant as a goodwill gesture — work the same way when spent, but they were never paid for, so they are not refundable and are not included in any refund calculation.',
        },
      ],
    },
    {
      id: 'prices',
      heading: '2. Prices, plans and taxes',
      blocks: [
        {
          kind: 'list',
          items: [
            'Plan tiers determine your per-credit price and the features available. Current prices are shown in the dashboard.',
            'We may change prices. A change takes effect for purchases made after we publish it, and we will give at least 30 days notice before increasing the price of a recurring subscription. Credits you have already bought are unaffected.',
            'Unless stated otherwise, prices are exclusive of taxes. GST and any other applicable tax is added at the prevailing rate and shown on your invoice.',
            `If you are registered for GST, give us your GSTIN in settings so your invoice is issued correctly.${co.gstin ? ` Our GSTIN is ${co.gstin}.` : ''}`,
            'Payment is made through our payment processor. Card details are collected by them and never reach our servers.',
          ],
        },
      ],
    },
    {
      id: 'invoices',
      heading: '3. Invoices and records',
      blocks: [
        {
          kind: 'text',
          text: 'An invoice is generated for each purchase and is available for download in the dashboard. We keep invoices and payment records for 8 years, as Indian tax and company law requires, even if you close your account.',
        },
        {
          kind: 'text',
          text: 'Every credit movement — purchase, grant, hold, charge and return — is recorded in your credit history with a reason. If your balance does not look right, that history is where to start, and we will reconcile it with you.',
        },
      ],
    },
    {
      id: 'refunds',
      heading: '4. Cancellation and refunds',
      blocks: [
        {
          kind: 'text',
          text: 'Credits are a prepaid digital service, and a credit that has been spent on output you received is not refundable. Beyond that:',
        },
        {
          kind: 'table',
          columns: ['Situation', 'What you get'],
          rows: [
            ['A job fails or you cancel it before it completes', 'The held credits return to your balance automatically. No action needed.'],
            ['Output is defective because of a fault in the Service — corrupt PDF, wrong field rendered, missing photographs', 'Tell us within 7 days. We will investigate and, if the fault was ours, return the credits spent on the affected job.'],
            ['You bought credits by mistake, or twice, and have not spent them', 'Ask within 14 days of the purchase and we will refund the unspent credits to the original payment method.'],
            ['You close your account with unspent purchased credits', 'Ask within 30 days of closure and we will refund unspent purchased credits, less any amount you owe us. Promotional credits are not refunded.'],
            ['We withdraw the Service, or terminate without cause', 'We refund all unspent purchased credits.'],
            ['We suspend or terminate your account for breach of the Terms or the Acceptable Use Policy', 'No refund.'],
            ['A Marketplace listing fee', 'Not refundable once the listing is created, including if you later delist.'],
            ['A Marketplace template purchase', 'See the Marketplace Terms. A template is delivered instantly and copied into your library, so it is not refundable except where it was misdescribed or infringing.'],
          ],
        },
        {
          kind: 'text',
          text: `To request a refund, write to ${co.contactEmail} from the email address on the account, with the invoice number. We will decide within 15 days and, where a refund is due, pay it to the original payment method within a further 7 working days. Your bank may take longer to show it.`,
        },
        {
          kind: 'text',
          text: 'A subscription you cancel stops at the end of the period you have paid for. We do not pro-rate a part-used subscription period unless the law requires us to.',
        },
      ],
    },
    {
      id: 'non-payment',
      heading: '5. Non-payment and chargebacks',
      blocks: [
        {
          kind: 'text',
          text: 'If a payment fails or is reversed, we will tell you and give you 14 days to put it right before suspending the account. Suspension does not delete your data; termination follows the process in the Terms of Service.',
        },
        {
          kind: 'text',
          text: 'If you raise a chargeback instead of contacting us, we may suspend the account while the dispute is resolved and may set off the disputed amount against your credit balance. Please talk to us first — most billing problems are a misunderstanding we can fix the same day.',
        },
      ],
    },
    {
      id: 'complaints',
      heading: '6. Billing complaints',
      blocks: [
        {
          kind: 'text',
          text: `Billing complaints go to ${co.contactEmail}, and may be escalated to our Grievance Officer, ${co.grievanceOfficerName}, at ${co.grievanceOfficerEmail}. If you are a consumer, nothing in this policy limits your rights under the Consumer Protection Act, 2019.`,
        },
      ],
    },
  ],
};
