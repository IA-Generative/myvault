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

  return (
    <>
      <h1>Mon coffre-fort</h1>
      <p className="fr-text--lg">
        Gérez vos identifiants pour chaque application connectée.
      </p>

      {apps.length === 0 ? (
        <div className="fr-callout">
          <h3 className="fr-callout__title">Aucune application configurée</h3>
          <p className="fr-callout__text">
            Les applications apparaîtront ici dès qu'un administrateur les aura ajoutées,
            ou qu'un outil en aura besoin.
          </p>
        </div>
      ) : (
        <div className="fr-grid-row fr-grid-row--gutters">
          {apps.map((app) => (
            <div className="fr-col-12 fr-col-md-6 fr-col-lg-4" key={app.id}>
              <AppCard
                app={app}
                onClick={() => navigate(`/app/${app.friendly_slug}`)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
