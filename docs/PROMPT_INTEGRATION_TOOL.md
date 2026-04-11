# Prompt d'intégration MyVault pour tools OpenWebUI

> Ce prompt est destiné à un coding assistant pour adapter un tool/filter/pipe OpenWebUI existant à MyVault.

---

## Contexte

MyVault est un coffre-fort de credentials utilisateur. Chaque tool OpenWebUI qui nécessite des identifiants utilisateur (clés API, tokens, mots de passe) doit s'intégrer avec MyVault plutôt que de demander les credentials en dur ou via des variables d'environnement par utilisateur.

## Instructions

Adapte le tool OpenWebUI suivant pour utiliser MyVault en suivant ces étapes :

### 1. Ajouter la dépendance

```python
from myvault_client import MyVaultClient, CredentialsMissing, AppConfig, VariableSpec
```

### 2. Déclarer la configuration d'auto-enrôlement

Ajoute un attribut `MYVAULT_APP` à la classe du tool avec :
- `client_id` : identifiant unique du tool (format `myvault-{nom-du-tool}`)
- `client_secret` : lu depuis une variable d'environnement (secret K8s)
- `name` : nom lisible de l'application
- `variables` : liste des variables nécessaires avec leur type

```python
MYVAULT_APP = AppConfig(
    client_id="myvault-{NOM_DU_TOOL}",
    client_secret=os.environ.get("MYVAULT_{NOM_DU_TOOL}_SECRET", ""),
    name="{Nom lisible du tool}",
    variables=[
        VariableSpec(key="{clé}", label="{Libellé}", type="{type}", required=True),
        # Types disponibles : secret, api_key, password, oauth_token, login,
        #                      certificate, text, url, email, number, boolean,
        #                      select, multi_select, textarea, json
    ],
)
```

### 3. Récupérer les credentials dans run()

Remplace la récupération des credentials existante par :

```python
async def run(self, user_id: str, **kwargs):
    vault = MyVaultClient()

    try:
        creds = await vault.get_credentials(
            app_id=self.MYVAULT_APP.client_id,
            user_id=user_id,
        )
    except CredentialsMissing:
        await vault.ensure_enrolled(self.MYVAULT_APP)
        slug = self.MYVAULT_APP.client_id.replace("myvault-", "").replace("_", "-")
        return vault.credentials_required_response(slug, self.MYVAULT_APP.name)

    # Utilise creds["clé"] au lieu des anciennes variables
    api_key = creds["api_key"]
    server_url = creds.get("server_url", "https://default.url")
    # ... reste de la logique du tool
```

### 4. Ajouter l'interface check_connection

```python
@staticmethod
async def check_connection(credentials: dict) -> dict:
    """Endpoint normalisé appelé par MyVault pour tester la connexion."""
    try:
        # Adapte cet appel au service cible
        import httpx
        resp = await httpx.AsyncClient().get(
            f"{credentials['server_url']}/api/health",
            headers={"Authorization": f"Bearer {credentials['api_key']}"},
        )
        resp.raise_for_status()
        return {"status": "ok", "detail": "Connexion réussie"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
```

### 5. Configurer les variables d'environnement

Ajoute au déploiement (Secret K8s ou .env) :

```yaml
MYVAULT_URL: https://myvault.example.com
MYVAULT_CLIENT_ID: myvault-{nom-du-tool}
MYVAULT_CLIENT_SECRET: {secret généré}
```

### 6. Vérification

- [ ] Le tool s'auto-enrôle dans MyVault au premier appel
- [ ] Si l'utilisateur n'a pas de credentials → message avec lien MyVault
- [ ] Si l'utilisateur a des credentials → le tool fonctionne normalement
- [ ] Le check_connection retourne `{"status": "ok"}` ou `{"status": "error"}`
- [ ] Aucun credential n'est stocké dans le code ou les logs du tool
