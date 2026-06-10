import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { handleAuthCallbackUrl, nativeAuthRedirectUrl } from '@/api/backendClient'
import '@/index.css'

const handleNativeAuthUrl = async (event) => {
  const url = event?.url;
  if (!url?.startsWith(nativeAuthRedirectUrl)) return;

  const closeBrowser = async () => {
    try {
      await Browser.close();
    } catch {
      // Browser may already be closed by the native redirect.
    }
  };

  try {
    await handleAuthCallbackUrl(url);
    await closeBrowser();
    window.location.href = '/';
  } catch (error) {
    console.error('OAuth callback failed:', error);
    await closeBrowser();
    window.location.href = `/login?auth_error=${encodeURIComponent(error.message || 'OAuth failed')}`;
  }
};

if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('appUrlOpen', handleNativeAuthUrl);
  CapacitorApp.getLaunchUrl().then((event) => {
    if (event?.url) handleNativeAuthUrl(event);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
