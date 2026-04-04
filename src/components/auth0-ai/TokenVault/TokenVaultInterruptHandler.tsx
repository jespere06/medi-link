import { TokenVaultConsent } from "./index";

interface TokenVaultInterruptHandlerProps {
  interrupt: {
    connection: string;
    scopes: string[];
  };
  onResolved: () => void;
}

export function TokenVaultInterruptHandler({ interrupt, onResolved }: TokenVaultInterruptHandlerProps) {
  return (
    <TokenVaultConsent
      mode="popup"
      interrupt={{
        connection: interrupt.connection || "google-oauth2",
        // 🟢 Aseguramos que la UI pida lo mismo que el backend (URLs largas)
        requiredScopes: (Array.isArray(interrupt.scopes) && interrupt.scopes.length > 0) 
          ? interrupt.scopes 
          : ['openid', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar.events'],
      }}
      connectWidget={{
        title: "MediLink AI Authorization (GCP)",
        description: `MediLink AI Scribe is requesting access to the professional's calendar to formalize the Patient's discharge #${(interrupt.connection || '').includes('google') ? 'e263c5ce...' : 'ID'}. This action requires your explicit authorization to write calendar events.`,
        action: { label: "Authorize in Google Workspace" }
      }}
      auth={{
        connectPath: "/api/auth/connect"
      }}
      onFinish={onResolved}
    />
  );
}
