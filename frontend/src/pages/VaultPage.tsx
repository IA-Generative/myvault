/**
 * Main vault page: lists all applications with the user's configuration status.
 * Shows clear guidance when no apps are available.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AppCard from "../components/AppCard";
import { userApi, type AppListItem } from "../services/api";

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
    return <p>Chargement de votre coffre-fort...</p>;
  }

  if (error) {
    return (
      <div className="fr-alert fr-alert--error">
        <p>{error}</p>
      </div>
    );
  }

  const configured = apps.filter((a) => a.user_configured);
  const unconfigured = apps.filter((a) => !a.user_configured);

  return (
    <>
      <h1>Mon coffre-fort</h1>

      {apps.length === 0 ? (
        <div className="fr-callout fr-callout--green-emeraude">
          <h3 className="fr-callout__title">Bienvenue dans MyVault</h3>
          <p className="fr-callout__text">
            Votre coffre-fort est prêt. Les applications apparaîtront ici
            dès qu'un administrateur les aura ajoutées.
          </p>
          <Link to="/admin" className="fr-btn fr-mt-2w">
            Administrer les applications
          </Link>
        </div>
      ) : (
        <>
          {unconfigured.length > 0 && (
            <>
              <div className="fr-alert fr-alert--info fr-mb-3w">
                <p>
                  <strong>{unconfigured.length} application{unconfigured.length > 1 ? "s" : ""} à configurer</strong> —
                  Cliquez sur une application puis remplissez vos identifiants pour l'activer.
                </p>
              </div>
              <div className="fr-grid-row fr-grid-row--gutters fr-mb-3w">
                {unconfigured.map((app) => (
                  <div className="fr-col-12 fr-col-md-6 fr-col-lg-4" key={app.id}>
                    <AppCard
                      app={app}
                      onClick={() => navigate(`/app/${app.friendly_slug}`)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {configured.length > 0 && (
            <>
              <h2>
                Mes applications configurées ({configured.length})
              </h2>
              <div className="fr-grid-row fr-grid-row--gutters">
                {configured.map((app) => (
                  <div className="fr-col-12 fr-col-md-6 fr-col-lg-4" key={app.id}>
                    <AppCard
                      app={app}
                      onClick={() => navigate(`/app/${app.friendly_slug}`)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
