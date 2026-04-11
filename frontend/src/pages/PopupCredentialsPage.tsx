/**
 * Popup credentials page — opened in a small floating window when
 * user clicks "Ouvrir" on an application.
 *
 * Displays credentials with copy buttons in a compact, semi-transparent layout.
 * Stays visible on top of the target application in the other tab.
 *
 * URL: /popup/:appSlug
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { userApi, type AppListItem, type VaultEntry } from "../services/api";

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [value]);

  return (
    <button onClick={handleCopy} style={styles.copyBtn}>
      {copied ? "Copié !" : label || "Copier"}
    </button>
  );
}

export default function PopupCredentialsPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const [app, setApp] = useState<AppListItem | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!appSlug) return;
    Promise.all([
      userApi.getMyApps(),
      userApi.getMyEntry(appSlug),
    ]).then(([apps, entry]) => {
      const found = apps.find((a) => a.friendly_slug === appSlug);
      if (found) setApp(found);
      if ("entry_id" in entry) {
        setValues((entry as VaultEntry).values);
      }
    }).catch((e) => setError(e.message));

    // Set window title
    document.title = "MyVault — Identifiants";
  }, [appSlug]);

  const isSecret = (key: string) =>
    app?.required_variables.some(
      (v) => v.key === key && ["api_key", "secret", "password", "oauth_token", "login", "certificate"].includes(v.var_type)
    ) ?? /token|password|secret|key/i.test(key);

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getLabel = (key: string) =>
    app?.required_variables.find((v) => v.key === key)?.label || key;

  if (error) {
    return <div style={styles.container}><p style={{ color: "#CE0500" }}>{error}</p></div>;
  }

  if (!app) {
    return <div style={styles.container}><p>Chargement...</p></div>;
  }

  // Only show manual credentials (login, password, app_url) — not API tokens
  const manualKeys = new Set(
    app.required_variables
      .filter((v) => v.category === "manual" || v.category === "both")
      .map((v) => v.key)
  );
  const entries = Object.entries(values).filter(
    ([key, v]) => v && manualKeys.has(key)
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {app.icon_url && <img src={app.icon_url} alt="" style={{ width: 20, height: 20 }} />}
        <strong>{app.name}</strong>
        <span style={styles.badge}>MyVault</span>
      </div>

      {/* Credentials */}
      <div style={styles.body}>
        {entries.length === 0 ? (
          <p style={{ color: "#666", fontSize: 12 }}>Aucun identifiant configuré</p>
        ) : (
          entries.map(([key, value]) => {
            const secret = isSecret(key);
            const shown = revealed.has(key);
            const displayValue = secret && !shown
              ? "\u2022".repeat(Math.min(value.length, 16))
              : value;

            return (
              <div key={key} style={styles.row}>
                <div style={styles.rowLabel}>{getLabel(key)}</div>
                <div style={styles.rowValue}>
                  <span style={{
                    ...styles.valueText,
                    fontFamily: secret ? "monospace" : "inherit",
                  }}>
                    {displayValue}
                  </span>
                  <div style={styles.actions}>
                    {secret && (
                      <button onClick={() => toggleReveal(key)} style={styles.smallBtn}>
                        {shown ? "Masquer" : "Voir"}
                      </button>
                    )}
                    <CopyButton value={value} />
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
