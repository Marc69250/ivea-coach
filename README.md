# Ivea Coach

CRM personnel pour suivre ta recherche d'emploi, ton réseau et ta prospection — pensé pour être utilisé au quotidien depuis ton iPhone.

## Fonctionnalités

- **Pipeline** : suivi des candidatures (poste, entreprise, statut, source, lien, salaire visé) et des dossiers de prospection (client, budget, statut), avec un historique par entrée.
- **Contacts** : carnet réseau (comment rencontré, coordonnées, LinkedIn, statut de la relation), reliable à une candidature ou un prospect.
- **Relances** : chaque candidature/contact peut porter une date de relance. La vue *Relances* regroupe tout par « en retard / aujourd'hui / cette semaine / plus tard », et le badge sur l'onglet indique le nombre en attente.
- **Tableau de bord** : indicateurs clés (candidatures actives, taux de réponse, entretiens obtenus, prospects actifs, taux de conversion, contacts réseau), pipeline visuel par étape, activité récente.
- **Réglages** : export/import JSON pour sauvegarder tes données, et un rappel sur l'ajout à l'écran d'accueil.

## Fonctionnement technique

C'est une application web (PWA), sans compte ni serveur : toutes les données restent uniquement dans le navigateur de ton iPhone (`localStorage`). Rien n'est envoyé nulle part. Pense à utiliser **Réglages → Exporter une sauvegarde** régulièrement.

⚠️ **Limite connue** : Safari/iOS ne permet pas d'envoyer de vraies notifications programmées sans serveur de push. Pour un rappel fiable qui te réveille vraiment, utilise le bouton **« Ajouter au calendrier »** présent sur chaque relance : il génère un fichier `.ics` qui crée un événement avec alerte native dans l'app Calendrier (ou Rappels).

## Utilisation sur iPhone

1. Héberge ces fichiers statiques quelque part en HTTPS (le plus simple : active **GitHub Pages** sur ce dépôt, dossier racine, branche par défaut).
2. Ouvre l'URL dans **Safari** sur ton iPhone.
3. Appuie sur l'icône Partager → **« Sur l'écran d'accueil »**.
4. Lance l'app depuis l'icône ajoutée : elle s'ouvre en plein écran, comme une vraie app, et fonctionne aussi hors-ligne une fois chargée une première fois.

## Développement local

Aucune dépendance ni build : c'est du HTML/CSS/JS natif (modules ES).

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```
