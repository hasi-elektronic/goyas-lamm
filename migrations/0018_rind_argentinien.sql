-- Herkunft des Rindfleischs: Argentinien.
--
-- Angabe von Hamdi/Gökhan, nicht abgeleitet. Sie steht in `herkunft` (kurz,
-- als Tatsache) und in `geschichte` (der längere Text, der erzählt, warum das
-- eine Rolle spielt).
--
-- ── Wo sie steht und wo bewusst nicht ─────────────────────────────────
-- Gesetzt bei den drei Steaks und bei den Gerichten, die laut Karte aus
-- demselben Steakfleisch geschnitten werden (Fleischpfanne, Pasta
-- Steakhouse, Salat Steakhouse).
--
-- NICHT gesetzt bei Rostbraten, Carpaccio, Rinderkraftbrühe und den
-- Burger-Pattys: Ob dort dasselbe Fleisch verarbeitet wird, weiß nur die
-- Küche. Eine Herkunftsangabe auf der Karte ist eine Tatsachenbehauptung —
-- die darf nicht aus „ist ja auch Rind" entstehen. Unten steht ein fertiger
-- Block dafür; er ist auskommentiert und braucht nur ein Ja.

/* ---------- Steaks auf dem heißen Stein ---------- */
UPDATE menu_items SET
  herkunft    = 'Unser Rindfleisch kommt aus Argentinien.',
  herkunft_en = 'Our beef comes from Argentina.',
  geschichte  = 'Seinen Ruf beim Rind hat Argentinien aus der Pampa: weites Weideland, '
             || 'auf dem die Tiere Platz und Zeit haben. Das Fleisch von dort ist '
             || 'feinfaserig, kräftig im Geschmack und mager, ohne trocken zu werden — '
             || 'es braucht nicht viel mehr als Salz, Hitze und jemanden, der es nicht '
             || 'zu lange liegen lässt. Genau das geben wir Ihnen auf dem heißen Stein '
             || 'in die Hand: Wann Ihr Stück so weit ist, entscheiden Sie selbst.',
  geschichte_en = 'Argentina''s reputation for beef comes from the Pampas: wide grazing '
             || 'land where the cattle have space and time. Meat from there is '
             || 'fine-grained, full in flavour and lean without turning dry — it needs '
             || 'little more than salt, heat and someone who does not leave it on too '
             || 'long. That is exactly what the hot stone puts in your hands: you decide '
             || 'yourself when your piece is ready.'
WHERE id IN ('steak-1-1', 'steak-1-2', 'steak-1-3');

/* ---------- Gerichte aus demselben Steakfleisch ---------- */
UPDATE menu_items SET
  herkunft    = 'Unser Rindfleisch kommt aus Argentinien.',
  herkunft_en = 'Our beef comes from Argentina.',
  geschichte  = 'Die Streifen schneiden wir aus demselben argentinischen Rindfleisch, '
             || 'das nebenan auf den heißen Stein kommt — kurz und heiß gebraten, '
             || 'damit es saftig bleibt.',
  geschichte_en = 'The strips are cut from the same Argentinian beef that goes on the hot '
             || 'stone next door — seared hot and briefly, so it stays juicy.'
WHERE id IN ('klassiker-1-4', 'teigwaren-1-6', 'vorspeisen-3-5');

/* ---------- Erst nach Rückfrage in der Küche freischalten ----------
UPDATE menu_items SET
  herkunft    = 'Unser Rindfleisch kommt aus Argentinien.',
  herkunft_en = 'Our beef comes from Argentina.'
WHERE id IN ('klassiker-1-6', 'vorspeisen-2-6', 'vorspeisen-1-3',
             'steak-2-1', 'steak-2-2', 'steak-2-3', 'steak-2-4', 'steak-2-6');
------------------------------------------------------------------- */
