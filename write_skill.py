import pathlib

BASE = pathlib.Path(r'C:\Users\salas\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\8cb77883-5b9d-4481-82f4-f0493b1d1f29\f1065f7f-c743-4037-8306-160bdf63c8d6\skills\publish-vinted')
REFS = BASE / 'references'
BASE.mkdir(exist_ok=True)
REFS.mkdir(exist_ok=True)

SKILL_MD = BASE / 'SKILL.md'
SKILL_MD.write_text(
r'''---
name: publish-vinted
description: >
  Automated end-to-end workflow for publishing EasyVinted articles on Vinted.fr as draft listings.
  Invoke this skill whenever the user types /publish-vinted, asks to publish an article on Vinted,
  wants to process the Vinted queue, or says something like "publie le prochain article", "lance la
  publication Vinted", "traite la queue Vinted", or "publish next article". Also trigger when the
  user asks to resume or continue a Vinted publication that was interrupted. This skill handles
  everything autonomously: fetching the article from Supabase, filling the Vinted form step by step
  via JavaScript injection in Chrome, saving the draft, and updating Supabase status to vinted_draft.
---

# publish-vinted -- Workflow de publication Vinted

## Mission

Publier un article EasyVinted sur Vinted.fr comme brouillon, puis mettre a jour Supabase
(status = vinted_draft). Zero intervention humaine. Tout se fait depuis l'onglet Vinted via
mcp__Claude_in_Chrome__javascript_tool et l'API Supabase directe.

---

## Constantes

```javascript
const SUPABASE_URL         = 'https://mgedkyxhpzaexxldigfp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
```

RLS Supabase bloque la cle anon -- toujours utiliser SUPABASE_SERVICE_KEY.

---

## Demarrage

1. Utilise mcp__Claude_in_Chrome__tabs_context_mcp pour obtenir le tabId Vinted actif (URL contenant vinted.fr).
2. Si aucun onglet Vinted ouvert, cree-en un avec mcp__Claude_in_Chrome__tabs_create_mcp puis navigue vers https://www.vinted.fr.

---

## TC1 -- Lire l'article a publier

```javascript
(async () => {
  const SB  = 'https://mgedkyxhpzaexxldigfp.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
  let resp = await fetch(SB + '/rest/v1/articles?status=eq.processing&select=id,title,description,price,brand,size,condition,color,material,photos&limit=1',
    { headers: { Authorization: 'Bearer ' + KEY, apikey: KEY } });
  let data = await resp.json();
  if (!data.length) {
    resp = await fetch(SB + '/rest/v1/articles?status=eq.ready&select=id,title,description,price,brand,size,condition,color,material,photos&order=created_at.asc&limit=1',
      { headers: { Authorization: 'Bearer ' + KEY, apikey: KEY } });
    data = await resp.json();
    if (!data.length) return 'QUEUE VIDE';
    await fetch(SB + '/rest/v1/articles?id=eq.' + data[0].id, {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'processing' })
    });
  }
  window.__CURRENT_ARTICLE = data[0];
  return JSON.stringify(data[0]);
})()
```

Memorise : id, title, description, price, brand, size, condition, color, material, photos.

---

## TC2 -- Naviguer vers /items/new

- Si l'onglet actif est sur /items/*/edit -> creer un NOUVEL ONGLET (evite "Leave site?").
- Sinon naviguer directement vers https://www.vinted.fr/items/new.
- Attendre 2s.

---

## TC3 -- Injecter les photos (5 premieres)

```javascript
(async () => {
  const PHOTO_URLS = [/* 5 premieres URLs de article.photos */];
  const fileInput = document.querySelector('input[type="file"]');
  if (!fileInput) return 'ERROR: input introuvable';
  const files = await Promise.all(PHOTO_URLS.map(async (url, i) => {
    const blob = await (await fetch(url)).blob();
    return new File([blob], 'photo' + (i+1) + '.jpg', { type: 'image/jpeg' });
  }));
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set;
  nativeSetter.call(fileInput, dt.files);
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new Event('input',  { bubbles: true }));
  return files.length + ' photos -- ' + files.map(f => Math.round(f.size/1024)+'kb').join(', ');
})()
```

Attendre 3s. Si input.files.length reste 0, fallback :
```javascript
Object.defineProperty(fileInput, 'files', { get: () => dt.files, configurable: true });
fileInput.dispatchEvent(new Event('change', { bubbles: true }));
```

---

## TC4 -- Remplir titre + description (PAS le prix)

```javascript
(() => {
  const TITLE = 'REMPLACER'; const DESC = 'REMPLACER';
  const set = (el, v, proto) => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const titleEl = document.querySelector('input[placeholder*="Marque"]') || document.querySelector('input[name="title"]');
  const descEl  = document.querySelector('textarea[placeholder*="Coupe"]')
               || document.querySelector('textarea[placeholder*="informations"]')
               || document.querySelector('textarea[name="description"]');
  if (titleEl) set(titleEl, TITLE, HTMLInputElement.prototype);
  if (descEl)  set(descEl, DESC, HTMLTextAreaElement.prototype);
  return { title: titleEl?.value?.slice(0,50), desc: !!descEl };
})()
```

---

## TC5 -- Categorie

```javascript
const cat = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Selectionne une categorie');
cat.scrollIntoView({ block: 'center' }); cat.click(); cat.focus();
// wait 1s
Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
  .find(el => el.textContent.trim().startsWith('NOM_CATEGORIE'))?.click();
```

Inferer la categorie du titre (ex: Doudoune -> Doudounes, Blazer -> Blazers, T-shirt -> T-shirts).

---

## TC6 -- Marque (paste -- ZERO freeze)

Si article.brand vide -> SKIP. Ne JAMAIS type() sur "Selectionne une marque" (freeze Chrome).

```javascript
// 6a - Ouvrir
const b = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Selectionne une marque');
b.scrollIntoView({ block: 'center' }); b.click(); b.focus();
// wait 1s

// 6b - Paste sur champ interne
const s = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Rechercher une marque');
Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(s, 'NOM_MARQUE');
s.dispatchEvent(new Event('input',  { bubbles: true }));
s.dispatchEvent(new Event('change', { bubbles: true }));
// wait 2s

// 6c - Click Cell exacte
Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
  .find(el => el.textContent.trim() === 'NOM_MARQUE')?.click();

// 6d - Si modal authenticite (Nike/Adidas/Converse...) -> fermer via bouton Fermer
```

---

## TC7 -- Taille

```javascript
const t = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Selectionne une taille');
t.scrollIntoView({ block: 'center' }); t.click(); t.focus();
// wait 1s
Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
  .find(el => el.textContent.trim().startsWith('NOM_TAILLE'))?.click();
```
Format Vinted : "S / 36 / 8", "M / 38 / 10", "L / 40 / 12", "XL / 42 / 14".

---

## TC8 -- Etat

Mapping condition -> label (voir references/mappings.md). Ex: very_good -> "Tres bon etat".

```javascript
const e = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Selectionne un etat');
e.scrollIntoView({ block: 'center' }); e.click(); e.focus();
// wait 1s
Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
  .find(el => el.textContent.includes('LABEL_ETAT'))?.click();
```

---

## TC9 -- Couleur

Mapper si besoin (Ecru -> Creme). Voir references/mappings.md.

```javascript
const c = Array.from(document.querySelectorAll('input')).find(el => el.placeholder.includes('couleurs'));
c.scrollIntoView({ block: 'center' }); c.click(); c.focus();
// wait 1s
Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
  .find(el => el.textContent.trim() === 'NOM_COULEUR')?.click();
// Escape pour fermer
```

---

## TC10 -- Materiau

Mapper si besoin. Voir references/mappings.md. Verifier anti-doublon apres selection.

```javascript
const m = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Selectionne un materiau');
m.scrollIntoView({ block: 'center' }); m.click(); m.focus();
// wait 1s
Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
  .find(el => el.textContent.trim() === 'NOM_MATERIAU')?.click();
// Escape pour fermer
// Si valeur contient virgule (doublon) -> re-ouvrir et decocher l'indesirable
```

---

## TC11 -- Prix

Escape d'abord si dropdown ouvert. Vider le champ avant de set la valeur.

```javascript
(async () => {
  const p  = document.querySelector('input[name="price"]');
  const ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  p.focus();
  await new Promise(r => setTimeout(r, 200));
  ns.call(p, '');
  p.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  ns.call(p, String(PRIX));
  p.dispatchEvent(new Event('input',  { bubbles: true }));
  p.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  return 'prix = ' + p.value;
})()
```

---

## TC12 -- Sauvegarder le brouillon

```javascript
Array.from(document.querySelectorAll('button'))
  .find(b => b.textContent.trim().includes('Sauvegarder le brouillon'))?.click();
```
Attendre 4s. Vinted redirige vers profil (/member/...), pas vers /items/ID/edit.

---

## TC13 -- Extraire l'ID Vinted

```javascript
const links = Array.from(document.querySelectorAll('a[href*="/items/"][href*="edit"]')).map(a => a.href);
const itemId = links[0]?.match(/\/items\/(\d+)/)?.[1];
JSON.stringify({ itemId, url: 'https://www.vinted.fr/items/' + itemId });
// Premier lien = brouillon le plus recent
```

---

## TC14 -- Marquer vinted_draft dans Supabase

```javascript
(async () => {
  const SB          = 'https://mgedkyxhpzaexxldigfp.supabase.co';
  const KEY         = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
  const ARTICLE_ID  = 'UUID_ARTICLE';
  const VINTED_ID   = 'ID_VINTED';
  const r = await fetch(SB + '/rest/v1/articles?id=eq.' + ARTICLE_ID, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'vinted_draft', vinted_url: 'https://www.vinted.fr/items/' + VINTED_ID })
  });
  return r.status === 204 ? 'OK vinted_draft -- https://www.vinted.fr/items/' + VINTED_ID : 'ERREUR ' + r.status;
})()
```

---

## Apres TC14

Afficher :
  [Titre] publie sur Vinted
  Item ID : XXXXXXXX | URL : https://www.vinted.fr/items/XXXXXXXX | Supabase : vinted_draft

Demander : "Continuer avec le prochain article ?"
Si oui -> reprendre depuis TC1.

---

## References

Lire references/mappings.md pour : mapping couleurs, materiaux, etats, et liste des pieges connus.
''',
encoding='utf-8')

MAPPINGS = REFS / 'mappings.md'
MAPPINGS.write_text(
r'''# Mappings et pieges -- publish-vinted

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
| Photos 0 apres injection | nativeSetter ne declenche pas React | Fallback Object.defineProperty |

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
''',
encoding='utf-8')

print('SKILL.md:', SKILL_MD.exists())
print('mappings.md:', MAPPINGS.exists())
print('Done!')
