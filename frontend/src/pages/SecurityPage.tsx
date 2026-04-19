/**
 * Security settings — enable/disable/change the master password.
 * The master password adds a per-user salt to the encryption of every stored
 * credential: without it the server cannot decrypt entries.
 */

import { useState } from "react";
import { securityApi } from "../services/api";
import { useSecurity } from "../services/security-context";

export default function SecurityPage() {
  const { status, refresh, promptUnlock } = useSecurity();

  if (!status) {
    return <p>Chargement...</p>;
  }

  return (
    <>
      <h1>Sécurité</h1>
      <p className="fr-text--lg fr-mb-3w">
        Le <strong>mot de passe principal</strong> ajoute un sel supplémentaire
        au chiffrement de vos identifiants. Une fois activé, il doit être
        saisi à chaque session pour déverrouiller le coffre. Il n'est{" "}
        <strong>jamais stocké en clair</strong> — seul son empreinte (hash)
        est conservée pour vérification.
      </p>

      <div className="fr-callout fr-callout--orange-terre-battue fr-mb-3w">
        <h3 className="fr-callout__title">Attention</h3>
        <p className="fr-callout__text">
          Sans ce mot de passe, vos identifiants stockés{" "}
          <strong>ne peuvent pas être récupérés</strong>. Notez-le en lieu sûr.
        </p>
      </div>

      {status.master_password_enabled ? (
        <EnabledSection status={status} refresh={refresh} promptUnlock={promptUnlock} />
      ) : (
        <DisabledSection refresh={refresh} />
      )}
    </>
  );
}

function DisabledSection({ refresh }: { refresh: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux saisies ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      await securityApi.enable(password);
      setSuccess("Mot de passe principal activé. Le coffre est déverrouillé.");
      setPassword("");
      setConfirm("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 520 }}>
      <h2>Activer le mot de passe principal</h2>
      <div className="fr-input-group">
        <label className="fr-label" htmlFor="mp-new">Mot de passe principal</label>
        <input
          className="fr-input"
          id="mp-new"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="fr-input-group">
        <label className="fr-label" htmlFor="mp-confirm">Confirmation</label>
        <input
          className="fr-input"
          id="mp-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      {error && <div className="fr-alert fr-alert--error fr-mt-2w"><p>{error}</p></div>}
      {success && <div className="fr-alert fr-alert--success fr-mt-2w"><p>{success}</p></div>}
      <button type="submit" className="fr-btn fr-mt-2w" disabled={busy}>
        {busy ? "Activation..." : "Activer le mot de passe principal"}
      </button>
    </form>
  );
}

function EnabledSection({
  status,
  refresh,
  promptUnlock,
}: {
  status: { unlocked: boolean; unlock_ttl_seconds: number };
  refresh: () => Promise<void>;
  promptUnlock: () => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"none" | "change" | "disable">("none");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reset = () => {
    setOldPwd(""); setNewPwd(""); setConfirm(""); setError(""); setSuccess("");
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (newPwd.length < 8) { setError("Nouveau mot de passe trop court (min 8)."); return; }
    if (newPwd !== confirm) { setError("Les deux saisies ne correspondent pas."); return; }
    setBusy(true);
    try {
      await securityApi.change(oldPwd, newPwd);
      setSuccess("Mot de passe modifié. Le coffre reste déverrouillé.");
      setMode("none"); reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setBusy(true);
    try {
      await securityApi.disable(oldPwd);
      setSuccess("Mot de passe principal désactivé.");
      setMode("none"); reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleLock = async () => {
    try {
      await securityApi.lock();
      await refresh();
    } catch { /* ignore */ }
  };

  const handleUnlock = async () => {
    await promptUnlock();
    await refresh();
  };

  const ttlMin = Math.round(status.unlock_ttl_seconds / 60);

  return (
    <>
      <div className="fr-mb-3w">
        <h2>État du coffre</h2>
        <p>
          Mot de passe principal :{" "}
          <span className="fr-badge fr-badge--sm fr-badge--success">Activé</span>
        </p>
        <p>
          Session : {status.unlocked ? (
            <span className="fr-badge fr-badge--sm fr-badge--success">Déverrouillée</span>
          ) : (
            <span className="fr-badge fr-badge--sm fr-badge--warning">Verrouillée</span>
          )}{" "}
          <span className="fr-text--sm" style={{ color: "var(--text-mention-grey)" }}>
            (expire après {ttlMin} min d'inactivité)
          </span>
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          {status.unlocked ? (
            <button className="fr-btn fr-btn--secondary" onClick={handleLock}>
              Verrouiller maintenant
            </button>
          ) : (
            <button className="fr-btn" onClick={handleUnlock}>
              Déverrouiller
            </button>
          )}
          <button className="fr-btn fr-btn--secondary" onClick={() => { reset(); setMode("change"); }}>
            Changer le mot de passe
          </button>
          <button className="fr-btn fr-btn--tertiary" onClick={() => { reset(); setMode("disable"); }}>
            Désactiver
          </button>
        </div>
      </div>

      {success && <div className="fr-alert fr-alert--success fr-mb-2w"><p>{success}</p></div>}

      {mode === "change" && (
        <form onSubmit={handleChange} style={{ maxWidth: 520 }}>
          <h2>Changer le mot de passe principal</h2>
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="mp-old">Ancien mot de passe</label>
            <input className="fr-input" id="mp-old" type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="mp-new">Nouveau mot de passe</label>
            <input className="fr-input" id="mp-new" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" minLength={8} required />
          </div>
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="mp-confirm">Confirmation</label>
            <input className="fr-input" id="mp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>
          {error && <div className="fr-alert fr-alert--error fr-mt-2w"><p>{error}</p></div>}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button type="submit" className="fr-btn" disabled={busy}>
              {busy ? "..." : "Changer"}
            </button>
            <button type="button" className="fr-btn fr-btn--secondary" onClick={() => { setMode("none"); reset(); }}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {mode === "disable" && (
        <form onSubmit={handleDisable} style={{ maxWidth: 520 }}>
          <h2>Désactiver le mot de passe principal</h2>
          <p className="fr-text--sm">
            Saisissez votre mot de passe pour confirmer. Vos identifiants
            seront ré-enregistrés sans le sel supplémentaire.
          </p>
          <div className="fr-input-group">
            <label className="fr-label" htmlFor="mp-old-dis">Mot de passe actuel</label>
            <input className="fr-input" id="mp-old-dis" type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <div className="fr-alert fr-alert--error fr-mt-2w"><p>{error}</p></div>}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button type="submit" className="fr-btn" disabled={busy}>
              {busy ? "..." : "Désactiver"}
            </button>
            <button type="button" className="fr-btn fr-btn--secondary" onClick={() => { setMode("none"); reset(); }}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </>
  );
}
