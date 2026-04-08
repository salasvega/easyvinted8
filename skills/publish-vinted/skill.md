---
name: publish-vinted
description: >
  Automated end-to-end workflow for publishing EasyVinted articles on Vinted.fr, either as a draft
  or directly live. Invoke this skill whenever the user types /publish-vinted, asks to publish an
  article on Vinted, wants to process the Vinted queue, or says something like "publie le prochain
  article", "lance la publication Vinted", "traite la queue Vinted", "mets en ligne", "publie
  directement", or "publish next article". Also trigger when the user asks to resume or continue a
  Vinted publication that was interrupted. Supports two modes: draft (save as brouillon →
  vinted_draft) and publish (put live → published).
---

# publish-vinted -- Workflow de publication Vinted

## Mission

Publier un article EasyVinted sur Vinted.fr et mettre a jour Supabase. Zero intervention humaine
(sauf validation des champs manquants). Tout se fait depuis l'onglet Vinted via
mcp__Claude_in_Chrome__javascript_tool et l'API Supabase directe.

**Deux modes de publication :**
- **Mode `draft`** (defaut) : sauvegarder en brouillon via "Sauvegarder le brouillon" → statut Supabase `vinted_draft`
- **Mode `publish`** : mettre en ligne via "Ajouter" → statut Supabase `published`

Detecter le mode depuis la requete utilisateur (voir TC0b). En cas de doute, demander avant TC12.

