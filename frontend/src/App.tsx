import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import VaultPage from "./pages/VaultPage";
import AppDetailPage from "./pages/AppDetailPage";
import AdminPage from "./pages/AdminPage";
import AdminAppFormPage from "./pages/AdminAppFormPage";
import BridgePage from "./pages/BridgePage";
import GuidePage from "./pages/GuidePage";
import { userApi, type UserProfile } from "./services/api";

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    userApi.getProfile().then(setUser).catch(() => {});
  }, []);

  const quickAccessItems = user
    ? [
        {
          iconId: "ri-account-circle-line" as const,
          text: user.name || user.email || user.user_id,
          linkProps: { href: "#" },
        },
        {
          iconId: "ri-logout-box-r-line" as const,
          text: "Se déconnecter",
          linkProps: { href: "/" },
        },
      ]
    : [
        {
          iconId: "ri-login-box-line" as const,
          text: "Se connecter",
          linkProps: { href: "/" },
        },
      ];

  return (
    <>
      <Header
        brandTop={
          <>
            RÉPUBLIQUE
            <br />
            FRANÇAISE
          </>
        }
        homeLinkProps={{ href: "/", title: "MyVault - Accueil" }}
        serviceTitle="MyVault"
        serviceTagline="Mon coffre-fort sécurisé"
        quickAccessItems={quickAccessItems}
        navigation={[
          { text: "Mon coffre-fort", linkProps: { href: "/" } },
          ...(user?.is_admin
            ? [{ text: "Administration", linkProps: { href: "/admin" } }]
            : []),
          { text: "Aide", linkProps: { href: "/guide" } },
        ]}
      />

      <div className="fr-container fr-my-4w">
        <Routes>
          <Route path="/" element={<VaultPage />} />
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
        brandTop={
          <>
            RÉPUBLIQUE
            <br />
            FRANÇAISE
          </>
        }
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
