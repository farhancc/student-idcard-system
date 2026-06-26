'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
const ProductionDaemon = dynamic(() => import('../components/ProductionDaemon'), { ssr: false });
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Layers, 
  Clock, 
  Settings, 
  LogOut, 
  User as UserIcon,
  Crown,
  Printer,
  CreditCard
} from 'lucide-react';
import { ToastProvider } from '@/components/ui/toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/press/profile');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.ok ? await res.json() : null;
        if (data && data.success) {
          setProfile(data);
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();

    window.addEventListener('refresh-profile', checkAuth);
    return () => {
      window.removeEventListener('refresh-profile', checkAuth);
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/press/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-gradient)'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const menuItems = [
    { label: 'Overview', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Clients', path: '/dashboard/clients', icon: <Users size={18} /> },
    { label: 'Orders', path: '/dashboard/orders', icon: <FileText size={18} /> },
    { label: 'Invoices', path: '/dashboard/invoices', icon: <CreditCard size={18} /> },
    { label: 'Templates', path: '/dashboard/templates', icon: <Layers size={18} /> },
    { label: 'PDF Jobs', path: '/dashboard/pdf-jobs', icon: <Clock size={18} /> },
    { label: 'Settings', path: '/dashboard/settings', icon: <Settings size={18} /> },
  ];

  return (
    <ToastProvider>
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gradient)' }}>
      {/* Sidebar Nav */}
      <aside style={{
        width: '280px',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--glass-border)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        position: 'sticky',
        top: 0,
        height: '100vh'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px'
          }}>
            <img src="/logo.png" alt="IDexo Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>IDexo Portal</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>IDexo</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
            return (
              <a
                key={item.path}
                href={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  color: isActive ? '#ffffff' : 'var(--muted)',
                  background: isActive ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? '500' : '400'
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Tenant user detail profile card */}
        <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <UserIcon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.user?.name}
              </div>
              <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '2px 6px', marginTop: '4px' }}>
                {profile?.user?.role}
              </span>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            marginTop: '12px', 
            paddingTop: '12px', 
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.75rem' 
          }}>
            <Crown size={12} color="#fbbf24" />
            <span style={{ color: 'var(--muted)' }}>Tenant:</span>
            <span style={{ color: '#fff', fontWeight: '500' }}>{profile?.press?.name}</span>
            <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 4px', marginLeft: 'auto' }}>
              {profile?.press?.plan}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            fontSize: '0.75rem'
          }}>
            <CreditCard size={12} color="var(--warning)" />
            <span style={{ color: 'var(--muted)' }}>Print Credits:</span>
            <span style={{ color: 'var(--warning)', fontWeight: '600', marginLeft: 'auto' }}>
              {profile?.press?.credits ?? 0}
            </span>
          </div>

          {profile?.press?.lockedCredits > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px',
              fontSize: '0.7rem',
              color: 'var(--muted)'
            }}>
              <span style={{ marginLeft: '18px' }}>Locked:</span>
              <span style={{ color: 'var(--warning)', fontWeight: '500', marginLeft: 'auto' }}>
                {profile?.press?.lockedCredits} pending
              </span>
            </div>
          )}
        </div>

        {/* Logout btn */}
        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{
            width: '100%',
            justifyContent: 'flex-start',
            padding: '12px 16px',
            borderRadius: '10px',
            color: '#f87171',
            borderColor: 'rgba(239, 68, 68, 0.1)',
            background: 'transparent'
          }}
        >
          <LogOut size={18} />
          <span>Exit Portal</span>
        </button>
      </aside>

      {/* Main content grid */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', maxHeight: '100vh' }}>
        {children}
      </main>
      <ProductionDaemon />
    </div>
    </ToastProvider>
  );
}
