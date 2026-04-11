# Guide d'intégration — MyVault

Ce guide explique comment intégrer MyVault dans un tool OpenWebUI ou toute application Python.

## Prérequis : configurer Keycloak

Le client `myvault` est **déjà défini** dans le realm `openwebui` d'owuicore-main (`keycloak/realm-openwebui.json`). Il inclut :
- Client ID : `myvault` (confidentiel)
- Redirect URIs : `https://myvault.example.com/*`, `http://localhost:8085/*`
- Protocol mapper `myvault-client-roles` qui expose les rôles client dans `resource_access.myvault.roles`

Si vous démarrez avec le docker-compose d'owuicore-main, Keycloak est déjà configuré sur `http://localhost:8082` avec le realm `openwebui`.

Si vous utilisez un Keycloak indépendant, importez [`docs/keycloak-client-myvault.json`](keycloak-client-myvault.json) via **Clients > Import client**, puis :
1. Adapter les `redirectUris` et `webOrigins` à votre domaine
2. Noter le **Client Secret** généré
3. Créer le rôle client `myvault-admin` et l'attribuer aux administrateurs
4. Reporter les valeurs dans le `.env` :
   ```bash
   OIDC_ISSUER_URL=http://localhost:8082/realms/openwebui
   OIDC_CLIENT_ID=myvault
   OIDC_CLIENT_SECRET=<secret généré par Keycloak>
   ```

## Prérequis : importer des applications dans MyVault

Un fichier d'exemple avec 5 applications (Grist, Tchap, GitHub, Mattermost, LinkedIn) est fourni :

1. Se connecter à MyVault en tant qu'administrateur
2. Aller dans **Administration > Importer (JSON)**
3. Charger le fichier [`docs/sample-apps-import.json`](sample-apps-import.json)
4. Les applications apparaissent dans le coffre-fort de tous les utilisateurs

Ce fichier utilise le format Keycloak `clients` pour l'interopérabilité. Les champs `secret` vides sont auto-générés à l'import.

## Installation du SDK

```bash
pip install -e ./sdk
# ou depuis PyPI (quand publié) :
# pip install myvault-client
```

## Variables d'environnement

```bash
MYVAULT_URL=https://myvault.example.com
MYVAULT_CLIENT_ID=myvault-mon-tool
MYVAULT_CLIENT_SECRET=secret-du-tool
```

## Utilisation dans un tool OpenWebUI

```python
from myvault_client import MyVaultClient, CredentialsMissing, AppConfig, VariableSpec

class MonGristTool:
    # Configuration pour l'auto-enrôlement
    MYVAULT_APP = AppConfig(
        client_id="myvault-grist-tool",
        client_secret="${MYVAULT_GRIST_SECRET}",
        name="Grist Connector",
        variables=[
            VariableSpec(key="api_token", label="Clé API Grist", type="api_key", required=True),
            VariableSpec(key="server_url", label="URL serveur", type="url", default="https://grist.numerique.gouv.fr"),
        ],
    )

    async def run(self, user_id: str, **kwargs):
        vault = MyVaultClient()

        try:
            creds = await vault.get_credentials(
                app_id="myvault-grist-tool",
                user_id=user_id,
            )
        except CredentialsMissing:
            # Auto-enrôlement si nécessaire
            await vault.ensure_enrolled(self.MYVAULT_APP)
            # Retourner un message avec lien de configuration
            return vault.credentials_required_response(
                "grist-connector", "Grist"
            )

        # Utilisation normale
        return await self.query_grist(creds["api_token"], creds["server_url"])

    @staticmethod
    async def check_connection(credentials: dict) -> dict:
        """Endpoint normalisé pour tester la connexion."""
        import httpx
        try:
            resp = httpx.get(
                f"{credentials['server_url']}/api/orgs",
                headers={"Authorization": f"Bearer {credentials['api_token']}"},
            )
            return {"status": "ok", "detail": f"{len(resp.json())} orgs accessibles"}
        except Exception as e:
            return {"status": "error", "detail": str(e)}
```

## Interface check_connection

Chaque tool peut exposer un endpoint de vérification retournant :

```json
{"status": "ok", "detail": "5 orgs accessibles"}
// ou
{"status": "error", "detail": "401 Unauthorized"}
```

## Widget embarquable

Pour intégrer le widget MyVault dans une application tierce :

```html
<script src="https://myvault.example.com/widget/loader.js"
        data-app="grist-connector"
        data-position="bottom-right"
        data-theme="dsfr">
</script>
```

Le widget affiche un bouton flottant qui ouvre un panneau avec les credentials de l'utilisateur.

## API machine-to-machine

Les tools accèdent aux credentials via des headers d'authentification :

```bash
# Lire les credentials d'un utilisateur
curl -H "X-Client-Id: myvault-mon-tool" \
     -H "X-Client-Secret: secret123" \
     https://myvault.example.com/api/v1/vault/grist-connector/user/user-001

# Auto-enrôlement
curl -X POST https://myvault.example.com/api/v1/apps/enroll \
     -H "Content-Type: application/json" \
     -d '{"client_id": "myvault-mon-tool", "client_secret": "secret123", "name": "Mon Tool"}'

# Vérifier si un utilisateur a des credentials
curl -H "X-Client-Id: myvault-mon-tool" \
     -H "X-Client-Secret: secret123" \
     https://myvault.example.com/api/v1/apps/grist-connector/check/user-001
```

## Flux d'interaction complet

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
    │ trouvés?│       + lien vers myvault/app/grist-connector
    └────┬────┘
         │ Oui
         ▼
    Appel API Grist avec les credentials
         │
         ▼
    Réponse à l'utilisateur
```
