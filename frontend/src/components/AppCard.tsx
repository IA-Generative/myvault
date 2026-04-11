/**
 * Card displaying an application in the vault list with status badge.
 */

import type { AppListItem } from "../services/api";

interface AppCardProps {
  app: AppListItem;
  onClick: () => void;
}

function statusBadge(app: AppListItem) {
  if (!app.user_configured) {
    return <span className="fr-badge fr-badge--info fr-badge--sm">Non configuré</span>;
  }
  if (!app.user_enabled) {
    return <span className="fr-badge fr-badge--warning fr-badge--sm">Désactivé</span>;
  }
  if (app.check_status === "ok") {
    return <span className="fr-badge fr-badge--success fr-badge--sm">Actif</span>;
  }
  if (app.check_status === "error") {
    return <span className="fr-badge fr-badge--error fr-badge--sm">Erreur</span>;
  }
  return <span className="fr-badge fr-badge--new fr-badge--sm">Non testé</span>;
}

export default function AppCard({ app, onClick }: AppCardProps) {
  return (
    <div className="fr-card fr-card--horizontal fr-enlarge-link" style={{ cursor: "pointer" }}>
      <div className="fr-card__body">
        <div className="fr-card__content">
          <h3 className="fr-card__title">
            <a href={`/app/${app.friendly_slug}`} onClick={(e) => { e.preventDefault(); onClick(); }}>
              {app.name}
            </a>
          </h3>
          <p className="fr-card__desc">{app.description}</p>
          <div className="fr-card__start">
            {statusBadge(app)}
            <span className="fr-text--xs fr-ml-2w" style={{ color: "var(--text-mention-grey)" }}>
              {app.required_variables.length} variable{app.required_variables.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
      {app.icon_url && (
        <div className="fr-card__header">
          <div className="fr-card__img">
            <img src={app.icon_url} alt="" className="fr-responsive-img" style={{ maxWidth: 48 }} />
          </div>
        </div>
      )}
    </div>
  );
}
