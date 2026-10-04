import type { LegalDocument } from '../types';

/**
 * There is no consent banner because there is nothing to consent to: the only
 * cookies set are the session cookies, which are strictly necessary. Keep this
 * document honest — if a non-essential cookie or a third-party analytics script
 * is ever added, this notice and the banner question both have to change.
 */
export const cookieNotice: LegalDocument = {
  slug: 'cookies',
  title: 'Cookie and Local Storage Notice',
  shortTitle: 'Cookie Notice',
  summary: 'The short version: only the cookies that make signing in work, no advertising or tracking cookies, so no consent banner.',
  version: '1.0',
  effectiveDate: '2026-10-01',
  audiences: ['PUBLIC'],
  consentPoints: [],
  sections: (co) => [
    {
      id: 'summary',
      heading: '1. In short',
      blocks: [
        {
          kind: 'text',
          text: 'We set only strictly necessary cookies — the ones that keep you signed in and protect the session. We do not run advertising, cross-site tracking or third-party analytics cookies, and we do not build profiles of visitors. That is why you are not asked to accept cookies: there is nothing optional to accept.',
        },
      ],
    },
    {
      id: 'cookies',
      heading: '2. Cookies we set',
      blocks: [
        {
          kind: 'table',
          columns: ['Name', 'Purpose', 'Type', 'Lifetime'],
          rows: [
            ['press_auth_token', 'Keeps a press user signed in and carries the signed session that authorises each request', 'Strictly necessary, first-party, HTTP-only', 'Until the session expires or you sign out'],
            ['super_auth_token', 'The equivalent session cookie for platform administrators', 'Strictly necessary, first-party, HTTP-only', 'Until the session expires or you sign out'],
          ],
        },
        {
          kind: 'text',
          text: 'Both are first-party, are marked HTTP-only so page scripts cannot read them, and are sent only over HTTPS in production. Blocking them means you cannot sign in.',
        },
        {
          kind: 'text',
          text: 'The public landing page and the enrolment and organisation portals set no cookies at all until you sign in.',
        },
      ],
    },
    {
      id: 'local-storage',
      heading: '3. Browser storage',
      blocks: [
        {
          kind: 'text',
          text: 'A few small values are kept in your browser’s local storage rather than in a cookie. They never leave your device and are not sent to us.',
        },
        {
          kind: 'table',
          columns: ['Key', 'Purpose'],
          rows: [
            ['idexo_tour_v1_done', 'Remembers that you have finished or dismissed the product tour, so it does not reappear'],
            ['last_successful_login', 'Remembers the email address you last signed in with, so it can be refilled on the login form. The password is not stored.'],
          ],
        },
        {
          kind: 'text',
          text: 'You can clear these at any time by clearing site data in your browser. Nothing breaks; you will simply see the tour again and have to retype your email.',
        },
      ],
    },
    {
      id: 'desktop',
      heading: '4. The desktop application',
      blocks: [
        {
          kind: 'text',
          text: 'If you install the desktop client and tick "remember me", your sign-in details are stored on that computer using the operating system’s encrypted credential store. Where the operating system does not offer one, they are written to the application’s data folder instead, which is protected only by your user account — so do not use "remember me" on a shared machine. Signing out, or unticking the option, removes them.',
        },
      ],
    },
    {
      id: 'third-party',
      heading: '5. Third-party requests',
      blocks: [
        {
          kind: 'text',
          text: 'Some pages load resources from third parties, which means your browser contacts them directly and they see your IP address and user agent. They do not set tracking cookies through us.',
        },
        {
          kind: 'list',
          items: [
            'Google Fonts — web fonts for the template designer.',
            'Cloudinary and Cloudflare R2 — the images, photographs and generated files your account has stored.',
            'Stripe — only on the payment pages, and subject to Stripe’s own policy.',
            'Sentry — error reports, sent from the page when something goes wrong.',
          ],
        },
        {
          kind: 'text',
          text: `More detail on all of these is in the Privacy Policy. Questions to ${co.privacyEmail}.`,
        },
      ],
    },
  ],
};
