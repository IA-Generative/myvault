/**
 * Modal that prompts for the master password so the backend can unlock the
 * in-memory session and decrypt credentials. Shown whenever any API call
 * returns 423, or on-demand from the security page.
 */

import { useEffect, useRef, useState } from "react";
import { securityApi } from "../services/api";

interface Props {
  open: boolean;
  onUnlocked: () => void;
  onCancel: () => void;
}

export default function UnlockModal({ open, onUnlocked, onCancel }: Props) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError("");
    try {
      await securityApi.unlock(password);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de déverrouillage");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--background-default-grey)",
          padding: "2rem",
          borderRadius: 8,
          width: "min(92vw, 420px)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        <h2 id="unlock-title" style={{ marginTop: 0 }}>
          Coffre verrouillé
        </h2>
        <p className="fr-text--sm">
          Saisissez votre mot de passe principal pour accéder à vos identifiants.
        </p>
        <div className="fr-input-group">
          <label className="fr-label" htmlFor="unlock-pwd">
            Mot de passe principal
          </label>
          <input
            ref={inputRef}
            id="unlock-pwd"
            className="fr-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <div className="fr-alert fr-alert--error fr-mt-2w">
            <p>{error}</p>
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="fr-btn fr-btn--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="fr-btn"
            disabled={submitting || !password}
          >
            {submitting ? "Déverrouillage..." : "Déverrouiller"}
          </button>
        </div>
      </form>
    </div>
  );
}
