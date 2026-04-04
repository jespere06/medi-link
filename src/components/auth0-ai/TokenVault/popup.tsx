"use client";

import { useCallback, useEffect, useState } from "react";

import { WaitingMessage } from "../util/loader";
import { PromptUserContainer } from "../util/prompt-user-container";

import type { TokenVaultAuthProps } from "./TokenVaultAuthProps";

export function TokenVaultConsentPopup({
  interrupt: { connection, requiredScopes, authorizationParams, resume },
  connectWidget: { icon, title, description, action, containerClassName },
  auth: { connectPath = "/auth/connect", returnTo = "/close" } = {},
  onFinish,
}: TokenVaultAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loginPopup, setLoginPopup] = useState<Window | null>(null);

  // 🟢 Escuchamos el mensaje enviado desde /close para saltar el bloqueo COOP
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "auth0-popup-closed") {
        console.log("[POLL] Popup closure signal received via postMessage");
        setIsLoading(false);
        setLoginPopup(null);
        if (typeof onFinish === "function") {
          onFinish();
        } else if (typeof resume === "function") {
          resume();
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onFinish, resume]);

  //Open the login popup
  const startLoginPopup = useCallback(async () => {
    const search = new URLSearchParams();
    search.set("connection", connection);
    if (returnTo) search.set("returnTo", returnTo);

    // 🟢 EL SDK de Auth0 espera múltiples parámetros "scopes="
    requiredScopes.forEach((scope) => search.append("scopes", scope));

    // Asegurarse de que los authorizationParams pasen correctamente (si existen)
    if (authorizationParams) {
      Object.entries(authorizationParams).forEach(([key, value]) => {
        search.set(key, value as string);
      });
    }

    const url = new URL(connectPath, window.location.origin);
    url.search = search.toString();

    const windowFeatures =
      "width=800,height=650,status=no,toolbar=no,menubar=no";
    const popup = window.open(url.toString(), "_blank", windowFeatures);
    if (!popup) {
      console.error("Popup blocked by the browser");
      return;
    } else {
      setLoginPopup(popup);
      setIsLoading(true);
    }
  }, [connection, requiredScopes, returnTo, authorizationParams, connectPath]);

  if (isLoading) {
    return <WaitingMessage />;
  }

  return (
    <PromptUserContainer
      title={title}
      description={description}
      icon={icon}
      containerClassName={containerClassName}
      action={{
        label: action?.label ?? "Connect",
        onClick: startLoginPopup,
      }}
    />
  );
}
