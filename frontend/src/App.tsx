import { Routes, Route } from "react-router-dom";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import VaultPage from "./pages/VaultPage";
import AppDetailPage from "./pages/AppDetailPage";
import AdminPage from "./pages/AdminPage";
import AdminAppFormPage from "./pages/AdminAppFormPage";
import BridgePage from "./pages/BridgePage";
import GuidePage from "./pages/GuidePage";

function App() {
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
        serviceTagline="Coffre-fort de credentials"
        navigation={[
          { text: "Mon coffre-fort", linkProps: { href: "/" } },
          { text: "Administration", linkProps: { href: "/admin" } },
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