IMPORTANT PERFORMANCE : Chaque appel d'outil coute des tokens. Privilegier les appels async JS
avec setTimeout internes pour regrouper open+wait+select en 1 seul appel. Ne JAMAIS utiliser
les screenshots (le rendu Vinted est systématiquement blanc dans l'outil — inutile et coûteux).
Pas de verifications post-selection sauf si le step est critique.

---

## Constantes

```javascript
const SB  = 'https://mgedkyxhpzaexxldigfp.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
```

RLS Supabase bloque la cle anon -- toujours utiliser KEY (service_role).

---

## Demarrage

Utilise mcp__Claude_in_Chrome__tabs_context_mcp (createIfEmpty: true).
Si aucun onglet vinted.fr -> naviguer vers https://www.vinted.fr avec mcp__Claude_in_Chrome__navigate.
Ne pas executer de JS sur chrome:// ou edge:// (erreur permission).

---

## TC0b -- Detecter le mode de publication

Analyser la requete utilisateur pour determiner le mode :

| Intention | Mode | Exemples |
|---|---|---|
| Sauvegarder en brouillon | `draft` | "publie", "lance", "sauvegarde", "brouillon" |
| Mettre en ligne directement | `publish` | "mets en ligne", "publie directement", "active l'annonce", "ajouter" |

**Si l'intention est ambigüe** (ex: juste "publie le prochain article") -> mode `draft` par defaut.
**Si l'utilisateur dit explicitement "en ligne", "directement", "active"** -> mode `publish`.

Memoriser : __MODE = 'draft' | 'publish'

---

## TC0 -- Selectionner le vendeur (prerequis obligatoire, 1 seule fois par session)

### Cas A -- Nom vendeur fourni dans la requete (ex: "pour Seb")

1 seul appel JS : chercher directement dans family_members avec ilike.

```javascript
(async () => {
  const SB  = 'https://mgedkyxhpzaexxldigfp.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
  const NOM = 'SEB'; // remplacer par le nom mentionne
  const r = await fetch(SB + '/rest/v1/family_members?name=ilike.*' + NOM + '*&select=id,name,user_id&order=name.asc',
    { headers: { Authorization: 'Bearer ' + KEY, apikey: KEY } });
  const sellers = await r.json();
  // Recuperer aussi email/password du profil associe
  if (!sellers.length) return 'VENDEUR NON TROUVE';
  const s = sellers[0];
  const r2 = await fetch(SB + '/rest/v1/user_profiles?id=eq.' + s.user_id + '&select=vinted_email,vinted_password',
    { headers: { Authorization: 'Bearer ' + KEY, apikey: KEY } });
  const profile = await r2.json();
  return JSON.stringify({ seller_id: s.id, seller_name: s.name, ...profile[0] });
})()
```

Memoriser : __SELECTED_SELLER_ID, __SELECTED_SELLER_NAME, __SELECTED_VINTED_EMAIL, __SELECTED_VINTED_PASSWORD.

Si plusieurs resultats -> afficher et demander de choisir.

### Cas B -- Aucun nom fourni

2 appels : lister user_profiles, puis family_members du profil choisi.

```javascript
// Appel 1 : profils
(async () => {
  const SB  = 'https://mgedkyxhpzaexxldigfp.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
  const r = await fetch(SB + '/rest/v1/user_profiles?select=id,name,vinted_email,vinted_password&order=name.asc',
    { headers: { Authorization: 'Bearer ' + KEY, apikey: KEY } });
  return JSON.stringify(await r.json());
})()

// Appel 2 : vendeurs du profil choisi
(async () => {
  const SB  = 'https://mgedkyxhpzaexxldigfp.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
  const r = await fetch(SB + '/rest/v1/family_members?user_id=eq.__SELECTED_USER_ID__&select=id,name&order=name.asc',
    { headers: { Authorization: 'Bearer ' + KEY, apikey: KEY } });
  return JSON.stringify(await r.json());
})()
```

### TC0c -- Verifier connexion Vinted (simplifie)

1 seul appel JS : verifier connected/disconnected uniquement. Ne pas tenter de verifier l'email.
Si connecte -> confirmer et continuer directement.
Si deconnecte -> executer le login ci-dessous.

```javascript
// Verification connexion
(() => {
  const loginBtn = Array.from(document.querySelectorAll('a, button')).find(el =>
    el.textContent.includes("S'inscrire") || el.textContent.includes('Se connecter')
  );
  return loginBtn ? 'disconnected' : 'connected';
})()
```

Si 'connected' -> afficher "Connecte sur Vinted. Je publie les articles de [Seller Name]. C'est parti !"
et passer directement a TC1.

Si 'disconnected' -> login en 1 seul appel async :

```javascript
(async () => {
  // Ouvrir modal login
  Array.from(document.querySelectorAll('a, button')).find(el =>
    el.textContent.includes("S'inscrire") || el.textContent.includes('Se connecter')
  )?.click();
  await new Promise(r => setTimeout(r, 2000));

  // Cliquer "e-mail"
  Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'e-mail')?.click();
  await new Promise(r => setTimeout(r, 2000));

  // Remplir email + password
  const set = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const emailEl = Array.from(document.querySelectorAll('input')).find(el => el.type === 'email' || el.placeholder?.includes('email'));
  const pwEl    = Array.from(document.querySelectorAll('input')).find(el => el.type === 'password');
  if (emailEl) set(emailEl, '__SELECTED_VINTED_EMAIL__');
  if (pwEl)    set(pwEl,    '__SELECTED_VINTED_PASSWORD__');

  // Soumettre
  Array.from(document.querySelectorAll('button[type="submit"], button')).find(b => b.textContent.includes('Continuer'))?.click();
  await new Promise(r => setTimeout(r, 3000));

  const ok = !Array.from(document.querySelectorAll('a, button')).find(el =>
    el.textContent.includes("S'inscrire") || el.textContent.includes('Se connecter')
  );
  return ok ? 'login OK' : 'login ECHEC';
})()
```

---

## TC1 -- Lire l'article a publier

1 seul appel JS. Filtre seller_id obligatoire.

Ordre de priorite :
1. status = processing (reprise session interrompue)
2. status = scheduled ET scheduled_for <= now()
3. status = ready (ordre created_at asc)

```javascript
(async () => {
  const SB        = 'https://mgedkyxhpzaexxldigfp.supabase.co';
  const KEY       = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
  const SELLER_ID = '__SELECTED_SELLER_ID__';
  const FIELDS    = 'id,title,description,seo_keywords,price,brand,size,condition,color,material,photos';
  const now       = new Date().toISOString();
  const h         = { Authorization: 'Bearer ' + KEY, apikey: KEY };

  let r, data;

  r = await fetch(SB + '/rest/v1/articles?status=eq.processing&seller_id=eq.' + SELLER_ID + '&select=' + FIELDS + '&limit=1', { headers: h });
  data = await r.json();
  if (!data.length) {
    r = await fetch(SB + '/rest/v1/articles?status=eq.scheduled&seller_id=eq.' + SELLER_ID + '&scheduled_for=lte.' + now + '&select=' + FIELDS + '&order=scheduled_for.asc&limit=1', { headers: h });
    data = await r.json();
  }
  if (!data.length) {
    r = await fetch(SB + '/rest/v1/articles?status=eq.ready&seller_id=eq.' + SELLER_ID + '&select=' + FIELDS + '&order=created_at.asc&limit=1', { headers: h });
    data = await r.json();
  }
  if (!data.length) return 'QUEUE VIDE';

  await fetch(SB + '/rest/v1/articles?id=eq.' + data[0].id, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'processing' })
  });

  // Stocker l'ID en global pour TC3
  window.__ARTICLE_ID = data[0].id;
  return JSON.stringify(data[0]);
})()
```

Memoriser depuis le resultat : id, title, description, seo_keywords, price, brand, size, condition, color, material, photos.
Ne pas stocker window.__CURRENT_ARTICLE ici (perdu a la navigation).

---

## TC1b -- Validation pre-publication (obligatoire avant TC2)

Verifier que les champs obligatoires Vinted sont remplis AVANT d'ouvrir le formulaire.
Cela evite de remplir tout le formulaire pour se faire bloquer a la fin par une validation Vinted.

Champs obligatoires : **size** et **color**.

Si l'un des deux est vide -> STOP. Afficher :
  "⚠️ Champ manquant : [size/color] est vide pour cet article.
   Quelle est la [taille/couleur] de cet article ?"

Attendre la reponse de l'utilisateur, memoriser la valeur, puis continuer vers TC2.

Si les deux sont remplis -> continuer directement sans message.

---

## TC2 -- Naviguer vers /items/new

- TOUJOURS creer un NOUVEL ONGLET avec mcp__Claude_in_Chrome__tabs_create_mcp avant de naviguer.
  Raison : tout onglet ayant deja visite /items/new aura des "unsaved changes" et bloquera la navigation avec "Leave site?".
- Puis naviguer vers https://www.vinted.fr/items/new sur le NOUVEL onglet.
- Pas de wait explicite : la navigation attend le chargement de la page.

---

## TC3+TC4 -- Photos + Titre + Description (1 seul appel)

IMPORTANT : window.__CURRENT_ARTICLE est perdu a la navigation. Ce call re-fetche l'article,
injecte les photos, attend 3s avec setTimeout interne, verifie les miniatures, remplit titre et description.

```javascript
(async () => {
  const SB   = 'https://mgedkyxhpzaexxldigfp.supabase.co';
  const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
  const ID   = '__ARTICLE_ID__'; // remplacer par l'ID memorise en TC1

  // 1. Re-fetch article
  const resp = await fetch(SB + '/rest/v1/articles?id=eq.' + ID + '&select=id,title,description,seo_keywords,price,brand,size,condition,color,material,photos&limit=1',
    { headers: { Authorization: 'Bearer ' + KEY, apikey: KEY } });
  const art = (await resp.json())[0];
  window.__CURRENT_ARTICLE = art;

  // 2. Injecter photos (5 premieres)
  const fileInput = document.querySelector('input[type="file"]');
  if (!fileInput) return 'ERROR: input[type=file] introuvable';
  const files = await Promise.all(art.photos.slice(0, 5).map(async (url, i) => {
    const blob = await (await fetch(url)).blob();
    return new File([blob], 'photo' + (i+1) + '.jpg', { type: 'image/jpeg' });
  }));
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set.call(fileInput, dt.files);
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new Event('input',  { bubbles: true }));

  // 3. Attendre rendu miniatures (3s)
  await new Promise(r => setTimeout(r, 3000));
  const thumbs = document.querySelectorAll('[class*="photo"] img, [class*="upload"] img, figure img').length;
  if (thumbs === 0) {
    // Fallback si aucune miniature
    Object.defineProperty(fileInput, 'files', { get: () => dt.files, configurable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input',  { bubbles: true }));
    await new Promise(r => setTimeout(r, 2000));
  }

  // 4. Remplir titre + description
  const SEO       = Array.isArray(art.seo_keywords) ? art.seo_keywords.join('\n') : (art.seo_keywords || '');
  const FULL_DESC = SEO ? art.description + '\n\n' + SEO : art.description;
  const set = (el, v, proto) => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const titleEl = document.querySelector('input[placeholder*="acheteurs"]')
               || document.querySelector('input[placeholder*="Marque"]')
               || document.querySelector('input[name="title"]');
  const descEl  = document.querySelector('textarea[placeholder*="informations"]')
               || document.querySelector('textarea[placeholder*="Coupe"]')
               || document.querySelector('textarea[name="description"]');
  if (titleEl) set(titleEl, art.title,    HTMLInputElement.prototype);
  if (descEl)  set(descEl,  FULL_DESC,    HTMLTextAreaElement.prototype);

  return { thumbs, title: titleEl?.value?.slice(0, 40), descOk: !!descEl };
})()
```

Si thumbs === 0 apres fallback -> alerter l'utilisateur.

---

## TC5 -- Categorie (suggestions automatiques Vinted)

Vinted suggere automatiquement des categories pertinentes quand on ouvre le dropdown,
en se basant sur le titre et la description deja remplis. Ces suggestions sont fiables
et dispensent de naviguer manuellement dans l'arbre. Toujours les utiliser en priorite.

Le clic JS seul ne valide pas toujours l'ouverture du dropdown categorie.
Toujours utiliser getBoundingClientRect() + mcp__Claude_in_Chrome__computer left_click.

**Appel 1 : obtenir coordonnees**
```javascript
(() => {
  const cat = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Sélectionne une catégorie');
  cat.scrollIntoView({ block: 'center' });
  const r = cat.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) });
})()
```

-> mcp__Claude_in_Chrome__computer left_click aux coordonnees retournees.

**Appel 2 : attendre (tool wait 1s) puis selectionner la suggestion (JS SYNC -- PAS async)**

IMPORTANT : Ne PAS utiliser async/await ici. Un appel async apres un clic physique provoque
"Promise was collected" (garbage collection avant resolution). Utiliser un wait tool separé,
puis un JS synchrone pour la selection.

-> mcp__Claude_in_Chrome__computer wait 1s

```javascript
// JS synchrone uniquement
(() => {
  const dropdown = document.querySelector('.input-dropdown__content');
  if (!dropdown) return 'dropdown non ouvert';
  const cells = Array.from(dropdown.querySelectorAll('[class*="Cell"]'));
  const all = [...new Set(cells.map(c => c.textContent.trim()).filter(Boolean))];

  // Prendre la 1ere suggestion (format: "Nom catégorieParent > Sous-catégorie > ...")
  // Les suggestions apparaissent en premier dans le dropdown, avant les categories racines
  const suggestion = cells.find(el => el.textContent.trim().includes('>'));
  if (suggestion) {
    suggestion.click();
    return 'suggestion acceptee: ' + suggestion.textContent.trim().slice(0, 80);
  }

  // Fallback : si pas de suggestion, afficher les options disponibles
  return 'pas de suggestion -- options: ' + JSON.stringify(all.slice(0, 8));
})()
```

Si pas de suggestion -> naviguer manuellement dans l'arbre (Hommes/Femmes/Enfants > Vêtements > sous-catégorie)
en inferant depuis le titre de l'article.

---

## TC6 -- Marque (1 seul appel async)

Si article.brand vide -> SKIP.
Ne JAMAIS utiliser mcp__Claude_in_Chrome__computer type() sur le champ marque (freeze Chrome).

```javascript
(async () => {
  const MARQUE = 'NOM_MARQUE'; // remplacer

  // Ouvrir
  const b = Array.from(document.querySelectorAll('input')).find(el =>
    el.placeholder === 'Sélectionne une marque' || el.placeholder === 'Selectionne une marque'
  );
  b.scrollIntoView({ block: 'center' }); b.click(); b.focus();
  await new Promise(r => setTimeout(r, 1000));

  // Rechercher
  const s = Array.from(document.querySelectorAll('input')).find(el =>
    el.placeholder === 'Rechercher une marque'
  );
  if (!s) return 'champ recherche introuvable';
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(s, MARQUE);
  s.dispatchEvent(new Event('input',  { bubbles: true }));
  s.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 2000));

  // Selectionner
  const dropdown = document.querySelector('.input-dropdown__content');
  if (!dropdown) return 'dropdown introuvable';
  const cell = Array.from(dropdown.querySelectorAll('[class*="Cell"]')).find(el => el.textContent.trim() === MARQUE);
  if (!cell) return 'marque non trouvee dans liste';
  cell.click();
  await new Promise(r => setTimeout(r, 500));

  // Fermer modal authenticite si present
  const modal = document.querySelector('[class*="modal"], [class*="Modal"]');
  if (modal) {
    const fermer = Array.from(modal.querySelectorAll('button')).find(b =>
      b.textContent.includes('Fermer') || b.textContent.includes('fermer')
    );
    if (fermer) fermer.click();
  }

  return 'marque OK: ' + MARQUE;
})()
```

ATTENTION casse speciale : "Adidas" -> chercher "adidas" ; Campus/Stan Smith -> "adidas Originals".

---

## TC7 -- Taille (1 seul appel async)

```javascript
(async () => {
  const TAILLE = 'NOM_TAILLE'; // ex: 'M', 'L', 'S / 36 / 8'
  const t = Array.from(document.querySelectorAll('input')).find(el =>
    el.placeholder === 'Sélectionne une taille' || el.placeholder === 'Selectionne une taille'
  );
  t.scrollIntoView({ block: 'center' }); t.click(); t.focus();
  await new Promise(r => setTimeout(r, 1000));
  const cell = Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
    .find(el => el.textContent.trim().startsWith(TAILLE));
  if (!cell) return 'taille non trouvee';
  cell.click();
  return 'taille OK: ' + cell.textContent.trim();
})()
```

---

## TC8 -- Etat (1 seul appel async)

Mapping condition -> label Vinted (voir references/mappings.md).
Ex: very_good -> "Très bon état", good -> "Bon état", new_with_tags -> "Neuf avec étiquettes".

```javascript
(async () => {
  const LABEL = 'LABEL_ETAT'; // ex: 'Très bon état'
  const e = Array.from(document.querySelectorAll('input')).find(el =>
    el.placeholder === 'Sélectionne un état' || el.placeholder === 'Selectionne un etat'
  );
  e.scrollIntoView({ block: 'center' }); e.click(); e.focus();
  await new Promise(r => setTimeout(r, 1000));
  const cell = Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
    .find(el => el.textContent.includes(LABEL));
  if (!cell) return 'etat non trouve';
  cell.click();
  return 'etat OK: ' + cell.textContent.trim().slice(0, 30);
})()
```

---

## TC9 -- Couleur (1 seul appel async)

Mapper si besoin (ex: Gris anthracite -> Gris, Ecru -> Creme). Voir references/mappings.md.

```javascript
(async () => {
  const COULEUR = 'NOM_COULEUR'; // ex: 'Gris'
  const c = Array.from(document.querySelectorAll('input')).find(el =>
    el.placeholder && el.placeholder.includes('couleurs')
  );
  c.scrollIntoView({ block: 'center' }); c.click(); c.focus();
  await new Promise(r => setTimeout(r, 1000));
  const cell = Array.from(document.querySelector('.input-dropdown__content').querySelectorAll('[class*="Cell"]'))
    .find(el => el.textContent.trim() === COULEUR);
  if (!cell) return 'couleur non trouvee';
  cell.click();
  await new Promise(r => setTimeout(r, 300));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return 'couleur OK: ' + COULEUR;
})()
```

---

## TC10 -- Materiau (clic physique + 1 appel async)

IMPORTANT : Ne jamais cliquer JS sur materiau juste apres un Escape couleur (React garde le focus).
Toujours verifier dropdown_open === false et utiliser clic physique.

**Appel 1 : verifier + obtenir coordonnees**
```javascript
(() => {
  const dropdownOpen = !!document.querySelector('.input-dropdown__content');
  const m = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Sélectionne un matériau');
  m.scrollIntoView({ block: 'center' });
  const r = m.getBoundingClientRect();
  return JSON.stringify({ dropdownOpen, x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) });
})()
```

Si dropdownOpen === true -> mcp__Claude_in_Chrome__computer key 'Escape', attendre 500ms.
-> mcp__Claude_in_Chrome__computer left_click aux coordonnees.

**Appel 2 : selectionner + verifier anti-doublon (async interne)**
```javascript
(async () => {
  const MATERIAU = 'NOM_MATERIAU'; // ex: 'Laine'
  await new Promise(r => setTimeout(r, 1000));
  const dropdown = document.querySelector('.input-dropdown__content');
  if (!dropdown) return 'dropdown non ouvert';
  const cell = Array.from(dropdown.querySelectorAll('[class*="Cell"]')).find(el => el.textContent.trim() === MATERIAU);
  if (!cell) return 'materiau non trouve';
  cell.click();
  await new Promise(r => setTimeout(r, 300));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(r => setTimeout(r, 300));

  // Anti-doublon
  const val = Array.from(document.querySelectorAll('input')).find(el => el.placeholder === 'Sélectionne un matériau')?.value;
  if (val && val.includes(',')) return 'DOUBLON DETECTE: ' + val + ' -- re-ouvrir et decocher indesirable';
  return 'materiau OK: ' + val;
})()
```

---

## TC11 -- Prix (1 seul appel async)

```javascript
(async () => {
  const PRIX = PRIX_VALEUR; // remplacer par le nombre
  const p  = document.querySelector('input[name="price"]');
  const ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  p.scrollIntoView({ block: 'center' }); p.focus();
  await new Promise(r => setTimeout(r, 200));
  ns.call(p, '');
  p.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  ns.call(p, String(PRIX));
  p.dispatchEvent(new Event('input',  { bubbles: true }));
  p.dispatchEvent(new Event('change', { bubbles: true }));
  return 'prix = ' + p.value;
})()
```

---

## TC12 -- Sauvegarder ou Publier

Selon __MODE :

**Mode `draft`** → clic "Sauvegarder le brouillon"
```javascript
Array.from(document.querySelectorAll('button'))
  .find(b => b.textContent.trim().includes('Sauvegarder le brouillon'))?.click()
```

**Mode `publish`** → clic "Ajouter" (met l'annonce en ligne immédiatement)
```javascript
Array.from(document.querySelectorAll('button'))
  .find(b => b.textContent.trim() === 'Ajouter')?.click()
```

**Si le mode n'est pas encore defini** -> demander a l'utilisateur :
"Souhaitez-vous sauvegarder en brouillon ou publier directement en ligne ?"
Attendre la reponse avant de cliquer.

Puis : mcp__Claude_in_Chrome__computer wait 4s.
Vinted redirige vers /member/... (pas vers /items/ID/edit).

---

## TC13+TC14 -- Extraire l'ID Vinted ET mettre a jour Supabase (1 seul appel)

Mettre a jour aussi `color`, `size` et `brand` avec les valeurs effectivement utilisees dans le formulaire
(utiles si elles etaient vides et ont ete renseignees par l'utilisateur en TC1b).

Statut Supabase selon __MODE :
- __MODE = `draft` → status = `vinted_draft`
- __MODE = `publish` → status = `published`

```javascript
(async () => {
  const links = Array.from(document.querySelectorAll('a[href*="/items/"][href*="edit"]')).map(a => a.href);
  const itemId = links[0]?.match(/\/items\/(\d+)/)?.[1];
  if (!itemId) return 'ERREUR: ID Vinted non trouve';

  const SB         = 'https://mgedkyxhpzaexxldigfp.supabase.co';
  const KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWRreXhocHphZXh4bGRpZ2ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE0OTkzOSwiZXhwIjoyMDc4NzI1OTM5fQ.zgpnFAcwgD5wGabzbBvl0GUFU2nosT-EbfFFCcoJVY0';
  const ARTICLE_ID = 'UUID_ARTICLE'; // remplacer par l'ID memorise en TC1
  const COLOR_USED = 'COULEUR_UTILISEE'; // valeur selectionnee en TC9 (ou renseignee en TC1b)
  const SIZE_USED  = 'TAILLE_UTILISEE';  // valeur selectionnee en TC7 (ou renseignee en TC1b)
  const h = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  const payload = { vinted_url: 'https://www.vinted.fr/items/' + itemId };
  if (COLOR_USED) payload.color = COLOR_USED;
  if (SIZE_USED)  payload.size  = SIZE_USED;

  // Statut selon le mode : 'vinted_draft' (draft) ou 'published' (publish)
  const STATUS = '__MODE__' === 'publish' ? 'published' : 'vinted_draft'; // remplacer __MODE__ par la valeur memorisee
  const r = await fetch(SB + '/rest/v1/articles?id=eq.' + ARTICLE_ID, {
    method: 'PATCH', headers: h,
    body: JSON.stringify({ ...payload, status: STATUS })
  });
  return r.status === 204 ? 'OK -- itemId: ' + itemId + ' | status: ' + STATUS + ' | https://www.vinted.fr/items/' + itemId : 'ERREUR ' + r.status;
})()
```

Premier lien = brouillon le plus recent.

---

## Apres TC14

Afficher :
  [Titre] publie sur Vinted
  Vendeur : [Seller Name] | Mode : [Brouillon / En ligne] | Item ID : XXXXXXXX | URL : https://www.vinted.fr/items/XXXXXXXX | Supabase : [vinted_draft / published]

Demander : "Continuer avec le prochain article pour [Seller Name] ?"
Si oui -> reprendre depuis TC1 (TC0 ne se repete PAS -- seller_id deja connu).
Si non -> fin de session.

---

## References

Lire references/mappings.md pour : mapping couleurs, materiaux, etats, et liste des pieges connus.
