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

  const handleLogout = useCallback(async () => {
    await logout();
  }, []);

  const userName = user?.profile?.name || user?.profile?.preferred_username || user?.profile?.email || "";

  // Popup route — renders standalone, no header/footer
  if (location.pathname.startsWith("/popup/")) {
    return (
      <Routes>
        <Route path="/popup/:appSlug" element={<PopupCredentialsPage />} />
      </Routes>
    );
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
          serviceTitle={<>MyVault <span className="fr-badge fr-badge--sm fr-badge--green-emeraude">Beta</span></>}
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
      <Header
        brandTop={<>RÉPUBLIQUE<br />FRANÇAISE</>}
        homeLinkProps={{ href: "/", title: "MyVault" }}
        serviceTitle={<>MyVault <span className="fr-badge fr-badge--sm fr-badge--green-emeraude">Beta</span></>}
        serviceTagline="Mon coffre-fort sécurisé"
        quickAccessItems={[
          {
            iconId: "ri-account-circle-line" as const,
            text: userName,
            linkProps: { href: "#" },
          },
          {
            iconId: "ri-logout-box-r-line" as const,
            text: "Se déconnecter",
            linkProps: {
              href: "#",
              onClick: (e: React.MouseEvent) => { e.preventDefault(); handleLogout(); },
            },
          },
        ]}
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
