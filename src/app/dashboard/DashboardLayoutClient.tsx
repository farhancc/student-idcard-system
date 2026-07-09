'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
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
  CreditCard,
  Menu,
  X
} from 'lucide-react';
import { ToastProvider } from '@/components/ui/toast';

const ProductionDaemon = dynamic(() => import('../components/ProductionDaemon'), { ssr: false });

interface UserProfile {
  success?: boolean;
  user?: {
    name: string;
    role: string;
  };
  press?: {
    name: string;
    plan: string;
    credits: number;
    lockedCredits: number;
  };
}

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  initialProfile: UserProfile;
}

export default function DashboardLayoutClient({
  children,
  initialProfile,
}: DashboardLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check window resize to handle mobile responsiveness
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Sync profile update from other components
  useEffect(() => {
    async function refreshProfile() {
      try {
        const res = await fetch('/api/press/profile');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            setProfile(data);
          }
        }
      } catch (err) {
        console.error('Failed to refresh profile:', err);
      }
    }

    window.addEventListener('refresh-profile', refreshProfile);
    return () => {
      window.removeEventListener('refresh-profile', refreshProfile);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/press/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const role = profile?.user?.role ?? 'OPERATOR';

  const allMenuItems = [
    { label: 'Overview',   path: '/dashboard',           icon: <LayoutDashboard size={18} />, roles: ['OWNER', 'OPERATOR'] },
    { label: 'Clients',    path: '/dashboard/clients',   icon: <Users size={18} />,           roles: ['OWNER', 'OPERATOR'] },
    { label: 'Orders',     path: '/dashboard/orders',    icon: <FileText size={18} />,        roles: ['OWNER', 'OPERATOR'] },
    { label: 'Invoices',   path: '/dashboard/invoices',  icon: <CreditCard size={18} />,      roles: ['OWNER', 'OPERATOR'] },
    { label: 'Templates',  path: '/dashboard/templates', icon: <Layers size={18} />,          roles: ['OWNER', 'OPERATOR', 'DESIGNER'] },
    { label: 'PDF Jobs',   path: '/dashboard/pdf-jobs',  icon: <Clock size={18} />,           roles: ['OWNER', 'OPERATOR'] },
    { label: 'Settings',   path: '/dashboard/settings',  icon: <Settings size={18} />,        roles: ['OWNER', 'OPERATOR', 'DESIGNER'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(role));

  const sidebarContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', paddingLeft: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}>
            <img src="/logo.png" alt="IDexo Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#fff' }}>IDexo Portal</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>IDexo</span>
          </div>
        </div>
        {isMobile && (
          <button 
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
          return (
            <a
              key={item.path}
              href={item.path}
              onClick={() => {
                if (isMobile) setSidebarOpen(false);
              }}
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
                fontWeight: isActive ? '500' : '400',
                textDecoration: 'none'
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
            <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '2px 6px', marginTop: '4px', display: 'inline-block' }}>
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
          <span style={{ color: '#fff', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{profile?.press?.name}</span>
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

        {(profile?.press?.lockedCredits ?? 0) > 0 && (
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
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer'
        }}
      >
        <LogOut size={18} />
        <span>Exit Portal</span>
      </button>
    </>
  );

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isMobile ? 'column' : 'row', background: 'var(--bg-gradient)' }}>
        
        {/* Mobile Header */}
        {isMobile && (
          <header style={{
            height: '60px',
            background: 'var(--sidebar-bg)',
            borderBottom: '1px solid var(--glass-border)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/logo.png" alt="IDexo Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              <span style={{ fontWeight: '700', fontSize: '1rem', color: '#fff' }}>IDexo</span>
            </div>
            <button 
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px' }}
            >
              <Menu size={24} />
            </button>
          </header>
        )}

        {/* Sidebar Nav (Desktop) */}
        {!isMobile && (
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
            {sidebarContent}
          </aside>
        )}

        {/* Sidebar Nav (Mobile Drawer) */}
        {isMobile && (
          <>
            {/* Backdrop */}
            <div 
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 999,
                opacity: sidebarOpen ? 1 : 0,
                visibility: sidebarOpen ? 'visible' : 'hidden',
                transition: 'all 0.3s ease'
              }}
            />
            {/* Drawer Panel */}
            <aside style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '280px',
              background: 'var(--sidebar-bg)',
              borderRight: '1px solid var(--glass-border)',
              boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 16px',
              zIndex: 1000,
              transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {sidebarContent}
            </aside>
          </>
        )}

        {/* Main content grid */}
        <main style={{ 
          flex: 1, 
          minWidth: 0,
          padding: isMobile ? '24px 16px' : '40px', 
          overflowY: 'auto', 
          maxHeight: isMobile ? 'calc(100vh - 60px)' : '100vh' 
        }}>
          {children}
        </main>
        <ProductionDaemon />
      </div>
    </ToastProvider>
  );
}
