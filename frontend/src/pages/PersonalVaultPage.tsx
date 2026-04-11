/**
 * Personal vault page — user can freely add/edit/delete their own credentials.
 * Like a password manager: name, website, login, password, notes.
 */

import { useEffect, useState, useCallback } from "react";
import { personalApi, type PersonalEntry } from "../services/api";
import SecretField from "../components/SecretField";

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="fr-callout">
      <h3 className="fr-callout__title">Aucun identifiant personnel</h3>
      <p className="fr-callout__text">
        Ajoutez ici les identifiants de vos applications
        (login, mot de passe, clé API...). Ils seront chiffrés et
        accessibles uniquement par vous.
      </p>
      <button className="fr-btn fr-mt-2w" onClick={onAdd}>
        Ajouter un identifiant
      </button>
    </div>
  );
}

function EntryForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: Partial<PersonalEntry> | null;
  onSave: (data: { name: string; website: string; username: string; password: string; notes: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(entry?.name || "");
  const [website, setWebsite] = useState(entry?.website || "");
  const [username, setUsername] = useState(entry?.username || "");
  const [password, setPassword] = useState(entry?.password || "");
  const [notes, setNotes] = useState(entry?.notes || "");

  return (
    <div style={{ border: "1px solid var(--border-default-grey)", borderRadius: "4px", padding: "1.5rem", marginBottom: "1.5rem", background: "var(--background-alt-grey)" }}>
      <h3>{entry?.id ? "Modifier l'identifiant" : "Nouvel identifiant"}</h3>
      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-6">
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="pe-name">Nom de l'application *</label>
            <input className="fr-input" id="pe-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Gmail, Grist, GitHub..." />
          </div>
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="pe-website">Site web</label>
            <input className="fr-input" id="pe-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="pe-username">Identifiant / Email</label>
            <input className="fr-input" id="pe-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mon.email@gouv.fr" />
          </div>
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <SecretField
            label="Mot de passe / Clé API"
            value={password}
            onChange={setPassword}
          />
        </div>
        <div className="fr-col-12">
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="pe-notes">Notes</label>
            <textarea className="fr-input" id="pe-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informations complémentaires..." />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <button className="fr-btn" onClick={() => onSave({ name, website, username, password, notes })} disabled={!name.trim()}>
          Enregistrer
        </button>
        <button className="fr-btn fr-btn--secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

export default function PersonalVaultPage() {
  const [entries, setEntries] = useState<PersonalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Partial<PersonalEntry> | null>(null);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(() => {
    personalApi.list()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = async (data: { name: string; website: string; username: string; password: string; notes: string }) => {
    setError("");
    try {
      if (editing?.id) {
        await personalApi.update(editing.id, data);
      } else {
        await personalApi.create(data);
      }
      setShowForm(false);
      setEditing(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleDelete = async (entry: PersonalEntry) => {
    if (!confirm(`Supprimer "${entry.name}" ?`)) return;
    try {
      await personalApi.delete(entry.id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleEdit = (entry: PersonalEntry) => {
    setEditing(entry);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  if (loading) return <p>Chargement...</p>;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Mes identifiants personnels</h1>
          <p className="fr-text--sm" style={{ color: "var(--text-mention-grey)", margin: 0 }}>
            Vos logins et mots de passe, chiffrés et accessibles uniquement par vous.
          </p>
        </div>
        {entries.length > 0 && !showForm && (
          <button className="fr-btn" onClick={handleAdd}>
            Ajouter un identifiant
          </button>
        )}
      </div>

      {error && (
        <div className="fr-alert fr-alert--error fr-mb-2w"><p>{error}</p></div>
      )}

      {showForm && (
        <EntryForm
          entry={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {entries.length === 0 && !showForm ? (
        <EmptyState onAdd={handleAdd} />
      ) : entries.length > 0 && (
        <div className="fr-table">
          <table>
            <thead>
              <tr>
                <th>Application</th>
                <th>Site web</th>
                <th>Identifiant</th>
                <th>Mot de passe</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.name}</strong></td>
                  <td>
                    {e.website ? (
                      <a href={e.website} target="_blank" rel="noopener noreferrer" className="fr-link">
                        {new URL(e.website).hostname}
                      </a>
                    ) : "—"}
                  </td>
                  <td>{e.username || "—"}</td>
                  <td>
                    {e.password ? (
                      <SecretField label="" value={e.password} onChange={() => {}} readOnly />
                    ) : "—"}
                  </td>
                  <td>
                    <button className="fr-btn fr-btn--sm fr-btn--secondary fr-mr-1w" onClick={() => handleEdit(e)}>
                      Modifier
                    </button>
                    <button className="fr-btn fr-btn--sm fr-btn--tertiary-no-outline" style={{ color: "var(--text-default-error)" }} onClick={() => handleDelete(e)}>
                      Supprimer
                    </button>
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
