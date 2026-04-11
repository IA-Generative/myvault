/**
 * Sample applications for quick setup.
 * These can be imported by an admin to bootstrap the vault.
 */

export const sampleApps = {
  clients: [
    {
      clientId: "myvault-grist-tool",
      name: "Grist Connector",
      secret: "",
      enabled: true,
      protocol: "openid-connect",
      attributes: {
        "myvault.icon_url": "https://www.getgrist.com/wp-content/uploads/2023/09/favicon.ico",
        "myvault.variables": JSON.stringify([
          { key: "api_token", label: "Clé API Grist", type: "api_key", required: true, description: "Token d'accès personnel Grist" },
          { key: "server_url", label: "URL du serveur Grist", type: "url", required: true, default: "https://grist.numerique.gouv.fr" },
          { key: "doc_id", label: "Identifiant du document", type: "text", required: false, description: "ID du document Grist (visible dans l'URL)" },
        ]),
        "myvault.check_endpoint": "",
      },
    },
    {
      clientId: "myvault-tchap-bot",
      name: "Tchap",
      secret: "",
      enabled: true,
      protocol: "openid-connect",
      attributes: {
        "myvault.icon_url": "https://tchap.gouv.fr/favicon.ico",
        "myvault.variables": JSON.stringify([
          { key: "homeserver_url", label: "URL du homeserver Matrix", type: "url", required: true, default: "https://matrix.agent.tchap.gouv.fr" },
          { key: "access_token", label: "Token d'accès Matrix", type: "oauth_token", required: true, description: "Token obtenu via /login sur le homeserver" },
          { key: "room_id", label: "ID du salon par défaut", type: "text", required: false, description: "Format : !xxxxx:agent.tchap.gouv.fr" },
        ]),
        "myvault.check_endpoint": "",
      },
    },
    {
      clientId: "myvault-github-tool",
      name: "GitHub",
      secret: "",
      enabled: true,
      protocol: "openid-connect",
      attributes: {
        "myvault.icon_url": "https://github.githubassets.com/favicons/favicon-dark.svg",
        "myvault.variables": JSON.stringify([
          { key: "github_token", label: "Personal Access Token (PAT)", type: "api_key", required: true, description: "Token GitHub (format github_pat_... ou ghp_...) avec les scopes repo, project, read:org" },
          { key: "github_org", label: "Organisation GitHub", type: "text", required: false, description: "Nom de l'organisation (ex : IA-Generative)" },
          { key: "github_api_url", label: "URL API GitHub", type: "url", required: false, default: "https://api.github.com", description: "Modifier pour GitHub Enterprise" },
        ]),
        "myvault.check_endpoint": "",
      },
    },
    {
      clientId: "myvault-iobeya-tool",
      name: "iObeya",
      secret: "",
      enabled: true,
      protocol: "openid-connect",
      attributes: {
        "myvault.icon_url": "https://www.iobeya.com/favicon.ico",
        "myvault.variables": JSON.stringify([
          { key: "iobeya_token", label: "Token JWT iObeya", type: "api_key", required: true, description: "Token d'authentification JWT pour l'API iObeya" },
          { key: "iobeya_base_url", label: "URL de l'instance iObeya", type: "url", required: true, default: "https://iobeya.numerique-interieur.com", description: "URL de base de votre instance iObeya" },
          { key: "iobeya_room_id", label: "ID de la room", type: "text", required: true, description: "UUID de la room iObeya (visible dans l'URL)" },
          { key: "iobeya_type_feature_card", label: "Type de carte Feature", type: "text", required: false, default: "Feature" },
          { key: "iobeya_type_epic_card", label: "Type de carte Epic", type: "text", required: false, default: "Epic" },
        ]),
        "myvault.check_endpoint": "",
      },
    },
    {
      clientId: "myvault-mattermost-tool",
      name: "Mattermost",
      secret: "",
      enabled: true,
      protocol: "openid-connect",
      attributes: {
        "myvault.icon_url": "https://developers.mattermost.com/img/favicon.ico",
        "myvault.variables": JSON.stringify([
          { key: "mattermost_url", label: "URL du serveur", type: "url", required: true, description: "URL de votre instance Mattermost" },
          { key: "mattermost_bot_token", label: "Token du bot", type: "api_key", required: true, description: "Personal Access Token du bot Mattermost" },
          { key: "mattermost_channel_id", label: "ID du canal par défaut", type: "text", required: false, description: "ID du canal pour les notifications" },
        ]),
        "myvault.check_endpoint": "",
      },
    },
  ],
};
