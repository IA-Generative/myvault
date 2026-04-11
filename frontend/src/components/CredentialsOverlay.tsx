/**
 * Floating overlay that shows credentials with copy-to-clipboard buttons.
 * Appears when user clicks "Ouvrir" on a configured application.
 */

import { useState, useCallback } from "react";

interface CredentialsOverlayProps {
  appName: string;
  iconUrl?: string;
  credentials: Record<string, string>;
  onClose: () => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <button
      className="fr-btn fr-btn--sm fr-btn--tertiary-no-outline"
      onClick={handleCopy}
      title="Copier"
      style={{ minWidth: "auto", padding: "0.25rem 0.5rem" }}
    >
      {copied ? "Copié !" : "Copier"}
    </button>
  );
}

export default function CredentialsOverlay({
  appName,
  iconUrl,
  credentials,
  onClose,
}: CredentialsOverlayProps) {
  const isSecret = (key: string) =>
    /token|password|secret|key|api_key|pat/i.test(key);

  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const displayValue = (key: string, value: string) => {
    if (!isSecret(key)) return value;
    if (revealed.has(key)) return value;
    return "\u2022".repeat(Math.min(value.length, 20));
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 10000,
        width: "400px",
        maxHeight: "80vh",
        background: "var(--background-default-grey, #fff)",
        border: "1px solid var(--border-default-grey, #ddd)",
        borderRadius: "8px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#000091",
          color: "white",
          padding: "0.75rem 1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {iconUrl && <img src={iconUrl} alt="" style={{ width: 18, height: 18 }} />}
          <strong>{appName}</strong>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "white",
            fontSize: "1.25rem",
            cursor: "pointer",
            padding: "0 0.25rem",
            lineHeight: 1,
          }}
          aria-label="Fermer"
        >
          &times;
        </button>
      </div>

      {/* Credentials list */}
      <div style={{ padding: "0.75rem 1rem", overflowY: "auto", flex: 1 }}>
        {Object.entries(credentials).map(([key, value]) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.4rem 0",
              borderBottom: "1px solid var(--border-default-grey, #eee)",
              gap: "0.5rem",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.75rem", color: "#666", fontWeight: 600 }}>
                {key}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontFamily: isSecret(key) ? "monospace" : "inherit",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayValue(key, value)}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
              {isSecret(key) && (
                <button
                  className="fr-btn fr-btn--sm fr-btn--tertiary-no-outline"
                  onClick={() => toggleReveal(key)}
                  title={revealed.has(key) ? "Masquer" : "Afficher"}
                  style={{ minWidth: "auto", padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                >
                  {revealed.has(key) ? "Masquer" : "Voir"}
                </button>
              )}
              <CopyButton value={value} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "0.5rem 1rem",
          borderTop: "1px solid var(--border-default-grey, #eee)",
          textAlign: "center",
          fontSize: "0.8rem",
          color: "#666",
        }}
      >
        Copiez vos identifiants dans l'application ouverte
      </div>
    </div>
  );
}
