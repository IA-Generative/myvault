import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import VaultPage from "./pages/VaultPage";
import PersonalVaultPage from "./pages/PersonalVaultPage";
import AppDetailPage from "./pages/AppDetailPage";
import AdminPage from "./pages/AdminPage";
import AdminAppFormPage from "./pages/AdminAppFormPage";
import BridgePage from "./pages/BridgePage";
import PopupCredentialsPage from "./pages/PopupCredentialsPage";
import GuidePage from "./pages/GuidePage";
import SecurityPage from "./pages/SecurityPage";
import { SecurityProvider } from "./services/security-context";
import { login, logout, getUser, handleCallback, type User } from "./services/auth";
import { userApi } from "./services/api";

// Rendue par le court-circuit /deconnexion, AVANT tout état d'authentification : elle doit
// fonctionner session présente (id_token_hint) comme session déjà morte (Keycloak affiche
// alors sa confirmation, et l'utilisateur revient — idempotent).
function DeconnexionEnCours() {
  useEffect(() => {
    logout().catch(() => {
      window.location.replace("/");
    });
  }, []);
  return (
    <div className="fr-container fr-my-4w">
      <p>Déconnexion en cours…</p>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.search.includes("code=") || location.search.includes("state=")) {
      handleCallback()
        .then((u) => {
          setUser(u);
          navigate(location.pathname, { replace: true });
        })
        .catch(() => {
          navigate("/", { replace: true });
        })
        .finally(() => setLoading(false));
    } else {
      getUser()
        .then(setUser)
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the admin flag from the backend profile (authoritative source).
  useEffect(() => {
    if (user && !user.expired) {
      userApi.getProfile()
        .then((p) => setIsAdmin(p.is_admin))
        .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  const [loginError, setLoginError] = useState("");

  const handleLogin = useCallback(() => {
    setLoginError("");
    login().catch((err) => {
      console.error("Login failed:", err);
      setLoginError(err?.message || "Erreur de connexion");
    });
  }, []);

  const userName = user?.profile?.name || user?.profile?.preferred_username || user?.profile?.email || "";

  // L'identité alimente la bulle du menu commun de la bêta (elle n'est connue qu'après la
  // résolution de la session, d'où l'événement plutôt qu'un window.MIRAI_MENU statique —
  // et la CSP interdit de toute façon un <script> inline). Le `sub` sert au condensé des
  // avis, jamais écrit en clair.
  useEffect(() => {
    if (user && !user.expired) {
      try {
        (window as any).MIRAI_MENU = Object.assign((window as any).MIRAI_MENU || {}, {
          sub: user.profile?.sub || "",
        });
        document.dispatchEvent(new CustomEvent("mirai-menu:identite", {
          detail: { nom: userName, mail: user.profile?.email || "" },
        }));
      } catch { /* le menu affichera « ? » */ }
    }
  }, [user, userName]);

  // Popup route — renders standalone, no header/footer
  if (location.pathname.startsWith("/popup/")) {
    return (
      <Routes>
        <Route path="/popup/:appSlug" element={<PopupCredentialsPage />} />
      </Routes>
    );
  }

  // Route de déconnexion — atteignable d'un simple lien : c'est elle que le menu commun
  // de la bêta appelle (`sortie: '/deconnexion'`). `signoutRedirect()` vide le
  // sessionStorage ET ferme la session Keycloak (id_token_hint quand il est encore là) ;
  // une URL Keycloak nue laisserait l'application se croire connectée au retour.
  if (location.pathname === "/deconnexion") {
    return <DeconnexionEnCours />;
  }

  if (loading) {
    return (
      <div className="fr-container fr-my-4w">
        <p>Chargement...</p>
      </div>
    );
  }

  // Not logged in
  if (!user || user.expired) {
    return (
      <>
        <Header
          brandTop={<>RÉPUBLIQUE<br />FRANÇAISE</>}
          homeLinkProps={{ href: "/", title: "MyVault" }}
          operatorLogo={{ orientation: "vertical", imgUrl: "/logo-myvault.svg", alt: "MyVault" }}
          serviceTitle="Mon coffre-fort"
          serviceTagline="Mon coffre-fort sécurisé"
          quickAccessItems={[
            {
              iconId: "ri-login-box-line" as const,
              text: "Se connecter",
              linkProps: {
                href: "#",
                onClick: (e: React.MouseEvent) => { e.preventDefault(); handleLogin(); },
              },
            },
          ]}
        />
        <div className="fr-container fr-my-4w" style={{ textAlign: "center", padding: "4rem 0" }}>
          <h1>MyVault</h1>
          <p className="fr-text--lg fr-mb-3w">
            Gérez vos identifiants (clés API, tokens, mots de passe)
            pour toutes vos applications, en toute sécurité.
          </p>
          <button className="fr-btn fr-btn--lg" onClick={handleLogin}>
            Se connecter
          </button>
          {loginError && (
            <div className="fr-alert fr-alert--error fr-mt-2w" style={{ textAlign: "left" }}>
              <p>{loginError}</p>
            </div>
          )}
        </div>
        <Footer
          accessibility="partially compliant"
          brandTop={<>RÉPUBLIQUE<br />FRANÇAISE</>}
          homeLinkProps={{ href: "/", title: "MyVault" }}
        />
      </>
    );
  }

  const isAppsSection = location.pathname === "/" || location.pathname.startsWith("/app/") || location.pathname.startsWith("/bridge/");
  const isPersonalSection = location.pathname === "/personal";
  const isSecuritySection = location.pathname === "/security";
  const isAdminSection = location.pathname.startsWith("/admin");

  return (
    <SecurityProvider>
      {/* Le nom et « Se déconnecter » sont portés par le menu commun de la bêta (bulle en
          haut à droite, sortie GET /deconnexion) : une seule commande de compte à l'écran. */}
      <Header
        brandTop={<>RÉPUBLIQUE<br />FRANÇAISE</>}
        homeLinkProps={{ href: "/", title: "MyVault" }}
        operatorLogo={{ orientation: "vertical", imgUrl: "/logo-myvault.svg", alt: "MyVault" }}
        serviceTitle="Mon coffre-fort"
        serviceTagline="Mon coffre-fort sécurisé"
        navigation={[
          { text: "Mes applications", linkProps: { href: "/" }, isActive: isAppsSection },
          { text: "Coffre personnel", linkProps: { href: "/personal" }, isActive: isPersonalSection },
          { text: "Sécurité", linkProps: { href: "/security" }, isActive: isSecuritySection },
          ...(isAdmin
            ? [{ text: "Administration", linkProps: { href: "/admin" }, isActive: isAdminSection }]
            : []),
          { text: "Aide", linkProps: { href: "/guide" }, isActive: location.pathname === "/guide" },
        ]}
      />

      <div className="fr-container fr-my-4w">
        <Routes>
          <Route path="/" element={<VaultPage />} />
          <Route path="/personal" element={<PersonalVaultPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/app/:appSlug" element={<AppDetailPage />} />
          <Route path="/bridge/:appSlug" element={<BridgePage />} />
          {isAdmin && <Route path="/admin" element={<AdminPage />} />}
          {isAdmin && <Route path="/admin/apps/new" element={<AdminAppFormPage />} />}
          {isAdmin && <Route path="/admin/apps/:appId/edit" element={<AdminAppFormPage />} />}
          <Route path="/guide" element={<GuidePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <Footer
        accessibility="partially compliant"
        brandTop={<>RÉPUBLIQUE<br />FRANÇAISE</>}
        homeLinkProps={{ href: "/", title: "MyVault" }}
        bottomItems={[
          { text: "Accessibilité : partiellement conforme", linkProps: { href: "#" } },
          { text: "Mentions légales", linkProps: { href: "#" } },
        ]}
      />
    </SecurityProvider>
  );
}

export default App;
