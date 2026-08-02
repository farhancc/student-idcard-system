import React from 'react';
import './portal.css';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="portal-root">
      {children}
    </div>
  );
}
