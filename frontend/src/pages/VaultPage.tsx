/**
 * User vault page — "Applications"
 * Table with status, configure, and "Ouvrir" button with credentials overlay.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { userApi, type AppListItem, type VaultEntry } from "../services/api";
import CredentialsOverlay from "../components/CredentialsOverlay";

function StatusBadge({ app }: { app: AppListItem }) {
  if (!app.user_configured) {
    return <span className="fr-badge fr-badge--sm fr-badge--warning">Non configuré</span>;
  }
  if (!app.user_enabled) {
    return <span className="fr-badge fr-badge--sm fr-badge--new">Désactivé</span>;
  }
  if (app.check_status === "ok") {
    return <span className="fr-badge fr-badge--sm fr-badge--success">Actif</span>;
  }
  if (app.check_status === "error") {
    return <span className="fr-badge fr-badge--sm fr-badge--error">Erreur</span>;
  }
  return <span className="fr-badge fr-badge--sm fr-badge--info">Actif</span>;
}

function getAppTargetUrl(app: AppListItem, entry: VaultEntry): string | null {
  for (const v of app.required_variables) {
    if (v.var_type === "url" && entry.values[v.key]) {
      return entry.values[v.key];
    }
  }
  return null;
}

export default function VaultPage() {
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [overlayApp, setOverlayApp] = useState<AppListItem | null>(null);
  const [overlayCredentials, setOverlayCredentials] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    userApi
      .getMyApps()
      .then(setApps)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleOpen = useCallback(async (app: AppListItem) => {
    try {
      const entry = await userApi.getMyEntry(app.friendly_slug);
      if (!("entry_id" in entry)) return;
      const vaultEntry = entry as VaultEntry;

      const targetUrl = getAppTargetUrl(app, vaultEntry);
      if (targetUrl) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }

      setOverlayApp(app);
      setOverlayCredentials(vaultEntry.values);
    } catch {
      // silently fail
    }
  }, []);

  if (loading) return <p>Chargement...</p>;

  if (error) {
    return <div className="fr-alert fr-alert--error"><p>{error}</p></div>;
  }

  const canOpen = (app: AppListItem) => app.user_configured && app.user_enabled;

  return (
    <>
      <h1>Mes identifiants</h1>
      <p className="fr-text--lg fr-mb-3w">
        Configurez vos identifiants puis cliquez sur <strong>Ouvrir</strong> pour
        accéder à l'application avec vos credentials à portée de main.
      </p>

      {apps.length === 0 ? (
        <div className="fr-callout">
          <h3 className="fr-callout__title">Aucune application disponible</h3>
          <p className="fr-callout__text">
            Les applications apparaîtront ici dès qu'un administrateur
            les aura ajoutées depuis l'onglet <strong>Administration</strong>.
          </p>
        </div>
      ) : (
        <div className="fr-table">
          <table>
            <thead>
              <tr>
                <th>Application</th>
                <th>Description</th>
                <th>Statut</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id}>
                  <td style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {app.icon_url && (
                      <img src={app.icon_url} alt="" style={{ width: 20, height: 20 }} />
                    )}
                    <strong>{app.name}</strong>
                  </td>
                  <td>{app.description}</td>
                  <td>
                    <StatusBadge app={app} />
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className={`fr-btn fr-btn--sm ${canOpen(app) ? "" : ""}`}
                      onClick={() => handleOpen(app)}
                      disabled={!canOpen(app)}
                      title={canOpen(app) ? "Ouvrir l'application et afficher les credentials" : "Configurez d'abord vos identifiants"}
                    >
                      Ouvrir
                    </button>
                    {" "}
                    <button
                      className="fr-btn fr-btn--sm fr-btn--tertiary"
                      onClick={() => navigate(`/app/${app.friendly_slug}`)}
                    >
                      {app.user_configured ? "Modifier" : "Configurer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {overlayApp && overlayCredentials && (
        <CredentialsOverlay
          appName={overlayApp.name}
          iconUrl={overlayApp.icon_url}
          credentials={overlayCredentials}
          onClose={() => {
            setOverlayApp(null);
            setOverlayCredentials(null);
          }}
        />
      )}
    </>
  );
}
