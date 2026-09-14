export function isElectronApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).electronAPI !== undefined || window.navigator.userAgent.includes('Electron');
}
