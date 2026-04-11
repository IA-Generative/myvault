# Prompt : Conception et déploiement de MyVault — Coffre-fort de credentials utilisateur pour l'écosystème MirAI

## Contexte

Ce prompt est destiné à un **coding assistant** (Claude Code, Cursor, etc.) pour concevoir, développer et déployer un composant souverain de gestion de secrets utilisateur nommé **MyVault**.

### Écosystème cible
- **OpenWebUI** (MirAI) : tools, filters, pipes nécessitant des credentials utilisateur (clés API, tokens, logins)
- **Applications web internes** : tools Tchap, Grist, et tout outil de la Fabrique Numérique
- **Infrastructure** : Cloud Pi Native (Kubernetes) et poste développeur (Docker)

### Contraintes souveraines
- Hébergement SecNumCloud / Cloud Pi Native compatible
- Pas de dépendance à un SaaS externe
- Standards DSFR (Design System de l'État Français) pour toute IHM
- Authentification SSO via Keycloak existant (OIDC)

---

## Phase 1 — Choix d'architecture et socle technique

### 1.1 Évaluation du moteur de secrets

Évalue et recommande **une** solution parmi :

| Critère | OpenBao | Infisical | Custom (PostgreSQL + chiffrement applicatif) |
|---------|---------|-----------|----------------------------------------------|
| Complexité opérationnelle | ? | ? | ? |
| Intégration Keycloak OIDC native | ? | ? | ? |
| API REST / SDK Python | ? | ? | ? |
| Licence OSS | MPL-2.0 | MIT | — |
| Empreinte mémoire | ? | ? | ? |
| Unseal ceremony nécessaire | ? | ? | ? |

> **Critère décisif** : simplicité opérationnelle + intégration OIDC + API ergonomique. Si OpenBao impose une unseal ceremony trop lourde pour un usage "coffre-fort utilisateur" (≠ PKI/rotation de secrets infra), privilégie une solution plus légère.

### 1.2 Architecture cible

```
┌─────────────────────────────────────────────────────┐
│                    Utilisateur                       │
│              (navigateur, SSO Keycloak)              │
└───────────────┬─────────────────────────────────────┘
                │ OIDC token
                ▼
┌─────────────────────────────────────────────────────┐
│              MyVault Frontend (DSFR)                 │
│         https://myvault.fake-domain.name             │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Mon       │  │ Mes      │  │ Administration   │   │
│  │ coffre    │  │ apps     │  │ (rôle admin)     │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└───────────────┬─────────────────────────────────────┘
                │ API REST (Bearer token)
                ▼
┌─────────────────────────────────────────────────────┐
│              MyVault Backend (FastAPI)                │
│                                                      │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │ Auth       │ │ Vault        │ │ App Registry  │  │
│  │ middleware │ │ Service      │ │ & enrollment  │  │
│  └────────────┘ └──────────────┘ └───────────────┘  │
│                       │                              │
│              ┌────────┴────────┐                     │
│              │ Secret Engine   │                     │
│              │ (chiffrement    │                     │
│              │  AES-256-GCM)   │                     │
│              └────────┬────────┘                     │
│                       ▼                              │
│              ┌─────────────────┐                     │
│              │  PostgreSQL     │                     │
│              │  (secrets       │                     │
│              │   chiffrés)     │                     │
│              └─────────────────┘                     │
└─────────────────────────────────────────────────────┘
```

---

## Phase 2 — Modèle de données et API

### 2.1 Entités principales

#### Application (gérée par l'admin)

```json
{
  "app_id": "uuid",
  "client_id": "myvault-grist-tool",        // syntaxe Keycloak
  "client_secret": "auto-généré ou fourni",
  "name": "Grist Connector",
  "description": "Accès à l'API Grist",
  "icon_url": "https://...",
  "friendly_slug": "grist-connector",        // → https://myvault.fake-domain.name/app/grist-connector
  "status": "active | disabled",
  "required_variables": [
    {
      "key": "api_token",
      "label": "Clé API Grist",
      "type": "secret",
      "required": true,
      "description": "Token d'accès personnel Grist"
    },
    {
      "key": "server_url",
      "label": "URL du serveur Grist",
      "type": "url",
      "required": true,
      "default": "https://grist.numerique.gouv.fr"
    },
    {
      "key": "doc_id",
      "label": "ID du document par défaut",
      "type": "text",
      "required": false
    }
  ],
  "check_connection_endpoint": "/api/v1/tools/grist-connector/check",
  "created_at": "ISO8601",
  "created_by": "admin_user_id"
}
```

#### Enrôlement d'application (format compatible Keycloak)

L'import/export d'applications doit être possible via un fichier JSON structuré comme un `client` Keycloak :

```json
{
  "clients": [
    {
      "clientId": "myvault-grist-tool",
      "name": "Grist Connector",
      "secret": "...",
      "enabled": true,
      "protocol": "openid-connect",
      "attributes": {
        "myvault.variables": "[...]",
        "myvault.check_endpoint": "..."
      }
    }
  ]
}
```

#### Entrée utilisateur (User Vault Entry)

```json
{
  "entry_id": "uuid",
  "user_id": "sub du token OIDC",
  "app_id": "uuid de l'application",
  "enabled": true,
  "values": {
    "api_token": "encrypted:base64...",
    "server_url": "https://grist.numerique.gouv.fr",
    "doc_id": "abc123"
  },
  "last_check": "ISO8601",
  "check_status": "ok | error | untested",
  "updated_at": "ISO8601"
}
```

### 2.2 Types de variables standards

| Type        | Code           | Rendu IHM                          | Stockage          |
|-------------|----------------|------------------------------------|-------------------|
| Texte court | `text`         | Input texte                        | Clair             |
| Texte long  | `textarea`     | Textarea                           | Clair             |
| Numérique   | `number`       | Input number                       | Clair             |
| Booléen     | `boolean`      | Toggle switch                      | Clair             |
| URL         | `url`          | Input URL avec validation          | Clair             |
| Email       | `email`        | Input email avec validation        | Clair             |
| Sélection   | `select`       | Dropdown (options dans `choices`)   | Clair             |
| Multi-select| `multi_select` | Checkboxes / multi-dropdown        | Clair             |
| Secret      | `secret`       | Input masqué + toggle + copier     | **Chiffré**       |
| Clé API     | `api_key`      | Input masqué + toggle + copier     | **Chiffré**       |
| Login       | `login`        | Input texte                        | **Chiffré**       |
| Mot de passe| `password`     | Input masqué + toggle + copier     | **Chiffré**       |
| Token OAuth | `oauth_token`  | Input masqué + toggle + copier     | **Chiffré**       |
| Certificat  | `certificate`  | Upload / textarea PEM              | **Chiffré**       |
| JSON        | `json`         | Code editor (JSON)                 | **Chiffré** (opt) |

### 2.3 API REST — Endpoints principaux

```
# --- Public (frontend utilisateur) ---
GET    /api/v1/me/apps                           # Mes applications disponibles
GET    /api/v1/me/apps/{app_slug}/entries         # Mes entrées pour une app
PUT    /api/v1/me/apps/{app_slug}/entries         # Sauvegarder mes valeurs
PATCH  /api/v1/me/apps/{app_slug}/toggle          # Activer/désactiver
POST   /api/v1/me/apps/{app_slug}/check           # Tester la connexion
GET    /api/v1/me/entries                         # Toutes mes entrées (cross-app)

# --- Accès tool/machine (auth client_credentials) ---
GET    /api/v1/vault/{app_slug}/user/{user_id}    # Lire les secrets d'un user pour cette app
POST   /api/v1/apps/enroll                        # Auto-enrôlement d'une app (client_id + secret)
GET    /api/v1/apps/{app_slug}/check/{user_id}    # Vérifier les credentials d'un user

# --- Administration ---
POST   /api/v1/admin/apps                         # Créer une application
PUT    /api/v1/admin/apps/{app_id}                # Modifier
DELETE /api/v1/admin/apps/{app_id}                # Supprimer
POST   /api/v1/admin/apps/import                  # Import JSON (format Keycloak)
GET    /api/v1/admin/apps/export                  # Export JSON
GET    /api/v1/admin/users                        # Liste des utilisateurs provisionnés
```

---

## Phase 3 — Frontend DSFR

### 3.1 Principes

- Utiliser `@gouvfr/dsfr` (npm) ou les classes CSS DSFR
- Responsive, accessible (RGAA)
- Framework : React (ou Vue si plus pertinent pour l'écosystème)

### 3.2 Écrans principaux

#### Vue utilisateur — "Mon coffre-fort"
- Liste des applications avec badge d'état (actif/inactif/erreur)
- Pour chaque app : formulaire de saisie des variables selon leur type
- Les champs secrets : masqués par défaut, icône œil pour toggle, icône copier avec toast "Copié !"
- Bouton "Tester la connexion" avec indicateur visuel (spinner → ✓ vert / ✗ rouge)
- Toggle activer/désactiver par application

#### Vue administrateur — "Gestion des applications"
- CRUD applications
- Import/Export JSON (format Keycloak-compatible)
- Vue des utilisateurs provisionnés par application
- Monitoring des check_connection

### 3.3 Comportement des champs secrets

```
┌─────────────────────────────────────────────────┐
│ Clé API Grist                                    │
│ ┌────────────────────────────────┐  👁  📋       │
│ │ ●●●●●●●●●●●●●●●●●●●●●●●●●●●● │               │
│ └────────────────────────────────┘               │
│                                                   │
│ [clic sur 👁]                                     │
│ ┌────────────────────────────────┐  👁  📋       │
│ │ gsk_a1b2c3d4e5f6g7h8i9j0....  │               │
│ └────────────────────────────────┘               │
│                                                   │
│ [clic sur 📋] → Toast : "Valeur copiée ✓"       │
│                                                   │
│ En mode saisie : la valeur est affichée en clair │
└─────────────────────────────────────────────────┘
```

---

## Phase 4 — Intégration OpenWebUI (tools/filters/pipes)

### 4.1 SDK Python — `myvault_client`

Développe un package Python `myvault-client` utilisable dans les tools OpenWebUI :

```python
from myvault_client import MyVaultClient, CredentialsMissing

class MyGristTool:
    # Déclaration des variables nécessaires (auto-enrôlement)
    MYVAULT_APP = {
        "client_id": "myvault-grist-tool",
        "client_secret": "${MYVAULT_GRIST_SECRET}",  # depuis env/secret K8s
        "variables": [
            {"key": "api_token", "label": "Clé API Grist", "type": "api_key", "required": True},
            {"key": "server_url", "label": "URL serveur", "type": "url", "default": "https://grist.numerique.gouv.fr"},
        ]
    }

    async def run(self, user_id: str, **kwargs):
        vault = MyVaultClient()

        try:
            creds = await vault.get_credentials(
                app_id="myvault-grist-tool",
                user_id=user_id
            )
        except CredentialsMissing as e:
            # Auto-enrôlement si nécessaire
            await vault.ensure_enrolled(self.MYVAULT_APP)
            # Message utilisateur avec lien direct
            return {
                "error": "credentials_required",
                "message": (
                    "⚙️ Ce tool nécessite vos identifiants Grist. "
                    "Veuillez les configurer dans votre coffre-fort :"
                ),
                "action_url": f"https://myvault.fake-domain.name/app/grist-connector",
                "action_label": "Configurer mes accès Grist"
            }

        # Utilisation normale
        return await self.query_grist(creds["api_token"], creds["server_url"])

    # Interface normalisée check_connection
    @staticmethod
    async def check_connection(credentials: dict) -> dict:
        """API normalisée appelée par MyVault pour tester la connexion."""
        try:
            resp = httpx.get(
                f"{credentials['server_url']}/api/orgs",
                headers={"Authorization": f"Bearer {credentials['api_token']}"}
            )
            return {"status": "ok", "detail": f"{resp.json()} orgs accessibles"}
        except Exception as e:
            return {"status": "error", "detail": str(e)}
```

### 4.2 Flux d'interaction complet

```
Utilisateur demande "liste mes documents Grist"
         │
         ▼
    OpenWebUI appelle GristTool.run(user_id=...)
         │
         ▼
    MyVaultClient.get_credentials(app="grist", user=user_id)
         │
    ┌────┴────┐
    │ Creds   │ Non → auto_enroll() → retourne message
    │ trouvés?│       + lien vers myvault.fake-domain.name/app/grist-connector
    └────┬────┘
         │ Oui
         ▼
    Appel API Grist avec les credentials
         │
    ┌────┴────┐
    │ Succès? │ Non → retourne message + lien mise à jour credentials
    └────┬────┘
         │ Oui
         ▼
    Réponse à l'utilisateur
```

---

## Phase 5 — Sécurité

### 5.1 Chiffrement
- **Au repos** : AES-256-GCM, clé maître dans secret Kubernetes (`myvault-master-key`)
- **En transit** : TLS 1.3 obligatoire
- **Dérivation** : une clé par utilisateur dérivée de la clé maître (HKDF-SHA256)

### 5.2 Authentification
- **Utilisateurs** : OIDC via Keycloak (token Bearer)
- **Applications/tools** : client_credentials grant (client_id + client_secret)
- **Admin** : rôle Keycloak `myvault-admin` dans le realm

### 5.3 Gestion des secrets de déploiement
```yaml
# Secret Kubernetes pour les credentials MyVault → tools
apiVersion: v1
kind: Secret
metadata:
  name: myvault-credentials
  namespace: mirai
type: Opaque
data:
  MYVAULT_URL: base64(https://myvault.fake-domain.name)
  MYVAULT_MASTER_KEY: base64(...)
  MYVAULT_DB_PASSWORD: base64(...)

# Secret pour chaque tool intégré
apiVersion: v1
kind: Secret
metadata:
  name: myvault-grist-tool-credentials
type: Opaque
data:
  MYVAULT_CLIENT_ID: base64(myvault-grist-tool)
  MYVAULT_CLIENT_SECRET: base64(...)
```

### 5.4 Audit
- Log de chaque accès aux secrets (qui, quand, quel secret, quelle app)
- Pas de log de la valeur du secret elle-même
- Rotation possible des clés de chiffrement (re-encryption en background)

---

## Phase 6 — Déploiement

### 6.1 Docker local

```bash
# Trouver un port libre automatiquement
# Déployer : PostgreSQL + MyVault backend + MyVault frontend
# Exposer sur http://localhost:{PORT_LIBRE}
```

> **Contrainte** : scanner les ports utilisés sur la machine avant de choisir. Proposer un `docker-compose.yml` complet.

### 6.2 Kubernetes Scaleway

- Chercher les credentials de déploiement dans le repository `device-management`
- Déployer via Helm chart ou manifestes Kustomize
- Exposer sur `https://myvault.fake-domain.name`
- ConfigMap + Secrets pour la configuration
- Health checks (liveness + readiness probes)
- Resources limits (CPU/memory)

---

## Phase 7 — Tests

### 7.1 Tests techniques

| Catégorie | Tests |
|-----------|-------|
| Unitaires | Chiffrement/déchiffrement, validation types, parsing Keycloak JSON |
| Intégration | Auth OIDC, CRUD complet via API, auto-enrôlement |
| Sécurité | Injection SQL, XSS, accès cross-user, brute force |
| Performance | 100 users concurrents, latence P95 < 200ms |

### 7.2 Tests fonctionnels

| Scénario | Attendu |
|----------|---------|
| Utilisateur se connecte pour la 1ère fois | Auto-provisionnement, vue vide |
| Admin crée une application | App visible pour tous les utilisateurs |
| Utilisateur saisit ses credentials | Sauvegarde chiffrée, confirmation visuelle |
| Utilisateur clique "Tester connexion" | Appel check_connection, résultat affiché |
| Tool OpenWebUI sans credentials | Message + lien vers MyVault |
| Import JSON format Keycloak | Applications créées correctement |
| Toggle visibilité secret | Masqué ↔ visible |
| Copier un secret | Clipboard + toast "Copié ✓" |
| Désactiver une application | Credentials non retournés par l'API |

### 7.3 Rapport

Produire un rapport de test au format Markdown avec : résumé, détail par test, screenshots le cas échéant, recommandations.

---

## Phase 8 — Prompt d'intégration pour tools existants

Une fois MyVault déployé, génère un **prompt réutilisable** pour qu'un coding assistant puisse adapter n'importe quel tool/filter/pipe OpenWebUI existant. Ce prompt doit couvrir :

1. **Auto-enrôlement** : déclarer `MYVAULT_APP` avec `client_id`, `client_secret`, et la liste des variables (format identique à un `client` Keycloak)
2. **Interface `check_connection`** : endpoint normalisé retournant `{"status": "ok|error", "detail": "..."}`
3. **Détection et redirection** : si credentials absents ou invalides → auto-enroll si nécessaire → message utilisateur avec lien cliquable vers `https://myvault.fake-domain.name/app/{slug}`
4. **Variables d'environnement** : `MYVAULT_URL`, `MYVAULT_CLIENT_ID`, `MYVAULT_CLIENT_SECRET` lues depuis secrets K8s ou `.env`

---

## Phase 8bis — URL de partage et pont visuel entre MyVault et les applications

### 8bis.1 URL de visualisation partageable

Chaque application enrôlée dans MyVault expose une **URL publique ergonomique** permettant à l'utilisateur de visualiser et copier ses variables vers/depuis l'application cible :

```
https://myvault.fake-domain.name/bridge/{app_slug}
```

Cette page affiche :

```
┌─────────────────────────────────────────────────────────────────┐
│  🔗 Pont de configuration — Grist Connector                     │
│                                                                  │
│  Copiez vos variables vers l'application ou importez-les ici.   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Variable          │ Valeur MyVault      │ Actions           │ │
│  ├───────────────────┼─────────────────────┼───────────────────┤ │
│  │ 🔑 Clé API       │ ●●●●●●●●  👁 📋    │ [Copier vers app] │ │
│  │ 🌐 URL serveur   │ https://grist...  📋│ [Copier vers app] │ │
│  │ 📄 Doc ID        │ abc123           📋 │ [Copier vers app] │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [📋 Tout copier au format JSON]  [📋 Tout copier en .env]      │
│                                                                  │
│  ── Import depuis l'application ──────────────────────────       │
│  [📂 Coller un JSON]  [📂 Coller un .env]  [📂 Importer fichier]│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Fonctionnalités** :

- **Export multi-format** : copie l'ensemble des variables au format JSON, `.env` (KEY=VALUE), ou individuellement
- **Import** : l'utilisateur peut coller un bloc JSON ou `.env` extrait de l'application cible ; MyVault parse et pré-remplit les champs correspondants
- **Mapping intelligent** : si l'application source utilise des noms de variables différents (ex : `GRIST_API_KEY` vs `api_token`), l'admin peut définir un mapping dans la configuration de l'app :
  ```json
  {
    "variable_aliases": {
      "api_token": ["GRIST_API_KEY", "GRIST_TOKEN", "API_KEY"],
      "server_url": ["GRIST_URL", "GRIST_SERVER", "BASE_URL"]
    }
  }
  ```
- **Lien deep-link** : l'URL `/bridge/{app_slug}` peut recevoir un paramètre `?source=openwebui` pour adapter le wording et le format d'export par défaut
- **QR Code** : un QR code de la page bridge est généré pour faciliter le partage sur mobile ou entre postes

### 8bis.2 API de bridge

```
# Récupérer les variables au format d'export
GET  /api/v1/me/bridge/{app_slug}?format=json|env|yaml
# Importer des variables depuis un format externe
POST /api/v1/me/bridge/{app_slug}/import
     Content-Type: application/json
     Body: { "format": "env", "data": "API_KEY=xxx\nSERVER=yyy" }
```

---

## Phase 8ter — Overlay in-app et injection de credentials

### 8ter.1 Évaluation de l'injection de credentials

Le coding assistant doit **évaluer la faisabilité** de trois approches d'intégration directe dans les applications cibles, en produisant un tableau comparatif :

| Approche | Mécanisme | Avantages | Risques | Faisabilité |
|----------|-----------|-----------|---------|-------------|
| **A — Injection directe** | L'application cible appelle l'API MyVault côté serveur et injecte les credentials dans ses propres champs de config | Transparent pour l'utilisateur, pas de manipulation manuelle | Nécessite que chaque app soit modifiée côté backend | Élevée si on contrôle l'app (OpenWebUI, Grist interne) |
| **B — Overlay iframe** | MyVault sert un widget `<iframe>` embarquable via une URL type `https://myvault.fake-domain.name/widget/{app_slug}?embed=true` que l'application affiche en surimposition | Pas de modification backend de l'app cible, UX unifiée | Contraintes CSP / X-Frame-Options, isolation cookie cross-origin | Moyenne — dépend des headers de l'app hôte |
| **C — Extension navigateur** | Un plugin navigateur détecte l'application, affiche un petit panneau flottant MyVault, et peut auto-remplir les champs | Zéro modification de l'app cible, fonctionne partout | Nécessite installation du plugin, maintenance multi-navigateur | Élevée — approche la plus découplée |

### 8ter.2 Widget overlay embarquable (Approche B)

Si l'application cible le permet (headers CSP compatibles), MyVault fournit un **widget overlay** :

```html
<!-- Intégration dans une application tierce -->
<script src="https://myvault.fake-domain.name/widget/loader.js"
        data-app="grist-connector"
        data-position="bottom-right"
        data-theme="dsfr">
</script>
```

Le widget `loader.js` :

1. Vérifie que l'utilisateur est authentifié (cookie SSO / token)
2. Affiche un **bouton flottant discret** (🔐) en bas à droite de la page
3. Au clic, ouvre un **panneau glissant** semi-transparent en surimposition :

```
┌──────────────────────────────────────┐
│  🔐 MyVault — Grist Connector        │  ✕
│──────────────────────────────────────│
│                                      │
│  🔑 Clé API    ●●●●●●  👁 📋        │
│  🌐 URL        https://g... 📋      │
│  📄 Doc ID     abc123      📋       │
│                                      │
│  État : ✅ Connexion OK              │
│                                      │
│  [Modifier dans MyVault ↗]          │
│  [Rafraîchir]  [Tester connexion]   │
└──────────────────────────────────────┘
```

**Contraintes techniques à documenter** :
- Le widget doit fonctionner en cross-origin : utiliser `postMessage` pour la communication parent ↔ iframe
- L'authentification du widget repose sur le cookie SSO (SameSite=None, Secure) ou un token temporaire
- Le CSS du widget est isolé via Shadow DOM pour ne pas interférer avec l'application hôte
- Le widget ne doit JAMAIS injecter de credentials dans le DOM de l'application hôte (risque XSS) — il ne fait que afficher/copier

### 8ter.3 Auto-fill côté serveur (Approche A)

Pour les applications que l'on contrôle (OpenWebUI, tools internes), documenter le pattern d'injection côté serveur :

```python
# Dans le backend de l'application cible
from myvault_client import MyVaultClient

async def get_user_config(user_id: str, app_slug: str):
    """Récupère les credentials et les injecte dans la config de l'app."""
    vault = MyVaultClient()
    creds = await vault.get_credentials(app_id=app_slug, user_id=user_id)

    # Injection dans la config de l'app (pas dans le DOM !)
    app_config = {
        "api_key": creds["api_token"],
        "base_url": creds["server_url"],
    }
    return app_config
```

---

## Phase 8quater — Prompt pour la création d'un plugin navigateur MyVault

Générer un **prompt complet et autonome** destiné à un coding assistant pour créer une extension navigateur (Firefox + Chrome) nommée **"MyVault Assistant"**. Le prompt généré doit contenir :

### Structure du prompt à produire

#### 1. Contexte et objectif
> L'extension navigateur "MyVault Assistant" permet aux agents de l'État utilisant MyVault de visualiser, copier et gérer leurs credentials directement depuis n'importe quelle application web, sans quitter la page en cours.

#### 2. Fonctionnalités à implémenter

**2.1 — Détection d'application**
- L'extension maintient une liste des applications enrôlées dans MyVault (synchronisée via l'API `/api/v1/me/apps`)
- Quand l'utilisateur navigue sur une URL correspondant à une application connue (ex : `grist.numerique.gouv.fr`), l'icône de l'extension s'active avec un badge
- Mapping URL → app configurable par l'utilisateur et/ou poussé par l'admin via l'API :
  ```json
  {
    "app_slug": "grist-connector",
    "url_patterns": [
      "https://grist.numerique.gouv.fr/*",
      "https://*.grist.internal/*"
    ]
  }
  ```

**2.2 — Panneau popup (click sur l'icône)**
```
┌──────────────────────────────────────────┐
│  🔐 MyVault Assistant                    │
│──────────────────────────────────────────│
│                                          │
│  📍 Application détectée :               │
│     Grist Connector                      │
│     ✅ Credentials configurés            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🔑 Clé API     ●●●●●●  👁 📋     │  │
│  │ 🌐 URL serveur https://...  📋    │  │
│  │ 📄 Doc ID      abc123      📋     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [Tester connexion]                      │
│  [Ouvrir dans MyVault ↗]                │
│                                          │
│  ── Autres applications ──               │
│  ☐ GitHub (⚠️ non configuré)            │
│  ☐ LinkedIn (✅ OK)                      │
│  ☐ Mattermost (✅ OK)                    │
│                                          │
│  ⚙️ Paramètres                           │
└──────────────────────────────────────────┘
```

**2.3 — Content script (overlay in-page)**
- Sur les pages d'applications détectées, l'extension peut injecter un **bouton flottant** (🔐) discret en bas à droite
- Au clic → panneau glissant avec les credentials de l'app (même rendu que le widget Phase 8ter.2)
- **Option auto-fill** (activable par l'utilisateur, désactivée par défaut) : détecte les champs de formulaire de l'application et propose de les remplir automatiquement. Le remplissage est toujours précédé d'une confirmation visuelle :
  ```
  "MyVault veut remplir 3 champs sur cette page.
   🔑 API Key → champ #api-token
   🌐 Server → champ #server-url
   [Remplir]  [Annuler]  [Ne plus demander pour ce site]"
  ```

**2.4 — Notifications**
- Notification navigateur quand un tool OpenWebUI signale des credentials manquants (via WebSocket ou polling)
- Badge sur l'icône avec le nombre d'actions requises

**2.5 — Sécurité du plugin**
- Aucun secret stocké dans le `localStorage` ou `chrome.storage` de l'extension
- Tous les appels passent par l'API MyVault avec le token SSO
- Le content script n'a JAMAIS accès aux valeurs en clair sans action explicite de l'utilisateur
- Permissions minimales : `activeTab`, `storage` (pour les préférences uniquement), `notifications`
- CSP strict dans le manifest

#### 3. Stack technique du plugin

```json
{
  "manifest_version": 3,
  "name": "MyVault Assistant",
  "description": "Gérez vos credentials MyVault depuis votre navigateur",
  "permissions": ["activeTab", "storage", "notifications"],
  "host_permissions": ["https://myvault.fake-domain.name/*"],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html", "default_icon": "icons/myvault-48.png" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "css": ["content.css"],
    "run_at": "document_idle"
  }],
  "icons": { "16": "icons/myvault-16.png", "48": "icons/myvault-48.png", "128": "icons/myvault-128.png" }
}
```

#### 4. Compatibilité
- **Firefox** : via `browser.*` API (WebExtension)
- **Chrome/Chromium** : via `chrome.*` API (Manifest V3)
- Utiliser `webextension-polyfill` pour le code partagé
- Publier sur Firefox Add-ons et Chrome Web Store (ou distribution interne `.xpi` / `.crx` pour le ministère)

#### 5. Tests du plugin
- Test de détection d'URL sur les applications connues
- Test du popup avec credentials mockés
- Test du content script (injection du bouton flottant, panneau, auto-fill)
- Test de sécurité : vérifier qu'aucun secret ne persiste dans le storage local
- Test cross-browser : Firefox + Chrome

#### 6. Livrables du plugin
- Repository séparé ou sous-dossier `browser-extension/` dans le repo myvault
- README dédié avec instructions d'installation en mode développeur
- Screenshots pour les stores

---

### Option K — 🌐 Widget overlay universel
![Widget](https://img.icons8.com/fluency/48/iframe.png)
Fournir le widget `loader.js` embarquable (Phase 8ter.2) comme un composant autonome distribuable. L'admin déclare les applications compatibles et le widget s'active automatiquement. Inclut un mode "kiosque" pour les postes partagés où le panneau reste ouvert en permanence.

### Option L — 🧩 Extension navigateur MyVault Assistant
![Extension](https://img.icons8.com/fluency/48/chrome.png)
Développer l'extension navigateur complète (Phase 8quater) avec détection d'application, panneau popup DSFR, overlay in-page, auto-fill avec confirmation, et notifications push. Distribuable via Firefox Add-ons, Chrome Web Store, ou en `.xpi`/`.crx` pour déploiement ministériel contrôlé.

---

## Options et variantes à considérer

### Option A — 🏢 Multi-tenant
Ajouter un concept d'**organisation** (direction, service) pour partager des credentials d'équipe (ex : un token API partagé par une équipe).

### Option B — 🔄 Rotation automatique
Intégrer un mécanisme de rotation automatique pour les tokens OAuth (refresh_token flow).

### Option C — 💬 Intégration Tchap
![Tchap](https://tchap.gouv.fr/favicon.ico)
Notifications Tchap quand un credential expire ou qu'un check_connection échoue. Utilise le bot Tchap (Matrix protocol) pour envoyer des alertes dans un salon dédié ou en message direct à l'utilisateur concerné.

### Option D — 📴 Mode offline / dégradé
Cache local chiffré des secrets pour les cas de coupure réseau avec le vault.

### Option E — 📊 Audit dashboard
Tableau de bord admin montrant les accès aux secrets, les check_connection en échec, les credentials expirés.

### Option F — 💬 Intégration Mattermost
![Mattermost](https://developers.mattermost.com/img/favicon.ico)
Connecteur bidirectionnel Mattermost via son API REST v4 et le système de webhooks :
- **Notifications** : alertes dans un canal dédié ou en DM quand un credential expire, un `check_connection` échoue, ou qu'un nouvel outil est enrôlé
- **Slash command** `/myvault` : permet à un utilisateur de vérifier l'état de ses credentials, déclencher un check_connection, ou obtenir un lien direct vers son coffre-fort depuis Mattermost
- **Bot interactif** : boutons d'action dans les messages (ex : "Configurer maintenant", "Ignorer") via les Interactive Messages de Mattermost
- **Variables requises** : `mattermost_url`, `mattermost_bot_token` (type `api_key`), `mattermost_channel_id` (type `text`)

### Option G — 🔵 Intégration Google Workspace
![Google](https://www.google.com/favicon.ico)
Connecteur OAuth 2.0 pour les services Google (Drive, Sheets, Calendar, Gmail) :
- **OAuth flow complet** : MyVault gère le flux authorization_code avec PKCE, stocke les `access_token` et `refresh_token` de manière chiffrée, et les renouvelle automatiquement
- **Consent screen intégré** : l'utilisateur clique "Connecter Google" dans MyVault → redirect vers Google → retour avec tokens stockés automatiquement
- **Scopes granulaires** : l'admin définit les scopes requis par application (ex : `drive.readonly`, `sheets`, `calendar.events`)
- **Révocation** : bouton "Déconnecter" qui révoque le token côté Google et purge le stockage local
- **Variables gérées** : `google_client_id`, `google_client_secret` (niveau admin), `google_access_token`, `google_refresh_token` (niveau utilisateur, auto-géré)
- **check_connection** : appel `GET https://www.googleapis.com/oauth2/v1/tokeninfo` pour vérifier la validité

### Option H — 🐙 Intégration GitHub
![GitHub](https://github.githubassets.com/favicons/favicon-dark.svg)
Connecteur pour l'API GitHub (repos, issues, PRs, Actions) :
- **Deux modes d'auth** : Personal Access Token (PAT) classique ou GitHub App (installation token) pour les cas organisationnels
- **OAuth Device Flow** : alternative au flow web pour les environnements sans navigateur (CLI, pipelines)
- **Scopes déclarés** : l'admin configure les permissions requises (`repo`, `read:org`, `workflow`, etc.) et MyVault vérifie que le token fourni les possède
- **Validation enrichie** : `check_connection` vérifie le token, retourne le username, les scopes actifs, et le rate limit restant
- **Variables requises** : `github_token` (type `api_key`), `github_org` (type `text`, optionnel), `github_api_url` (type `url`, défaut `https://api.github.com` — permet GitHub Enterprise)

### Option I — 🔗 Intégration LinkedIn
![LinkedIn](https://static.licdn.com/aero-v1/sc/h/akt4ae504epesldzj74dzred8)
Connecteur OAuth 2.0 pour l'API LinkedIn (profil, partage, analytics) :
- **OAuth 2.0 3-legged** : MyVault orchestre le flux d'autorisation LinkedIn avec les scopes `openid`, `profile`, `email`, `w_member_social`
- **Publication depuis les tools** : un tool OpenWebUI peut poster sur LinkedIn au nom de l'utilisateur (ex : tool "Publier un résumé sur LinkedIn")
- **Token management** : les access tokens LinkedIn expirent à 60 jours — MyVault alerte l'utilisateur 7 jours avant expiration et propose un re-consent en un clic
- **check_connection** : appel `GET https://api.linkedin.com/v2/userinfo` pour vérifier la validité et retourner le nom affiché
- **Variables requises** : `linkedin_client_id`, `linkedin_client_secret` (niveau admin), `linkedin_access_token` (niveau utilisateur, auto-géré via OAuth flow)

### Option J — 🔌 Framework générique OAuth Provider
> **Recommandation** : si plusieurs options parmi G/H/I sont activées, factoriser un **framework générique de connecteur OAuth** dans MyVault :
>
> ```python
> # Déclaration d'un provider OAuth dans l'admin
> {
>   "provider": "google",
>   "auth_type": "oauth2_authorization_code",
>   "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
>   "token_url": "https://oauth2.googleapis.com/token",
>   "scopes": ["drive.readonly", "sheets"],
>   "token_expiry_days": 90,
>   "supports_refresh": true,
>   "userinfo_endpoint": "https://www.googleapis.com/oauth2/v3/userinfo"
> }
> ```
>
> Cela permet d'ajouter n'importe quel provider OAuth (Gitlab, Atlassian, Slack, Microsoft 365…) sans code, uniquement par configuration admin.

---

## Phase 9 — Repository Git et livrables

### 9.1 Repository

Le livrable final est un **repository Git public** hébergé sur :

> **https://github.com/IA-Generative/myvault**

Toutes les phases précédentes doivent produire du code commité dans ce repo. Le repo doit être prêt à cloner et à exécuter (`docker compose up`) en moins de 5 minutes.

### 9.2 Structure du repository

```
myvault/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # CI : lint, tests unitaires, build
│   │   ├── security-scan.yml         # Scan de secrets (gitleaks/trufflehog), SAST
│   │   └── release.yml               # Build & push images Docker
│   └── CODEOWNERS
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI entrypoint
│   │   ├── api/                      # Routes par domaine (me/, admin/, vault/)
│   │   ├── core/                     # Config, security, encryption
│   │   ├── models/                   # SQLAlchemy / Pydantic models
│   │   ├── services/                 # Business logic
│   │   └── tests/                    # Tests unitaires & intégration
│   ├── Dockerfile
│   ├── requirements.txt
│   └── alembic/                      # Migrations DB
├── frontend/
│   ├── src/
│   │   ├── components/               # Composants DSFR
│   │   ├── pages/                    # Vues (coffre, admin, guide)
│   │   ├── services/                 # API client
│   │   └── assets/
│   ├── Dockerfile
│   └── package.json
├── sdk/
│   ├── myvault_client/
│   │   ├── __init__.py
│   │   ├── client.py
│   │   ├── exceptions.py
│   │   └── models.py
│   ├── setup.py
│   └── tests/
├── browser-extension/
│   ├── manifest.json                 # Manifest V3 (Chrome + Firefox)
│   ├── background.js                 # Service worker
│   ├── popup/                        # Panneau popup DSFR
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── content/                      # Content scripts (overlay in-page)
│   │   ├── content.js
│   │   ├── content.css
│   │   └── overlay.js
│   ├── icons/
│   ├── _locales/fr/messages.json     # i18n
│   ├── README.md
│   └── tests/
├── widget/
│   ├── loader.js                     # Widget overlay embarquable
│   ├── widget.html                   # Template du panneau flottant
│   └── widget.css                    # Styles isolés (Shadow DOM)
├── docs/
│   ├── README.md                     # → Copie/lien du README racine
│   ├── ARCHITECTURE.md               # Document d'architecture technique
│   ├── FUNCTIONAL_SPEC.md            # Documentation fonctionnelle
│   ├── USER_GUIDE.md                 # Guide utilisateur (source du guide in-app)
│   ├── INTEGRATION_GUIDE.md          # Guide d'intégration pour les tools
│   ├── API_REFERENCE.md              # Référence API (auto-générée depuis OpenAPI)
│   └── assets/                       # Schémas, captures d'écran
│       ├── architecture-overview.png
│       ├── user-flow.png
│       └── screenshots/
├── deploy/
│   ├── docker/
│   │   └── docker-compose.yml        # Déploiement local complet
│   ├── k8s/
│   │   ├── kustomization.yaml
│   │   ├── base/                     # Manifestes de base
│   │   └── overlays/
│   │       ├── dev/
│   │       └── prod-scaleway/        # Overlay Scaleway avec ingress myvault.fake-domain.name
│   └── helm/                         # (optionnel) chart Helm
├── tests/
│   ├── manual/
│   │   ├── TEST_PLAN.md              # Plan de tests manuels pour un humain
│   │   ├── CHECKLIST.md              # Checklist exécutable (cases à cocher)
│   │   └── REPORT_TEMPLATE.md        # Template de rapport de test
│   ├── e2e/
│   │   ├── test_user_flow.py         # Parcours utilisateur complet (Playwright)
│   │   ├── test_admin_flow.py        # Parcours admin
│   │   ├── test_tool_integration.py  # Simulation tool OpenWebUI → MyVault
│   │   └── conftest.py
│   └── load/
│       └── locustfile.py             # Tests de charge
├── .gitignore
├── .env.example                      # Template des variables (JAMAIS de vraies valeurs)
├── LICENSE                           # Apache 2.0 ou MIT
├── README.md                         # Point d'entrée principal
├── CONTRIBUTING.md
├── CHANGELOG.md
└── Makefile                          # Raccourcis : make dev, make test, make deploy-local
```

### 9.3 `.gitignore`

Crée un `.gitignore` complet qui exclut :

```gitignore
# === Secrets & credentials — CRITIQUE ===
.env
.env.*
!.env.example
*.pem
*.key
*.crt
*.p12
*.jks
*secret*
*credential*
*password*
# Exclure tout fichier pouvant contenir des secrets
kubeconfig
kubeconfig.*
*.kubeconfig

# === Python ===
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
*.egg-info/
dist/
build/
.eggs/
*.egg
.pytest_cache/
.coverage
htmlcov/
.mypy_cache/
.ruff_cache/

# === Node / Frontend ===
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
dist/
build/
.next/
.nuxt/

# === macOS ===
.DS_Store
.AppleDouble
.LSOverride
._*
.Spotlight-V100
.Trashes
Icon?

# === IDE ===
.idea/
.vscode/
*.swp
*.swo
*~
.project
.settings/
.classpath

# === Docker ===
docker-compose.override.yml

# === Terraform / IaC ===
*.tfstate
*.tfstate.*
.terraform/

# === OS ===
Thumbs.db
ehthumbs.db
Desktop.ini

# === Rapports de test ===
test-results/
playwright-report/
allure-results/
coverage/
```

### 9.4 Vérification de sécurité pré-commit

Avant chaque commit et dans la CI, lancer une vérification qu'aucun secret n'a fuité :

```bash
# Installer gitleaks
# Scanner le repo
gitleaks detect --source . --verbose

# Scanner l'historique complet
gitleaks detect --source . --verbose --log-opts="--all"
```

Intégrer un **pre-commit hook** :

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

---

## Phase 10 — Documentation

### 10.1 README.md (racine)

Le README doit contenir dans cet ordre :

1. **Bannière / Logo** MyVault + badge CI + badge licence
2. **Pitch en 2 lignes** : ce qu'est MyVault, pour qui
3. **Démarrage rapide** (< 5 min) :
   ```bash
   git clone https://github.com/IA-Generative/myvault.git
   cd myvault
   cp .env.example .env
   make dev        # ou docker compose up
   # → http://localhost:8080
   ```
4. **Captures d'écran** : 2-3 screenshots de l'IHM (coffre utilisateur, admin, check_connection)
5. **Architecture en 1 schéma** (lien vers `docs/ARCHITECTURE.md`)
6. **Liens vers la doc** : fonctionnelle, technique, guide utilisateur, guide d'intégration
7. **Contribuer** (lien vers `CONTRIBUTING.md`)
8. **Licence**

### 10.2 Documentation fonctionnelle (`docs/FUNCTIONAL_SPEC.md`)

Document couvrant :

- **Vision produit** : pourquoi MyVault existe, problème résolu, personas (utilisateur agent, admin SDID, développeur tool)
- **Parcours utilisateur** : avec schéma de flux (Mermaid)
  - Première connexion → auto-provisionnement
  - Configuration d'un tool → saisie credentials → test connexion
  - Utilisation d'un tool sans credentials → redirection MyVault
- **Parcours administrateur** :
  - Création d'application (manuel + import JSON)
  - Monitoring des check_connection
  - Gestion des utilisateurs
- **Règles métier** :
  - Un utilisateur ne voit que ses propres secrets
  - Un admin ne voit JAMAIS les valeurs des secrets utilisateur
  - La désactivation d'une app empêche la lecture des credentials par les tools
  - L'auto-enrôlement ne crée l'app que si le client_id/secret est valide
- **Catalogue des types de variables** (reprendre le tableau Phase 2.2)
- **Format d'échange** : spécification du JSON d'import/export compatible Keycloak

### 10.3 Document d'architecture technique (`docs/ARCHITECTURE.md`)

Document couvrant :

- **Vue d'ensemble** : schéma C4 (Context → Container → Component)
- **Stack technique** : FastAPI, PostgreSQL, React/DSFR, Docker, K8s
- **Modèle de données** : diagramme ERD (Mermaid) + description des tables
- **Sécurité** :
  - Schéma de chiffrement (AES-256-GCM, HKDF, clé maître)
  - Flux d'authentification (OIDC user + client_credentials machine)
  - Matrice de permissions (qui accède à quoi)
  - Audit trail : structure des logs
- **API** : lien vers le schéma OpenAPI auto-généré (`/api/docs`)
- **Déploiement** :
  - Architecture Docker (docker-compose)
  - Architecture Kubernetes (schéma des pods, services, ingress)
  - Gestion des secrets de déploiement (Secret K8s, jamais en clair)
- **Décisions d'architecture** (ADR) :
  - ADR-001 : Choix du moteur de secret (OpenBao vs Infisical vs custom)
  - ADR-002 : Chiffrement applicatif vs chiffrement moteur
  - ADR-003 : Format Keycloak pour l'interopérabilité
- **Scalabilité & limites connues**

### 10.4 Guide utilisateur (`docs/USER_GUIDE.md` + in-app)

Le guide utilisateur doit être :
- **Rédigé dans `docs/USER_GUIDE.md`** en Markdown
- **Accessible dans l'application** via une route `/guide` qui rend le même contenu en HTML avec le DSFR
- **Lié dans le header de l'IHM** (icône ❓ ou lien "Aide")

Contenu :

1. **Première connexion** : que se passe-t-il quand je me connecte pour la première fois
2. **Mon coffre-fort** : comment naviguer dans mes applications
3. **Configurer un outil** :
   - Trouver l'application dans la liste
   - Saisir mes identifiants (avec captures d'écran)
   - Comprendre les champs masqués (toggle, copier)
   - Tester la connexion
4. **Activer / Désactiver un outil** : que se passe-t-il côté tool OpenWebUI
5. **Quand un outil me demande mes identifiants** : explication du flux de redirection
6. **Sécurité** : où sont stockés mes secrets, qui peut les voir (personne d'autre que moi)
7. **FAQ** :
   - "J'ai changé mon mot de passe sur le service externe, que faire ?"
   - "L'icône est rouge, que signifie-t-elle ?"
   - "Comment supprimer mes données ?"

---

## Phase 11 — Tests manuels pour un humain

### 11.1 Plan de tests (`tests/manual/TEST_PLAN.md`)

Ce plan est conçu pour être exécuté par un testeur humain. Chaque test a un identifiant, des prérequis, des étapes numérotées et un résultat attendu.

#### Catégorie A — Accès et authentification

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| A1 | Connexion SSO | Compte Keycloak actif | 1. Ouvrir myvault.fake-domain.name 2. Cliquer "Se connecter" 3. S'authentifier sur Keycloak | Redirigé vers le coffre-fort, nom affiché en haut à droite |
| A2 | Auto-provisionnement | Premier accès | 1. Se connecter avec un compte jamais utilisé | Coffre-fort vide affiché, aucune erreur |
| A3 | Déconnexion | Connecté | 1. Cliquer "Se déconnecter" 2. Tenter d'accéder à /api/v1/me/apps | Redirigé vers login, API retourne 401 |
| A4 | Accès admin refusé | Compte sans rôle admin | 1. Tenter d'accéder à /admin | Message "Accès non autorisé" ou redirection |

#### Catégorie B — Gestion des credentials utilisateur

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| B1 | Saisie d'un secret | App "Grist" créée par admin | 1. Ouvrir l'app Grist 2. Saisir une clé API 3. Sauvegarder | Confirmation visuelle, valeur masquée après sauvegarde |
| B2 | Toggle visibilité | Secret sauvegardé | 1. Cliquer l'icône œil | Valeur affichée en clair. Re-clic → masquée |
| B3 | Copier un secret | Secret sauvegardé | 1. Cliquer l'icône copier 2. Coller dans un éditeur texte | Toast "Copié ✓" affiché, valeur correcte collée |
| B4 | Saisie en clair | Champ secret vide | 1. Cliquer dans le champ 2. Taper une valeur | La valeur est visible pendant la saisie |
| B5 | Tous les types | App avec tous les types de variables | 1. Remplir chaque type (text, number, boolean, select, multi_select, secret, url, etc.) 2. Sauvegarder 3. Recharger la page | Toutes les valeurs correctement restituées |
| B6 | Activer/Désactiver | App avec credentials saisis | 1. Cliquer le toggle "Désactiver" 2. Vérifier via API /vault/{app}/user/{id} | Toggle visuel changé. API retourne 403 ou champ vide |
| B7 | Test connexion OK | Credentials valides saisis | 1. Cliquer "Tester la connexion" | Spinner → badge vert ✓ avec message de succès |
| B8 | Test connexion KO | Credentials invalides saisis | 1. Saisir un faux token 2. Cliquer "Tester la connexion" | Spinner → badge rouge ✗ avec message d'erreur |

#### Catégorie C — Administration

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| C1 | Créer une application | Rôle admin | 1. Aller dans Admin 2. Créer app "Test" avec 3 variables 3. Sauvegarder | App visible dans la liste admin et dans le coffre utilisateur |
| C2 | Import JSON Keycloak | Fichier JSON préparé | 1. Admin > Import 2. Charger le fichier JSON 3. Valider | Applications créées, variables correctement mappées |
| C3 | Export JSON | Applications existantes | 1. Admin > Export | Fichier JSON téléchargé, structure compatible Keycloak |
| C4 | Round-trip import/export | Export fait en C3 | 1. Supprimer les apps 2. Ré-importer le fichier exporté | État identique à avant la suppression |
| C5 | Admin ne voit pas les secrets | Users ont saisi des credentials | 1. Aller dans Admin > Utilisateurs 2. Consulter un utilisateur | Nombre de credentials visible, JAMAIS les valeurs |

#### Catégorie D — Intégration tool OpenWebUI

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| D1 | Auto-enrôlement | Tool configuré avec MYVAULT_APP | 1. Appeler le tool pour la première fois | App créée dans MyVault si inexistante |
| D2 | Credentials manquants | User sans credentials pour ce tool | 1. Utiliser le tool dans OpenWebUI | Message avec lien cliquable vers MyVault, lien fonctionne |
| D3 | Credentials invalides | User avec mauvais credentials | 1. Utiliser le tool | Message indiquant credentials invalides + lien mise à jour |
| D4 | Flux complet | Aucun prérequis | 1. Utiliser un tool neuf 2. Cliquer le lien MyVault 3. Saisir les credentials 4. Tester connexion 5. Réutiliser le tool | Le tool fonctionne après configuration |

#### Catégorie E — Sécurité

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| E1 | Isolation inter-utilisateur | 2 comptes avec credentials | 1. User A se connecte 2. Tenter d'accéder aux secrets de User B via API | 403 Forbidden |
| E2 | Token expiré | Token OIDC expiré | 1. Attendre expiration 2. Appeler l'API | 401 + redirect vers login |
| E3 | Client_secret invalide | Tool avec mauvais secret | 1. Appeler /vault/ avec un mauvais client_secret | 401 Unauthorized |
| E4 | Injection SQL | Connecté | 1. Saisir `'; DROP TABLE--` dans un champ texte | Valeur sauvegardée littéralement, aucune corruption |
| E5 | XSS | Connecté | 1. Saisir `<script>alert('xss')</script>` dans un label | Rendu échappé, pas d'exécution de script |

#### Catégorie F — IHM et accessibilité

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| F1 | Responsive mobile | Navigateur mobile ou DevTools | 1. Ouvrir MyVault en 375px de large | Interface utilisable, pas de scroll horizontal |
| F2 | Navigation clavier | — | 1. Tab à travers tous les éléments interactifs | Focus visible sur chaque élément, ordre logique |
| F3 | Guide utilisateur in-app | — | 1. Cliquer l'icône Aide / lien "Guide" | Guide affiché dans l'app avec le DSFR |
| F4 | DSFR conformité | — | 1. Vérifier visuellement les composants | Boutons, inputs, badges, alertes conformes au DSFR |

#### Catégorie G — Bridge et export/import

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| G1 | Page bridge accessible | App avec credentials saisis | 1. Ouvrir `/bridge/{app_slug}` | Page affichée avec toutes les variables, secrets masqués |
| G2 | Export JSON | Credentials saisis | 1. Cliquer "Copier au format JSON" 2. Coller dans un éditeur | JSON valide avec les bonnes clés/valeurs |
| G3 | Export .env | Credentials saisis | 1. Cliquer "Copier en .env" 2. Coller | Format KEY=VALUE correct, une variable par ligne |
| G4 | Import .env | Page bridge ouverte | 1. Cliquer "Coller un .env" 2. Coller un bloc KEY=VALUE 3. Valider | Variables pré-remplies correctement, mapping des alias appliqué |
| G5 | Import JSON | Page bridge ouverte | 1. Coller un JSON de config 2. Valider | Variables mappées et pré-remplies |
| G6 | Copier individuel | Variable affichée sur bridge | 1. Cliquer 📋 à côté d'une variable | Toast "Copié ✓", valeur correcte dans le clipboard |
| G7 | Deep-link avec source | — | 1. Ouvrir `/bridge/{slug}?source=openwebui` | Wording adapté à OpenWebUI, format d'export par défaut ajusté |

#### Catégorie H — Widget overlay et extension navigateur

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| H1 | Widget loader.js | App tierce avec le script intégré | 1. Charger la page de l'app 2. Vérifier le bouton 🔐 | Bouton flottant visible en bas à droite |
| H2 | Panneau overlay | Widget chargé | 1. Cliquer le bouton 🔐 | Panneau glissant avec les credentials, secrets masqués |
| H3 | Isolation CSS | Widget sur app tierce | 1. Vérifier que le CSS du widget n'affecte pas l'app hôte | Styles de l'app inchangés, widget correctement stylé (Shadow DOM) |
| H4 | Extension — détection | Extension installée, naviguer sur grist.numerique.gouv.fr | 1. Vérifier l'icône de l'extension | Badge actif, icône colorée indiquant une app détectée |
| H5 | Extension — popup | Extension avec app détectée | 1. Cliquer l'icône de l'extension | Popup avec credentials de l'app détectée |
| H6 | Extension — copier | Popup ouverte | 1. Cliquer 📋 sur une variable | Toast "Copié ✓" dans le popup |
| H7 | Extension — aucun secret local | Extension installée | 1. Inspecter chrome.storage.local / browser.storage.local | Aucune valeur de secret stockée, uniquement des préférences |
| H8 | Extension — auto-fill | Option activée dans les paramètres | 1. Naviguer sur une app avec formulaire de config 2. Accepter le remplissage | Confirmation demandée, champs remplis correctement après validation |

### 11.2 Checklist exécutable (`tests/manual/CHECKLIST.md`)

```markdown
# MyVault — Checklist de tests manuels

**Testeur** : _______________
**Date** : _______________
**Environnement** : [ ] Docker local  [ ] K8s Scaleway
**Version** : _______________

## A — Authentification
- [ ] A1 — Connexion SSO : _____ (OK / KO / N/A)
- [ ] A2 — Auto-provisionnement : _____
- [ ] A3 — Déconnexion : _____
- [ ] A4 — Accès admin refusé : _____

## B — Credentials utilisateur
- [ ] B1 — Saisie d'un secret : _____
- [ ] B2 — Toggle visibilité : _____
- [ ] B3 — Copier un secret : _____
- [ ] B4 — Saisie en clair : _____
- [ ] B5 — Tous les types : _____
- [ ] B6 — Activer/Désactiver : _____
- [ ] B7 — Test connexion OK : _____
- [ ] B8 — Test connexion KO : _____

## C — Administration
- [ ] C1 — Créer une application : _____
- [ ] C2 — Import JSON : _____
- [ ] C3 — Export JSON : _____
- [ ] C4 — Round-trip : _____
- [ ] C5 — Admin ne voit pas les secrets : _____

## D — Intégration OpenWebUI
- [ ] D1 — Auto-enrôlement : _____
- [ ] D2 — Credentials manquants : _____
- [ ] D3 — Credentials invalides : _____
- [ ] D4 — Flux complet : _____

## E — Sécurité
- [ ] E1 — Isolation inter-utilisateur : _____
- [ ] E2 — Token expiré : _____
- [ ] E3 — Client_secret invalide : _____
- [ ] E4 — Injection SQL : _____
- [ ] E5 — XSS : _____

## F — IHM
- [ ] F1 — Responsive : _____
- [ ] F2 — Navigation clavier : _____
- [ ] F3 — Guide in-app : _____
- [ ] F4 — DSFR conformité : _____

## G — Bridge et export/import
- [ ] G1 — Page bridge accessible : _____
- [ ] G2 — Export JSON : _____
- [ ] G3 — Export .env : _____
- [ ] G4 — Import .env : _____
- [ ] G5 — Import JSON : _____
- [ ] G6 — Copier individuel : _____
- [ ] G7 — Deep-link avec source : _____

## H — Widget overlay et extension
- [ ] H1 — Widget loader.js : _____
- [ ] H2 — Panneau overlay : _____
- [ ] H3 — Isolation CSS : _____
- [ ] H4 — Extension détection : _____
- [ ] H5 — Extension popup : _____
- [ ] H6 — Extension copier : _____
- [ ] H7 — Aucun secret local : _____
- [ ] H8 — Extension auto-fill : _____

## Résumé
- Total : __ / 45
- Bloquants : _____
- Remarques : _____
```

### 11.3 Rapport de tests (`tests/manual/REPORT_TEMPLATE.md`)

```markdown
# Rapport de tests MyVault

## Informations générales
| Champ | Valeur |
|-------|--------|
| Date | |
| Testeur | |
| Version | |
| Environnement | |
| Commit SHA | |

## Synthèse

| Catégorie | Passés | Échoués | Bloqués | Total |
|-----------|--------|---------|---------|-------|
| A — Auth | | | | 4 |
| B — Credentials | | | | 8 |
| C — Admin | | | | 5 |
| D — Intégration | | | | 4 |
| E — Sécurité | | | | 5 |
| F — IHM | | | | 4 |
| G — Bridge | | | | 7 |
| H — Widget & Extension | | | | 8 |
| **Total** | | | | **45** |

## Détail des tests échoués

### [ID] — [Nom du test]
- **Résultat observé** :
- **Résultat attendu** :
- **Capture d'écran** :
- **Sévérité** : Bloquant / Majeur / Mineur
- **Remarques** :

## Recommandations

1.
2.

## Conclusion

[ ] ✅ Livrable validé — prêt pour déploiement production
[ ] ⚠️ Validé avec réserves — voir recommandations
[ ] ❌ Non validé — corrections requises avant redéploiement
```

---

## Ordre d'exécution recommandé

1. **Initialisation repo** : créer le repo GitHub, `.gitignore`, structure de dossiers, README squelette (Phase 9) — ~30 min
2. **Évaluation technique** : choisir le moteur de secrets (Phase 1) — ~30 min
3. **Backend API** : modèle de données + endpoints + bridge API (Phases 2 + 8bis.2) — ~5h
4. **Frontend DSFR** : IHM utilisateur, admin et page bridge (Phases 3 + 8bis.1) — ~5h
5. **SDK Python** : `myvault-client` (Phase 4) — ~2h
6. **Widget overlay** : loader.js + panneau flottant (Phase 8ter.2) — ~2h
7. **Sécurité** : chiffrement, audit (Phase 5) — ~2h
8. **Docker local** : docker-compose + smoke test (Phase 6.1) — ~1h
9. **Tests automatisés** : unitaires + intégration + e2e (Phase 7) — ~2h
10. **Documentation** : README, archi, fonctionnel, guide utilisateur, guide in-app (Phase 10) — ~3h
11. **Tests manuels** : exécuter la checklist, produire le rapport (Phase 11) — ~2h
12. **Scan de sécurité** : gitleaks sur l'historique complet, vérifier `.gitignore` — ~30 min
13. **K8s Scaleway** : déploiement production (Phase 6.2) — ~2h
14. **Prompt d'intégration tools** : template réutilisable (Phase 8) — ~1h
15. **Prompt extension navigateur** : prompt autonome pour le plugin (Phase 8quater) — ~1h
16. **Commit final** : CHANGELOG, tag de version, release GitHub — ~30 min
