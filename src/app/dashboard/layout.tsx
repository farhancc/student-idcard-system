import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardLayoutClient from './DashboardLayoutClient';
import LegalAcceptanceGate from './LegalAcceptanceGate';
import { pendingLegalDocuments } from '@/lib/legal/acceptance';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const press = await prisma.press.findUnique({
    where: { id: session.pressId },
  });

  if (!press) {
    redirect('/login');
  }

  const lockedJobs = await prisma.pdfJob.aggregate({
    where: {
      pressId: press.id,
      isLocalJob: true,
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    _sum: {
      creditsLocked: true,
    },
  });
  const lockedCredits = lockedJobs._sum.creditsLocked || 0;

  // Resolved here rather than fetched by the gate, so the dashboard is never
  // briefly usable before the gate appears.
  const pendingLegal = await pendingLegalDocuments('PRESS_USER', session.userId);

  // Serialise dates to prevent Next.js client-server boundary errors
  const profile = {
    success: true,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
    press: {
      id: press.id,
      name: press.name,
      email: press.email,
      phone: press.phone,
      city: press.city,
      plan: press.plan,
      credits: (press.credits || 0) + (press.promoCredits || 0),
      paidCredits: press.credits || 0,
      promoCredits: press.promoCredits || 0,
      lockedCredits,
      trialEndsAt: press.trialEndsAt ? press.trialEndsAt.toISOString() : null,
      isActive: press.isActive,
    },
  };

  return (
    <DashboardLayoutClient initialProfile={profile}>
      <LegalAcceptanceGate
        pending={pendingLegal.map(doc => ({
          slug: doc.slug,
          title: doc.title,
          version: doc.version,
          summary: doc.summary,
          effectiveDate: doc.effectiveDate,
        }))}
      />
      {children}
    </DashboardLayoutClient>
  );
}
