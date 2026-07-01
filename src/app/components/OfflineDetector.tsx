'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Fetch helper with timeout to prevent hanging requests
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export default function OfflineDetector() {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineType, setOfflineType] = useState<'network' | 'server' | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const [countdown, setCountdown] = useState(12);

  // Check the connection health
  const checkHealth = useCallback(async () => {
    // 1. Check browser network status first
    if (!navigator.onLine) {
      setIsOffline(true);
      setOfflineType('network');
      return false;
    }

    try {
      // 2. Ping the server health endpoint
      const response = await fetchWithTimeout('/api/health');
      if (response.ok) {
        // If it was offline, show the restored notification
        if (isOffline) {
          setIsOffline(false);
          setOfflineType(null);
          setShowRestored(true);
          // Hide restoration banner after 3 seconds
          setTimeout(() => setShowRestored(false), 3000);
        }
        return true;
      } else {
        setIsOffline(true);
        setOfflineType('server');
        return false;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('Health check timed out or was aborted');
      } else {
        console.warn('Health check failed:', error);
      }
      setIsOffline(true);
      setOfflineType('server');
      return false;
    }
  }, [isOffline]);

  // Handle manual retry
  const handleRetry = async () => {
    if (isChecking) return;
    setIsChecking(true);
    // Reset countdown
    setCountdown(12);
    
    const wasSuccess = await checkHealth();
    
    // UI polish: stay in checking state briefly so it feels solid
    setTimeout(() => {
      setIsChecking(false);
    }, 600);
  };

  // 1. Event Listeners for browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      // Immediately verify server status if we just reconnected to the internet
      checkHealth();
    };

    const handleOffline = () => {
      setIsOffline(true);
      setOfflineType('network');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    checkHealth();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkHealth]);

  // 2. Periodic background ping & countdown timer
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let timerId: NodeJS.Timeout;

    if (isOffline) {
      // Timer for auto-retry visual countdown
      timerId = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Auto trigger check
            checkHealth();
            return 12;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // If online, perform background check every 15 seconds
      intervalId = setInterval(() => {
        checkHealth();
      }, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timerId) clearInterval(timerId);
    };
  }, [isOffline, checkHealth]);

  // Reset countdown if offline type changes
  useEffect(() => {
    if (isOffline) {
      setCountdown(12);
    }
  }, [isOffline, offlineType]);

  // Don't render anything if we're online and no restored toast is needed
  if (!isOffline && !showRestored) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.3; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .offline-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(3, 4, 7, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          animation: fadeIn 0.3s ease-out forwards;
        }
        .offline-card {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          width: 90%;
          max-width: 440px;
          padding: 40px 32px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          animation: scaleUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .icon-container {
          width: 72px;
          height: 72px;
          margin: 0 auto 24px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ring-pulse {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        .ring-network { background: rgba(239, 68, 68, 0.12); }
        .ring-server { background: rgba(245, 158, 11, 0.12); }
        .ring-checking { background: rgba(79, 70, 229, 0.12); }
        
        .icon-box {
          position: relative;
          z-index: 1;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
        }
        .icon-network {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: var(--danger);
        }
        .icon-server {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
          color: var(--warning);
        }
        .icon-checking {
          background: rgba(79, 70, 229, 0.15);
          border-color: rgba(79, 70, 229, 0.3);
          color: var(--primary);
        }
        
        .offline-card h2 {
          font-size: 1.35rem;
          margin-bottom: 10px;
          font-weight: 600;
          color: #ffffff;
        }
        .offline-card p {
          font-size: 0.9rem;
          color: var(--muted);
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .offline-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 99px;
          font-size: 0.75rem;
          font-weight: 500;
          margin-bottom: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .dot-network { background: var(--danger); }
        .dot-server { background: var(--warning); }
        .dot-checking {
          background: var(--primary);
          animation: blink 0.8s infinite alternate;
        }
        @keyframes blink {
          from { opacity: 0.4; }
          to { opacity: 1; }
        }
        
        .restored-toast {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100000;
          background: rgba(16, 185, 129, 0.95);
          border: 1px solid rgba(16, 185, 129, 0.4);
          backdrop-filter: blur(8px);
          color: #ffffff;
          padding: 10px 20px;
          border-radius: 30px;
          font-size: 0.875rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .spin-loader {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}} />

      {/* Connection Restored Toast */}
      {showRestored && (
        <div className="restored-toast">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Connection Restored. Online.
        </div>
      )}

      {/* Main Block Overlay */}
      {isOffline && (
        <div className="offline-overlay">
          <div className="offline-card">
            
            <div className="icon-container">
              <div className={`ring-pulse ${isChecking ? 'ring-checking' : offlineType === 'network' ? 'ring-network' : 'ring-server'}`} />
              <div className={`icon-box ${isChecking ? 'icon-checking' : offlineType === 'network' ? 'icon-network' : 'icon-server'}`}>
                {isChecking ? (
                  <svg className="spin-loader" style={{ width: '22px', height: '22px' }} viewBox="0 0 24 24"></svg>
                ) : offlineType === 'network' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.5M5 12.5a10.94 10.94 0 0 1 5.83-2.84M7.36 7.36A15 15 0 0 1 12 6c3.27 0 6.27 1.05 8.72 2.8M10.88 5.4A19.82 19.82 0 0 1 12 5c6.08 0 11.3 3.47 13.9 8.6M10.22 15.65a4.7 4.7 0 0 1 3.56 0M12 18.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                    <line x1="6" y1="6" x2="6.01" y2="6"/>
                    <line x1="6" y1="18" x2="6.01" y2="18"/>
                  </svg>
                )}
              </div>
            </div>

            <h2>
              {isChecking 
                ? 'Reconnecting...' 
                : offlineType === 'network' 
                  ? 'No Internet Connection' 
                  : 'Server Unreachable'}
            </h2>

            <div className="offline-badge">
              <div className={`badge-dot ${isChecking ? 'dot-checking' : offlineType === 'network' ? 'dot-network' : 'dot-server'}`} />
              <span>
                {isChecking 
                  ? 'Verifying...' 
                  : offlineType === 'network' 
                    ? 'Network Disconnected' 
                    : 'Server Offline'}
              </span>
            </div>

            <p>
              {isChecking
                ? 'Checking connection to central printing server...'
                : offlineType === 'network'
                  ? 'Your internet connection is currently offline. Please verify your network settings, Wi-Fi router, or Ethernet cable connection.'
                  : 'Central printing server is currently unreachable. The server may be offline for maintenance or restarting. Please check back shortly.'}
            </p>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
              onClick={handleRetry} 
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <div className="spin-loader" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Retry Connection</span>
              )}
            </button>

            {!isChecking && (
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '16px' }}>
                Auto-retrying connection in <span style={{ fontWeight: '600' }}>{countdown}</span>s...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
