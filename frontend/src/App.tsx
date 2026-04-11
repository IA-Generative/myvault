import { useEffect, useState, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import VaultPage from "./pages/VaultPage";
import PersonalVaultPage from "./pages/PersonalVaultPage";
import AppDetailPage from "./pages/AppDetailPage";
import AdminPage from "./pages/AdminPage";
import AdminAppFormPage from "./pages/AdminAppFormPage";
import BridgePage from "./pages/BridgePage";
import GuidePage from "./pages/GuidePage";
import { login, logout, getUser, handleCallback, type User } from "./services/auth";

function App() {
  const [user, setUser] = useState<User | null>(null);
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
          serviceTitle="MyVault"
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
  const isAdminSection = location.pathname.startsWith("/admin");

  return (
    <>
      <Header
        brandTop={<>RÉPUBLIQUE<br />FRANÇAISE</>}
        homeLinkProps={{ href: "/", title: "MyVault" }}
        serviceTitle="MyVault"
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
          { text: "Applications", linkProps: { href: "/" }, isActive: isAppsSection },
          { text: "Mes identifiants", linkProps: { href: "/personal" }, isActive: isPersonalSection },
          { text: "Administration", linkProps: { href: "/admin" }, isActive: isAdminSection },
          { text: "Aide", linkProps: { href: "/guide" }, isActive: location.pathname === "/guide" },
        ]}
      />

      <div className="fr-container fr-my-4w">
        <Routes>
          <Route path="/" element={<VaultPage />} />
          <Route path="/personal" element={<PersonalVaultPage />} />
          <Route path="/app/:appSlug" element={<AppDetailPage />} />
          <Route path="/bridge/:appSlug" element={<BridgePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/apps/new" element={<AdminAppFormPage />} />
          <Route path="/admin/apps/:appId/edit" element={<AdminAppFormPage />} />
          <Route path="/guide" element={<GuidePage />} />
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
    </>
  );
}

export default App;
