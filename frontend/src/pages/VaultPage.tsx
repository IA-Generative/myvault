/**
 * User vault page — "Mes identifiants"
 * Shows a clear table of all applications with status and action buttons.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userApi, type AppListItem } from "../services/api";

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
  return <span className="fr-badge fr-badge--sm fr-badge--info">Actif — non testé</span>;
}

export default function VaultPage() {
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    userApi
      .getMyApps()
      .then(setApps)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>Chargement...</p>;
  }

  if (error) {
    return (
      <div className="fr-alert fr-alert--error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <h1>Mes identifiants</h1>
      <p className="fr-text--lg fr-mb-3w">
        Configurez vos identifiants pour chaque application.
        Vos données sont chiffrées et accessibles uniquement par vous.
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id}>
                  <td>
                    <strong>{app.name}</strong>
                  </td>
                  <td>{app.description}</td>
                  <td>
                    <StatusBadge app={app} />
                  </td>
                  <td>
                    {app.user_configured ? (
                      <button
                        className="fr-btn fr-btn--sm fr-btn--secondary"
                        onClick={() => navigate(`/app/${app.friendly_slug}`)}
                      >
                        Modifier
                      </button>
                    ) : (
                      <button
                        className="fr-btn fr-btn--sm"
                        onClick={() => navigate(`/app/${app.friendly_slug}`)}
                      >
                        Configurer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
