"use client";

import { PromptUserContainer } from "../util/prompt-user-container";

import type { TokenVaultAuthProps } from "./TokenVaultAuthProps";

export function TokenVaultConsentRedirect({
  interrupt: { connection, requiredScopes, authorizationParams },
  connectWidget: { icon, title, description, action, containerClassName },
  auth: {
    connectPath = "/auth/connect",
    returnTo = window.location.pathname,
  } = {},
}: TokenVaultAuthProps) {
  return (
    <PromptUserContainer
      title={title}
      description={description}
      icon={icon}
      containerClassName={containerClassName}
      action={{
        label: action?.label ?? "Connect",
        onClick: () => {
          const search = new URLSearchParams();
          search.set("connection", connection);
          if (returnTo) search.set("returnTo", returnTo);

          // 🟢 El SDK de Auth0 espera múltiples parámetros "scopes="
          requiredScopes.forEach((scope) => search.append("scopes", scope));

          // Asegurarse de que los authorizationParams pasen correctamente (si existen)
          if (authorizationParams) {
            Object.entries(authorizationParams).forEach(([key, value]) => {
              search.set(key, value as string);
            });
          }

          const url = new URL(connectPath, window.location.origin);
          url.search = search.toString();

          // Redirect to the authorization page
          window.location.href = url.toString();
        },
      }}
    />
  );
}
