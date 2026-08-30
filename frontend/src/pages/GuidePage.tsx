/**
 * In-app user guide rendered with DSFR components.
 */

export default function GuidePage() {
  return (
    <>
      <h1>Guide utilisateur</h1>

      <nav className="fr-summary" role="navigation" aria-label="Sommaire">
        <ol className="fr-summary__list">
          <li><a className="fr-summary__link" href="#premiere-connexion">Première connexion</a></li>
          <li><a className="fr-summary__link" href="#mon-coffre">Mon coffre-fort</a></li>
          <li><a className="fr-summary__link" href="#configurer-outil">Configurer un outil</a></li>
          <li><a className="fr-summary__link" href="#activer-desactiver">Activer / Désactiver un outil</a></li>
          <li><a className="fr-summary__link" href="#redirection">Quand un outil me demande mes identifiants</a></li>
          <li><a className="fr-summary__link" href="#automatisation">Autoriser une application à agir en mon nom</a></li>
          <li><a className="fr-summary__link" href="#securite">Sécurité</a></li>
          <li><a className="fr-summary__link" href="#faq">FAQ</a></li>
        </ol>
      </nav>

      <section id="premiere-connexion" className="fr-mt-4w">
        <h2>Première connexion</h2>
        <p>
          Lorsque vous vous connectez à MyVault pour la première fois via votre compte SSO (Keycloak),
          votre espace personnel est automatiquement créé. Vous arrivez sur la page
          « Mon coffre-fort » qui affiche la liste des applications disponibles.
        </p>
        <div className="fr-callout">
          <p className="fr-callout__text">
            Aucune configuration préalable n'est nécessaire : votre compte est automatiquement
            provisionné dès votre première connexion.
          </p>
        </div>
      </section>

      <section id="mon-coffre" className="fr-mt-4w">
        <h2>Mon coffre-fort</h2>
        <p>
          La page principale affiche toutes les applications auxquelles vous pouvez connecter
          vos identifiants. Chaque carte d'application affiche :
        </p>
        <ul>
          <li><strong>Un badge d'état</strong> : Non configuré, Actif, Désactivé, Erreur, ou Non testé</li>
          <li><strong>Le nombre de variables</strong> requises par l'application</li>
          <li><strong>Un lien</strong> vers la page de configuration de vos identifiants</li>
        </ul>
      </section>

      <section id="configurer-outil" className="fr-mt-4w">
        <h2>Configurer un outil</h2>
        <ol>
          <li>Cliquez sur l'application dans la liste</li>
          <li>Remplissez les champs demandés (clé API, URL, etc.)</li>
          <li>
            Les <strong>champs secrets</strong> sont masqués par défaut (affichés sous forme de points).
            Utilisez l'icône <strong>oeil</strong> pour voir la valeur et l'icône <strong>copier</strong> pour
            la copier dans le presse-papier.
          </li>
          <li>Cliquez sur <strong>Sauvegarder</strong></li>
          <li>
            Si un endpoint de vérification est configuré, cliquez sur <strong>Tester la connexion</strong>
            pour vérifier que vos identifiants fonctionnent.
          </li>
        </ol>
      </section>

      <section id="activer-desactiver" className="fr-mt-4w">
        <h2>Activer / Désactiver un outil</h2>
        <p>
          Chaque application dispose d'un interrupteur pour l'activer ou la désactiver.
          Lorsqu'une application est <strong>désactivée</strong>, ses identifiants ne sont
          plus accessibles par les outils (tools OpenWebUI, etc.), mais ils restent
          stockés en sécurité dans votre coffre-fort.
        </p>
      </section>

      <section id="redirection" className="fr-mt-4w">
        <h2>Quand un outil me demande mes identifiants</h2>
        <p>
          Si vous utilisez un outil dans OpenWebUI (ou une autre application) qui nécessite
          des identifiants que vous n'avez pas encore configurés, l'outil vous affichera un
          message avec un <strong>lien direct vers MyVault</strong>.
        </p>
        <p>
          Cliquez sur ce lien, configurez vos identifiants, puis réutilisez l'outil :
          il fonctionnera immédiatement.
        </p>
      </section>

      <section id="automatisation" className="fr-mt-4w">
        <h2>Autoriser une application à agir en mon nom</h2>
        <p>
          C'est la raison d'être du coffre-fort : vous <strong>autorisez une application à
          se servir de vos identifiants</strong> pour des travaux d'automatisation, sans
          jamais les lui recopier vous-même.
        </p>
        <p>
          Concrètement, une fois vos accès renseignés et l'application <strong>activée</strong>,
          il suffit de le demander en toutes lettres à <strong>Mon assistant</strong> ou
          à <strong>Mes agents</strong> — par exemple « ouvre-moi une <em>issue</em> sur tel
          dépôt GitHub », « dépose ce compte rendu dans Résana », « poste ce message dans
          le salon Tchap de l'équipe ». L'outil sollicité vient chercher vos identifiants
          dans le coffre au moment où il en a besoin, agit en votre nom, et rien n'est
          recopié dans la conversation.
        </p>
        <div className="fr-callout">
          <p className="fr-callout__text">
            Toutes les applications ne le proposent pas encore : seules celles dont un outil
            a été branché sur le coffre savent le faire. Les autres restent utiles pour
            garder vos accès sous la main et ouvrir l'application avec vos identifiants
            affichés.
          </p>
        </div>
        <ul>
          <li>Vous gardez la main : l'<strong>interrupteur</strong> de chaque application coupe l'accès des outils, immédiatement</li>
          <li>Chaque lecture de vos secrets est <strong>tracée</strong> dans le journal d'audit</li>
          <li>Une application ne peut lire que <strong>ses</strong> variables, jamais celles d'une autre</li>
        </ul>
      </section>

      <section id="securite" className="fr-mt-4w">
        <h2>Sécurité</h2>
        <div className="fr-callout fr-callout--green-emeraude">
          <h3 className="fr-callout__title">Vos secrets sont protégés</h3>
          <p className="fr-callout__text">
            Tous les champs sensibles (clés API, mots de passe, tokens) sont chiffrés
            avec l'algorithme <strong>AES-256-GCM</strong> et une clé unique dérivée
            pour chaque utilisateur. Personne d'autre que vous ne peut lire vos secrets,
            pas même les administrateurs de la plateforme.
          </p>
        </div>
        <p>
          <strong>AES-256-GCM</strong> est le mode de chiffrement le plus solide dont on
          dispose aujourd'hui. Deux choses le distinguent : une clé de <strong>256 bits</strong>,
          hors de portée de la force brute, et surtout un chiffrement <strong>authentifié</strong> —
          il ne se contente pas de rendre le secret illisible, il <em>détecte</em> la moindre
          altération et refuse alors de le déchiffrer. C'est le mode qu'emploient les
          standards actuels, à commencer par TLS 1.3, qui protège votre connexion à cette
          page.{" "}
          <a
            className="fr-link"
            href="https://fr.wikipedia.org/wiki/Mode_d%27op%C3%A9ration_(cryptographie)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Comprendre les modes de chiffrement (Wikipédia)
          </a>
        </p>
        <ul>
          <li>Le chiffrement utilise une clé dérivée par utilisateur (HKDF-SHA256)</li>
          <li>Les communications sont protégées par TLS 1.3</li>
          <li>Chaque accès à un secret est enregistré dans un journal d'audit</li>
          <li>Les administrateurs ne voient jamais la valeur de vos secrets</li>
        </ul>
      </section>

      <section id="faq" className="fr-mt-4w">
        <h2>Questions fréquentes</h2>

        <div className="fr-accordions-group">
          <section className="fr-accordion">
            <h3 className="fr-accordion__title">
              <button className="fr-accordion__btn" aria-expanded="false" aria-controls="faq-1">
                J'ai changé mon mot de passe sur le service externe, que faire ?
              </button>
            </h3>
            <div className="fr-collapse" id="faq-1">
              <p>
                Rendez-vous sur la page de l'application concernée dans MyVault,
                modifiez le champ correspondant, et sauvegardez. Vous pouvez ensuite
                tester la connexion pour vérifier.
              </p>
            </div>
          </section>

          <section className="fr-accordion">
            <h3 className="fr-accordion__title">
              <button className="fr-accordion__btn" aria-expanded="false" aria-controls="faq-2">
                Le badge est rouge, que signifie-t-il ?
              </button>
            </h3>
            <div className="fr-collapse" id="faq-2">
              <p>
                Un badge rouge indique que le dernier test de connexion a échoué.
                Vérifiez que vos identifiants sont toujours valides et relancez
                un test de connexion.
              </p>
            </div>
          </section>

          <section className="fr-accordion">
            <h3 className="fr-accordion__title">
              <button className="fr-accordion__btn" aria-expanded="false" aria-controls="faq-3">
                Comment supprimer mes données ?
              </button>
            </h3>
            <div className="fr-collapse" id="faq-3">
              <p>
                Vous pouvez supprimer vos identifiants pour chaque application en vidant
                les champs et en sauvegardant. Pour une suppression complète de votre
                compte, contactez l'administrateur de la plateforme.
              </p>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
