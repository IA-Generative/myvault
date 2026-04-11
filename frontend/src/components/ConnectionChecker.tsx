/**
 * Button that tests the connection and displays the result (spinner, success, error).
 */

import { useState, useCallback } from "react";
import { userApi } from "../services/api";

interface ConnectionCheckerProps {
  appSlug: string;
  disabled?: boolean;
}

export default function ConnectionChecker({ appSlug, disabled }: ConnectionCheckerProps) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [detail, setDetail] = useState("");

  const handleCheck = useCallback(async () => {
    setState("loading");
    try {
      const result = await userApi.checkConnection(appSlug);
      setState(result.status === "ok" ? "ok" : "error");
      setDetail(result.detail);
    } catch (err) {
      setState("error");
      setDetail(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }, [appSlug]);

  return (
    <div className="fr-mt-2w">
      <button
        type="button"
        className="fr-btn fr-btn--secondary fr-btn--sm"
        onClick={handleCheck}
        disabled={disabled || state === "loading"}
      >
        {state === "loading" ? (
          <>
            <span className="fr-icon-refresh-line fr-icon--spin" aria-hidden="true" /> Test en cours...
          </>
        ) : (
          "Tester la connexion"
        )}
      </button>

      {state === "ok" && (
        <div className="fr-alert fr-alert--success fr-alert--sm fr-mt-1w" role="status">
          <p>Connexion réussie{detail ? ` — ${detail}` : ""}</p>
        </div>
      )}

      {state === "error" && (
        <div className="fr-alert fr-alert--error fr-alert--sm fr-mt-1w" role="alert">
          <p>Connexion échouée{detail ? ` — ${detail}` : ""}</p>
        </div>
      )}
    </div>
  );
}
