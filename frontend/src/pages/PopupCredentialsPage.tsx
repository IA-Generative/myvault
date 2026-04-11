/**
 * Popup credentials page — opened in a small floating window.
 *
 * Receives credentials from the parent window via postMessage.
 * Shows only manual credentials (login, password) with copy buttons.
 *
 * URL: /popup/:appSlug
 */

import { useEffect, useState, useCallback } from "react";

interface CredentialField {
  key: string;
  label: string;
  value: string;
  secret: boolean;
}

interface PopupData {
  appName: string;
  iconUrl: string;
  credentials: CredentialField[];
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [value]);

  return (
    <button onClick={handleCopy} style={styles.copyBtn}>
      {copied ? "Copié !" : "Copier"}
    </button>
  );
}

export default function PopupCredentialsPage() {
  const [data, setData] = useState<PopupData | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = "MyVault — Identifiants";

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "MYVAULT_CREDENTIALS") {
        setData(event.data.payload as PopupData);
      }
    };

    window.addEventListener("message", handleMessage);

    // Tell parent we're ready
    window.opener?.postMessage({ type: "MYVAULT_POPUP_READY" }, "*");

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!data) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <strong>MyVault</strong>
        </div>
        <div style={styles.body}>
          <p style={{ color: "#666", fontSize: 12, textAlign: "center", marginTop: 20 }}>
            Chargement des identifiants...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {data.iconUrl && <img src={data.iconUrl} alt="" style={{ width: 20, height: 20 }} />}
        <strong>{data.appName}</strong>
        <span style={styles.badge}>MyVault</span>
      </div>

      {/* Credentials */}
      <div style={styles.body}>
        {data.credentials.length === 0 ? (
          <p style={{ color: "#666", fontSize: 12 }}>Aucun identifiant manuel configuré</p>
        ) : (
          data.credentials.map((cred) => {
            const shown = revealed.has(cred.key);
            const displayValue = cred.secret && !shown
              ? "\u2022".repeat(Math.min(cred.value.length, 16))
              : cred.value;

            return (
              <div key={cred.key} style={styles.row}>
                <div style={styles.rowLabel}>{cred.label}</div>
                <div style={styles.rowValue}>
                  <span style={{
                    ...styles.valueText,
                    fontFamily: cred.secret ? "monospace" : "inherit",
                  }}>
                    {displayValue}
                  </span>
                  <div style={styles.actions}>
                    {cred.secret && (
                      <button onClick={() => toggleReveal(cred.key)} style={styles.smallBtn}>
                        {shown ? "Masquer" : "Voir"}
                      </button>
                    )}
                    <CopyButton value={cred.value} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        Copiez vos identifiants dans l'application
      </div>
    </div>
  );
}

const SECRET_TYPES = new Set(["password", "login", "api_key", "secret", "oauth_token", "certificate"]);

// Called by VaultPage to build the popup data
export function buildPopupData(
  app: { name: string; icon_url: string; required_variables: { key: string; label: string; var_type: string; category: string }[] },
  values: Record<string, string>
): PopupData {
  const credentials: CredentialField[] = [];

  for (const v of app.required_variables) {
    if (v.category !== "manual" && v.category !== "both") continue;
    const value = values[v.key];
    if (!value) continue;
    credentials.push({
      key: v.key,
      label: v.label,
      value,
      secret: SECRET_TYPES.has(v.var_type),
    });
  }

  return {
    appName: app.name,
    iconUrl: app.icon_url,
    credentials,
  };
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: '"Marianne", system-ui, sans-serif',
    fontSize: 13,
    margin: 0,
    padding: 0,
    background: "rgba(255,255,255,0.97)",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: "#000091",
    color: "white",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 700,
  },
  badge: {
    marginLeft: "auto",
    fontSize: 10,
    background: "rgba(255,255,255,0.2)",
    padding: "2px 6px",
    borderRadius: 3,
  },
  body: {
    flex: 1,
    padding: "8px 14px",
    overflowY: "auto",
  },
  row: {
    padding: "6px 0",
    borderBottom: "1px solid #eee",
  },
  rowLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: 600,
    marginBottom: 2,
  },
  rowValue: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  valueText: {
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
  },
  actions: {
    display: "flex",
    gap: 4,
    flexShrink: 0,
  },
  copyBtn: {
    background: "#000091",
    color: "white",
    border: "none",
    borderRadius: 3,
    padding: "3px 8px",
    fontSize: 11,
    cursor: "pointer",
    fontWeight: 600,
  },
  smallBtn: {
    background: "none",
    border: "1px solid #ddd",
    borderRadius: 3,
    padding: "2px 6px",
    fontSize: 11,
    cursor: "pointer",
    color: "#000091",
  },
  footer: {
    padding: "6px 14px",
    borderTop: "1px solid #eee",
    textAlign: "center" as const,
    fontSize: 11,
    color: "#999",
  },
};
