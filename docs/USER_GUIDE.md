# Guide utilisateur — MyVault

## Première connexion

Lorsque vous vous connectez à MyVault pour la première fois via votre compte SSO (Keycloak), votre espace personnel est automatiquement créé. Vous arrivez sur la page « Mon coffre-fort » qui affiche la liste des applications disponibles.

Aucune configuration préalable n'est nécessaire.

## Mon coffre-fort

La page principale affiche toutes les applications auxquelles vous pouvez connecter vos identifiants. Chaque carte affiche :

- **Un badge d'état** : Non configuré, Actif, Désactivé, Erreur, ou Non testé
- **Le nombre de variables** requises
- **Un lien** vers la page de configuration

## Configurer un outil

1. Cliquez sur l'application dans la liste
2. Remplissez les champs demandés (clé API, URL, etc.)
3. Les **champs secrets** sont masqués par défaut. Utilisez l'icône **oeil** pour voir la valeur et l'icône **copier** pour la copier dans le presse-papier
4. Cliquez sur **Sauvegarder**
5. Si disponible, cliquez sur **Tester la connexion** pour vérifier

## Activer / Désactiver un outil

Chaque application dispose d'un interrupteur. Lorsqu'une application est **désactivée**, ses identifiants ne sont plus accessibles par les outils, mais restent stockés dans votre coffre-fort.

## Quand un outil me demande mes identifiants

Si vous utilisez un outil dans OpenWebUI qui nécessite des identifiants non configurés, l'outil vous affichera un message avec un **lien direct vers MyVault**.

Cliquez sur ce lien, configurez vos identifiants, puis réutilisez l'outil.

## Pont de configuration (Bridge)

La page Bridge (`/bridge/{app}`) permet de :
- **Exporter** vos variables au format JSON, .env ou YAML
- **Importer** des variables depuis un autre format
- **Copier individuellement** chaque variable

## Sécurité

Tous les champs sensibles sont chiffrés avec **AES-256-GCM** et une clé unique par utilisateur. Personne d'autre que vous ne peut lire vos secrets, pas même les administrateurs.

- Chiffrement par clé dérivée par utilisateur (HKDF-SHA256)
- Communications protégées par TLS 1.3
- Chaque accès enregistré dans un journal d'audit
- Les administrateurs ne voient jamais vos valeurs

## FAQ

**J'ai changé mon mot de passe sur le service externe, que faire ?**
Rendez-vous sur la page de l'application dans MyVault, modifiez le champ, sauvegardez, et testez la connexion.

**Le badge est rouge, que signifie-t-il ?**
Le dernier test de connexion a échoué. Vérifiez vos identifiants et relancez un test.

**Comment supprimer mes données ?**
Videz les champs et sauvegardez. Pour une suppression complète, contactez l'administrateur.
