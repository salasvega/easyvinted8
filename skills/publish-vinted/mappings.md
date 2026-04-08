# Mappings et pieges -- publish-vinted

## Mapping condition DB -> label Vinted FR

| DB value         | Label Vinted        |
|------------------|---------------------|
| very_good        | Tres bon etat       |
| good             | Bon etat            |
| new_with_tags    | Neuf avec etiquette |
| new_without_tags | Neuf sans etiquette |
| satisfactory     | Satisfaisant        |

---

## Mapping couleurs EasyVinted -> Vinted FR

La plupart des couleurs sont identiques. Exception connue :

| EasyVinted | Vinted FR | Note                          |
|------------|-----------|-------------------------------|
| Ecru       | Creme     | "Ecru" n'existe pas sur Vinted |

Couleurs standards (inchangees) :
Noir, Blanc, Gris, Bleu, Marine, Bleu clair, Rouge, Rose, Vert, Kaki,
Beige, Creme, Marron, Orange, Jaune, Violet, Multicolore.

---

## Mapping materiaux EasyVinted -> Vinted FR

| EasyVinted              | Vinted FR         | Note                              |
|-------------------------|-------------------|-----------------------------------|
| Melange coton stretch   | Coton             | N'existe pas -> matiere principale|
| Coton stretch           | Coton             | N'existe pas -> matiere principale|
| Velours cotele          | Velours cotele    | Essayer exact d'abord             |
| Coton                   | Coton             | Identique                         |
| Polyester               | Polyester         | Identique                         |
| Laine                   | Laine             | Identique                         |
| Denim                   | Denim             | Identique                         |
| Cuir                    | Cuir              | Identique                         |
| Cuir synthetique        | Cuir synthetique  | Identique                         |
| Lin                     | Lin               | Identique                         |
| Cachemire               | Cachemire         | Identique                         |
| Viscose                 | Viscose           | Identique                         |
| Acrylique               | Acrylique         | Identique                         |
| Nylon                   | Nylon             | Identique                         |

Regle : si valeur exacte absente -> utiliser la matiere principale.

---

## Pieges connus

| Piege | Cause | Fix |
|-------|-------|-----|
| Freeze Chrome champ Marque | type() -> appel API par frappe | Toujours paste via champ interne (TC6) |
| Prix "NaN" | Remplir prix dans TC4 | TC11 uniquement : vider d'abord, puis set |
| Doublon materiau | Suggestion pre-selectionnee | Re-ouvrir, decocher l'indesirable |
| Dialog "Leave site?" | Navigate sur tab en /edit | Creer nouveau tab avant /items/new |
| Redirect profil apres save | Vinted redirige /member/... pas /items/ID | Lire liens edit sur profil (TC13) |
| Modal authenticite | Nike/Adidas/Converse... | Fermer via bouton Fermer, re-cliquer Taille |
| localhost inaccessible | Extension bloque apres restart | Tout depuis onglet Vinted avec SERVICE_KEY |
| Supabase retourne [] | RLS bloque cle anon | Toujours SUPABASE_SERVICE_KEY |
| Couleur Ecru introuvable | N'existe pas Vinted | Mapper -> Creme |
| Dropdown ouvert au clic Prix | Oubli Escape | Escape apres TC9 et TC10 avant TC11 |
| Categorie non enregistree apres clic JS | React ne capte pas le clic JS sur ce champ | Utiliser getBoundingClientRect() + computer left_click |
| window.__CURRENT_ARTICLE vide en TC3 | Navigation /items/new recharge la page | Re-fetcher l'article Supabase par ID dans TC3 avant injection photos |
| adidas non trouve dans marques | Vinted utilise casse minuscule | Chercher "adidas" ; Originals -> "adidas Originals" |
| Photos en double | nativeSetter + fallback executes tous les deux sans verifier UI | Verifier miniatures visibles dans l'UI apres nativeSetter ; fallback UNIQUEMENT si 0 miniature |
| input.files.length = 0 apres injection | Browser reset la propriete apres injection, independamment de React | Ne pas utiliser input.files.length comme critere -- compter les miniatures UI a la place |

---

## Checklist avant chaque article

- [ ] Article status=processing existe (ou ready disponible)
- [ ] Onglet Vinted connecte (avatar visible)
- [ ] Onglet PAS sur /edit (sinon creer nouveau tab)
- [ ] Aucun dropdown ouvert

## Criteres de succes

- status processing -> vinted_draft dans Supabase
- vinted_url enregistree
- Au moins 1 photo visible sur l'annonce
- Tous champs obligatoires remplis
- Temps < 3 minutes par article
- 0 intervention humaine
