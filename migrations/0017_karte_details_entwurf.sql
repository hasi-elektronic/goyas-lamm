-- Entwurf für die Detailtafel, abgeleitet AUS DEM TEXT DER KARTE.
--
-- Was hier steht, steht so oder sinngemäß schon auf der Speisekarte:
-- „hausgemacht", „handgeschabt", „scharfe Tomatensoße", „vegetarisches Patty",
-- „Wurst von der Metzgerei Seyb", „Lemberger-Jus". Nichts davon ist erfunden.
--
-- NICHT gesetzt und bewusst leer:
--   * Allergene und Zusatzstoffe — die kommen aus Rezeptur und
--     Produktangaben, nicht aus einer Ableitung. `kennz_ok` bleibt 0.
--   * Herkunft und Reifung des Fleisches — weiß nur die Küche.
--   * „vegetarisch" außer beim Veggie-Burger, wo es auf der Karte steht.
--     Brühe, Dressing, Lab im Käse: das sieht man einem Gericht nicht an,
--     und ein Gast, der sich darauf verlässt, wäre zu Recht verärgert.
--
-- Die Weinempfehlungen sind Vorschläge aus der eigenen Weinkarte, keine
-- Tatsachenbehauptung. Sie stehen unter „Dazu passt" und lassen sich in
-- einem Klick ändern.

/* ---------- Steaks auf dem heißen Stein ---------- */
UPDATE menu_items SET
  garstufe = 'Auf dem heißen Stein gart das Fleisch am Tisch weiter. Wir empfehlen, '
           || 'es medium rare kommen zu lassen — den Rest bestimmen Sie selbst.',
  garstufe_en = 'On the hot stone the meat keeps cooking at your table. We suggest having '
              || 'it brought out medium rare — the rest is up to you.',
  wein = 'Lemberger, Weingut Allmendinger'
WHERE id IN ('steak-1-1', 'steak-1-2');

UPDATE menu_items SET
  garstufe = 'Auf dem heißen Stein gart das Fleisch am Tisch weiter. Beim Filet lohnt sich '
           || 'Zurückhaltung — medium rare, dann bleibt es zart.',
  garstufe_en = 'On the hot stone the meat keeps cooking at your table. With the fillet, '
              || 'restraint pays off — medium rare keeps it tender.',
  wein = 'Spätburgunder oder Syrah, Weingut Der Fischer'
WHERE id = 'steak-1-3';

/* ---------- Klassiker ---------- */
UPDATE menu_items SET
  marken = 'regional',
  herkunft = 'Die Wurst kommt von der Metzgerei Seyb.',
  herkunft_en = 'The sausage comes from Metzgerei Seyb.'
WHERE id = 'klassiker-1-1';

UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Hausgemacht vom Rücken — paniert wird bei uns, nicht beim Lieferanten. '
             || 'Dazu handgeschabte Spätzle oder Pommes, ganz wie Sie mögen.',
  geschichte_en = 'House-made from the loin — we bread it ourselves, not the supplier. '
                || 'With hand-scraped Spätzle or fries, whichever you prefer.'
WHERE id = 'klassiker-1-2';

UPDATE menu_items SET
  marken = 'hausgemacht,regional',
  wein = 'Lemberger, Weingut Allmendinger',
  geschichte = 'Der Jus wird mit Lemberger angesetzt — demselben Wein, den Sie auch im Glas '
             || 'bekommen. Dazu eine Maultasche und handgeschabte Spätzle oder Bratkartoffeln.',
  geschichte_en = 'The jus is made with Lemberger — the same wine you can have by the glass. '
                || 'Served with a Maultasche and hand-scraped Spätzle or pan-fried potatoes.'
WHERE id = 'klassiker-1-6';

UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Hausgemacht vom Kalbsrücken. Dazu Preiselbeeren und handgeschabte Spätzle '
             || 'oder Bratkartoffeln.',
  geschichte_en = 'House-made from the veal loin. With cranberries and hand-scraped Spätzle '
                || 'or pan-fried potatoes.'
WHERE id = 'klassiker-1-7';

UPDATE menu_items SET wein = 'Grauburgunder, Weingut Der Fischer'
WHERE id IN ('klassiker-1-5', 'klassiker-1-8');

UPDATE menu_items SET wein = 'Chardonnay, Weingut Faigle'
WHERE id = 'klassiker-1-3';

/* ---------- Schwäbische Teigwaren ---------- */
UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Von Hand geschabt — deshalb ist keine wie die andere. Dazu Zwiebelschmelze.',
  geschichte_en = 'Scraped by hand — which is why no two are alike. With buttered onions.'
WHERE id = 'teigwaren-2-1';

UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Handgeschabte Spätzle, Emmentaler und Bergkäse, darüber Zwiebelschmelze. '
             || 'Mehr braucht es nicht.',
  geschichte_en = 'Hand-scraped Spätzle, Emmental and mountain cheese, topped with buttered '
                || 'onions. Nothing more is needed.'
WHERE id = 'teigwaren-2-2';

UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Teig und Füllung entstehen bei uns im Haus. Dazu Zwiebelschmelze.',
  geschichte_en = 'Dough and filling are made here in the house. With buttered onions.'
WHERE id = 'teigwaren-2-3';

UPDATE menu_items SET marken = 'scharf' WHERE id = 'teigwaren-1-1';

/* ---------- Burger ---------- */
UPDATE menu_items SET marken = 'scharf' WHERE id = 'steak-2-3';
UPDATE menu_items SET marken = 'vegetarisch' WHERE id = 'steak-2-5';

/* ---------- Vorspeisen ---------- */
UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Das Pesto rühren wir selbst an.',
  geschichte_en = 'We make the pesto ourselves.'
WHERE id IN ('vorspeisen-2-3', 'vorspeisen-2-6');

UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Die Maultasche in der Brühe ist hausgemacht.',
  geschichte_en = 'The Maultasche in the broth is house-made.'
WHERE id = 'vorspeisen-1-3';

/* ---------- Süßes ---------- */
UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Die Erdbeersoße kochen wir selbst ein. Dazu geröstete Haselnüsse und eine '
             || 'frische Erdbeere.',
  geschichte_en = 'We cook the strawberry sauce ourselves. With roasted hazelnuts and a '
                || 'fresh strawberry.'
WHERE id = 'suesses-1-2';

UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Hausgemacht, mit Zitronenzeste und echter Vanille. Die Kruste wird erst '
             || 'kurz vor dem Servieren abgeflämmt.',
  geschichte_en = 'House-made, with lemon zest and real vanilla. The crust is caramelised '
                || 'only just before serving.'
WHERE id = 'suesses-1-3';

UPDATE menu_items SET
  marken = 'hausgemacht',
  geschichte = 'Die Schokoladensoße ist hausgemacht.',
  geschichte_en = 'The chocolate sauce is house-made.'
WHERE id = 'suesses-1-5';
