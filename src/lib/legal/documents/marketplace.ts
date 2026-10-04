import type { LegalDocument } from '../types';

/**
 * The Marketplace makes presses both uploaders and buyers of each other's
 * artwork, which is the classic shape for an intellectual-property dispute.
 * Accepted at the moment of listing (MARKETPLACE_PUBLISH) rather than at
 * signup, so the warranty is given by the person who actually uploads.
 */
export const marketplaceTerms: LegalDocument = {
  slug: 'marketplace',
  title: 'Marketplace Terms',
  shortTitle: 'Marketplace Terms',
  summary: 'The rules for listing a template for sale and for buying one: what you must own, what licence passes, and how infringement is reported.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['PRESS'],
  consentPoints: ['MARKETPLACE_PUBLISH'],
  sections: (co) => [
    {
      id: 'role',
      heading: '1. Our role',
      blocks: [
        {
          kind: 'text',
          text: `The Marketplace lets presses list card templates for other presses to buy with credits. ${co.brand} provides the venue. We do not author listed templates, we do not verify ownership before publication, and we are not a party to the transaction between seller and buyer, except that we handle the credit transfer and may charge a listing fee.`,
        },
        {
          kind: 'text',
          text: 'We act as an intermediary and will act on a proper complaint, as described in section 6.',
        },
      ],
    },
    {
      id: 'seller-warranties',
      heading: '2. If you list a template, you warrant that',
      blocks: [
        {
          kind: 'list',
          ordered: true,
          items: [
            'you created the template, or you hold all rights needed to license it onward, including rights in every image, pattern, icon, illustration and logo in it;',
            'every font embedded in or required by the template is one you are licensed to distribute in this way — a desktop font licence usually does not allow redistribution;',
            'the template contains no real personal data: no real cardholder names, photographs, dates of birth or identification numbers. Use placeholders;',
            'the template does not imitate a government, police, military, regulatory or professional credential, or carry a restricted emblem — the Acceptable Use Policy applies to listings in full;',
            'the template does not reproduce the trade mark, crest or branding of an organisation you are not authorised to represent;',
            'the description, preview and price are accurate and not misleading, and the source files you attach are the ones described.',
          ],
        },
        {
          kind: 'note',
          text: 'You indemnify us and the buyer against any claim that a template you listed infringes someone’s rights. This is the clause that bites if you upload artwork you found online.',
        },
      ],
    },
    {
      id: 'licence',
      heading: '3. What licence passes',
      blocks: [
        {
          kind: 'text',
          text: 'You keep ownership of your template. By listing it you grant:',
        },
        {
          kind: 'list',
          items: [
            'us a non-exclusive, worldwide, royalty-free licence to host it, generate previews and display it in the Marketplace for as long as it is listed, and to keep serving copies already bought;',
            'each buyer a perpetual, non-exclusive, non-transferable licence to use, adapt and print cards from the template for their own client organisations.',
          ],
        },
        {
          kind: 'text',
          text: 'A buyer may not resell, relist, sublicense or redistribute a purchased template, or pass its source files to anyone outside their press. The Service enforces this: a purchased template cannot be listed on the Marketplace again.',
        },
        {
          kind: 'text',
          text: 'Delisting stops new sales. It does not revoke licences already granted — buyers keep the copy in their library.',
        },
      ],
    },
    {
      id: 'buying',
      heading: '4. Buying a template',
      blocks: [
        {
          kind: 'list',
          items: [
            'The price in credits is shown before you confirm. Credits are deducted once and the template is copied into your library immediately.',
            'Because delivery is instant and irreversible, a purchase is not refundable — except where the template was materially misdescribed, is unusable, or is removed because it infringed someone’s rights, in which case we will return the credits.',
            'Judge a template from its preview. Sellers set their own prices and we do not warrant quality, print suitability, colour accuracy or fitness for any particular card stock or printer.',
            'The seller, not us, is responsible for the template. Any statutory rights you have against the seller are unaffected by this clause.',
          ],
        },
      ],
    },
    {
      id: 'fees',
      heading: '5. Listing fees and proceeds',
      blocks: [
        {
          kind: 'text',
          text: 'A listing fee may apply, deducted in credits when the listing is created and shown to you first. It is not refundable, including if you delist or the template never sells.',
        },
        {
          kind: 'text',
          text: 'Sale proceeds are credited to the seller as credits, net of any platform share published at the time of listing. Credits are not money and cannot be encashed — see the Billing, Credits and Refunds Policy. Each party is responsible for its own taxes on Marketplace activity.',
        },
      ],
    },
    {
      id: 'takedown',
      heading: '6. Reporting a listing, and takedown',
      blocks: [
        {
          kind: 'text',
          text: `Use the report control on a listing, or write to ${co.contactEmail}. Tell us which listing, what is wrong, and — for an infringement claim — what work is infringed, what rights you hold, and that you believe in good faith that the use is unauthorised.`,
        },
        {
          kind: 'text',
          text: 'What happens next:',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            'We acknowledge within 48 hours.',
            'We may hide the listing while we look at it, and will do so immediately where the claim is clear or the content breaches the Acceptable Use Policy.',
            'We tell the seller and give them a reasonable chance to respond.',
            'We remove the listing, restore it, or keep it hidden pending resolution between the parties, and we tell both sides what we decided.',
            'Repeat infringement costs the seller their Marketplace access, and may cost them their account.',
          ],
        },
        {
          kind: 'text',
          text: 'We may remove any listing at our discretion where we reasonably believe it breaches these terms or the law. Buyers who already bought a removed template are refunded if it was removed for infringement or misdescription.',
        },
      ],
    },
  ],
};
