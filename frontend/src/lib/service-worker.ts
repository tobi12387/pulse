export function registerPulseServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (typeof navigator === 'undefined') return;
  const serviceWorker = navigator.serviceWorker;
  if (!serviceWorker || typeof serviceWorker.register !== 'function') return;
  if (!window.isSecureContext) return;

  const register = () => {
    serviceWorker.register('/sw.js').catch(() => {
      // Service worker support is a progressive enhancement; app startup must not fail.
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
