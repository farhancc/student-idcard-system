This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# student-idcard-system

## Legal configuration

The published legal documents live in `src/lib/legal/documents/` and are served
at `/legal`. They name the operating entity, its address and its Grievance
Officer, and those details come from the environment — not from the code — so
set them before offering the service commercially. Until they are set the
documents fall back to honest placeholders, `/legal` shows a warning outside
production, and `legalIdentityWarnings()` lists what is missing.

| Variable | Required | Purpose |
| --- | --- | --- |
| `LEGAL_ENTITY_NAME` | yes | Registered legal name of the contracting entity |
| `LEGAL_ENTITY_FORM` | yes | e.g. `a private limited company incorporated in India` |
| `LEGAL_ADDRESS` | yes | Registered office, single line |
| `LEGAL_CONTACT_EMAIL` | yes | General legal contact |
| `LEGAL_PRIVACY_EMAIL` | yes | Receives data-principal / data-subject requests |
| `LEGAL_GRIEVANCE_OFFICER_NAME` | yes | Named officer, required by the Indian e-commerce and IT rules |
| `LEGAL_GRIEVANCE_OFFICER_EMAIL` | yes | |
| `LEGAL_GRIEVANCE_OFFICER_PHONE` | yes | |
| `LEGAL_WEBSITE` | yes | Canonical site URL |
| `LEGAL_BRAND` | no | Product name, defaults to `IDexo` |
| `LEGAL_CIN` / `LEGAL_GSTIN` | no | Printed on the policies and invoices when set |
| `LEGAL_COUNTRY` | no | Defaults to `India` |
| `LEGAL_JURISDICTION_CITY` | no | Seat of courts, defaults to `Bengaluru, Karnataka` |
| `LEGAL_GOVERNING_LAW` | no | Defaults to `the laws of India` |
| `LEGAL_SECURITY_EMAIL` | no | Vulnerability reports, defaults to the legal contact |

### Changing a document

Each document carries a `version` and an `effectiveDate`. Acceptance is recorded
against the version, and every press owner is re-prompted by the dashboard gate
when a version they accepted is superseded — so bump `version` only for a change
of substance, and edit wording in place otherwise.

Agreement is recorded in `legal_acceptances` at four points, each enforced
server-side and not merely in the UI: press signup, client-organisation signup,
portal enrolment (including named guardian consent where the cardholder is under
18) and marketplace listing.

> These documents were drafted to cover the obligations this codebase actually
> creates, under Indian law with GDPR-compatible processor terms. They have not
> been reviewed by a lawyer. Have counsel review them before you rely on them.
