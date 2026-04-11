/**
 * Main vault page: lists all applications with the user's configuration status.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      <p className="fr-text--lg">
        Gérez vos identifiants pour chaque application connectée.
        Cliquez sur une application pour configurer vos accès.
      </p>

      {apps.length === 0 ? (
        <div className="fr-callout">
          <h3 className="fr-callout__title">Aucune application disponible</h3>
          <p className="fr-callout__text">
            Les applications apparaîtront ici dès qu'un administrateur les aura ajoutées,
            ou qu'un outil en aura besoin.
          </p>
        </div>
      ) : (
        <>
          {configured.length > 0 && (
            <>
              <h2 className="fr-mt-3w">
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

          {unconfigured.length > 0 && (
            <>
              <h2 className="fr-mt-3w">
                Applications à configurer ({unconfigured.length})
              </h2>
              <p className="fr-text--sm" style={{ color: "var(--text-mention-grey)" }}>
                Cliquez sur une application pour saisir vos identifiants.
              </p>
              <div className="fr-grid-row fr-grid-row--gutters">
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
        </>
      )}
    </>
  );
}
