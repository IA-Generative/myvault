/**
 * Inline button that tests the API connection via the backend.
 * The backend performs the test (it's on the Docker/K8s network and can reach internal services).
 */

import { useState, useCallback } from "react";
import { userApi } from "../services/api";

interface ConnectionCheckerProps {
  appSlug: string;
}

export default function ConnectionChecker({ appSlug }: ConnectionCheckerProps) {
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
    <>
      <button
        type="button"
        className="fr-btn fr-btn--secondary fr-btn--sm"
        onClick={handleCheck}
        disabled={state === "loading"}
      >
        {state === "loading"
          ? "Test en cours..."
          : state === "ok"
            ? "API OK"
            : state === "error"
              ? "Retester l'API"
              : "Tester l'API"
        }
      </button>

      {state === "ok" && (
        <span className="fr-valid-text" role="status" style={{ marginLeft: "0.5rem" }}>
          {detail || "Connexion réussie"}
        </span>
      )}

      {state === "error" && (
        <span className="fr-error-text" role="alert" style={{ marginLeft: "0.5rem" }}>
          {detail || "Connexion échouée"}
        </span>
      )}
    </>
  );
}
