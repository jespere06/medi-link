"use client";

import { useEffect } from "react";

/**
 * /close — Auto-close page for the Token Vault popup.
 * After the user completes the OAuth consent in the popup window,
 * Auth0 redirects here and the popup auto-closes, returning control
 * to the parent window's polling loop in popup.tsx.
 */
export default function ClosePage() {
  useEffect(() => {
    // 🟢 Le enviamos un mensaje seguro a la ventana padre saltando el bloqueo COOP
    if (window.opener) {
      window.opener.postMessage("auth0-popup-closed", "*");
    }
    // Give a brief moment for any cookies to settle, then close
    const timer = setTimeout(() => {
      window.close();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-12 h-12 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-400 font-medium">Authorization Completed</p>
        <p className="text-xs text-slate-600 mt-1">This window will close automatically...</p>
      </div>
    </div>
  );
}
