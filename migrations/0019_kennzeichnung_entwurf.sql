-- Kennzeichnung — ENTWURF zum Prüfen, nicht zum Veröffentlichen.
--
-- Auf ausdrückliche Ansage von Hamdi: „schreib du sie vorerst, ich
-- aktualisiere sie im Admin." Genau so ist diese Datei gemeint.
--
-- ── Was hier steht und was es wert ist ────────────────────────────────
-- Diese Angaben sind aus dem Namen und der Beschreibung des Gerichts
-- abgeleitet, nach dem, was in einer deutschen Küche üblicherweise darin
-- steckt. Sie ersetzen **nicht** den Blick in Rezeptur und Produktangaben
-- des Lieferanten. Ein Beispiel für die Lücke: Dass im Hausdressing Senf
-- steckt, ist wahrscheinlich — ob im Burger-Bun Sesam liegt, sieht man dem
-- Brötchen an; ob das Speiseeis Sojalecithin enthält, steht nur auf dem
-- Karton.
--
-- Im Zweifel wurde eher zu viel angegeben als zu wenig. Falsch zu viel
-- führt dazu, dass ein Gast nachfragt. Falsch zu wenig führt dazu, dass er
-- es nicht tut.
--
-- ── Deshalb bleibt kennz_ok überall 0 ─────────────────────────────────
-- Der Gast sieht von alldem **nichts**: keine Codes am Gericht, keine
-- Legende, keinen Block in der Detailtafel — weiterhin nur „Fragen Sie uns
-- bitte". Sichtbar wird eine Zeile erst, wenn sie unter /admin/gericht
-- durchgesehen und mit dem Häkchen freigegeben wird, Gericht für Gericht.
-- Und ändert jemand danach ein Allergen, erlischt die Freigabe wieder.
--
-- Nicht ausgefüllt: Cocktails, Mocktails, Spirituosen und die meisten
-- Spritz-Varianten. Was da hineinkommt, hängt an der konkreten Flasche
-- hinter der Theke, nicht am Namen des Getränks.

/* ================= Suppen ================= */
UPDATE menu_items SET allergene='a,g,i' WHERE id='vorspeisen-1-1';  -- Tomatencremesuppe
UPDATE menu_items SET allergene='a,i'   WHERE id='vorspeisen-1-2';  -- Linsensuppe
UPDATE menu_items SET allergene='a,c,g,i' WHERE id='vorspeisen-1-3';-- Kraftbrühe m. Maultasche

/* ================= Vorspeisen ================= */
UPDATE menu_items SET allergene='j,l'   WHERE id='vorspeisen-2-1';  -- Salat (Dressing)
UPDATE menu_items SET allergene='a'     WHERE id='vorspeisen-2-2';  -- Bruschetta
UPDATE menu_items SET allergene='g'     WHERE id='vorspeisen-2-3';  -- Büffelmozzarella
UPDATE menu_items SET allergene='g'     WHERE id='vorspeisen-2-4';  -- Burrata
UPDATE menu_items SET allergene='b,g'   WHERE id='vorspeisen-2-5';  -- Garnelen im Tontopf
UPDATE menu_items SET allergene='g'     WHERE id='vorspeisen-2-6';  -- Carpaccio

/* ================= Salate ================= */
UPDATE menu_items SET allergene='a,c,g,i,j,l' WHERE id='vorspeisen-3-1'; -- Schwäbisch
UPDATE menu_items SET allergene='g,j,l'       WHERE id='vorspeisen-3-2'; -- Veggie m. Feta
UPDATE menu_items SET allergene='b,j,l'       WHERE id='vorspeisen-3-3'; -- Gambas
UPDATE menu_items SET allergene='d,j,l'       WHERE id='vorspeisen-3-4'; -- Omega
UPDATE menu_items SET allergene='j,l'         WHERE id='vorspeisen-3-5'; -- Steakhouse
UPDATE menu_items SET allergene='a,c,g,j,l'   WHERE id='vorspeisen-3-6'; -- Wien

/* ================= Klassiker ================= */
-- Wurstsalat: Konservierungsstoff wegen Nitritpökelsalz in der Wurst — beim
-- Metzger nachfragen, manche Hausmacher arbeiten ohne.
UPDATE menu_items SET allergene='g,j,l', zusatz='2' WHERE id='klassiker-1-1';
UPDATE menu_items SET allergene='a,c,g'   WHERE id='klassiker-1-2';  -- Schweineschnitzel
UPDATE menu_items SET allergene='b'       WHERE id='klassiker-1-3';  -- Garnelenpfanne
UPDATE menu_items SET allergene='i'       WHERE id='klassiker-1-4';  -- Fleischpfanne
UPDATE menu_items SET allergene='d,g,l'   WHERE id='klassiker-1-5';  -- Lachsfilet
UPDATE menu_items SET allergene='a,c,g,i,l' WHERE id='klassiker-1-6';-- Rostbraten
UPDATE menu_items SET allergene='a,c,g'   WHERE id='klassiker-1-7';  -- Wiener Schnitzel
UPDATE menu_items SET allergene='d,g,j'   WHERE id='klassiker-1-8';  -- Doradenfilet

/* ================= Steak & Burger ================= */
-- Steaks: nur die Kräuterbutter dazu. Ohne Butter wäre die Zeile leer.
UPDATE menu_items SET allergene='g' WHERE id IN ('steak-1-1','steak-1-2','steak-1-3');
-- Burger: Sesam nur, wenn das Bun welchen trägt — bitte am Brötchen prüfen.
UPDATE menu_items SET allergene='a,c,g,j,k' WHERE id IN ('steak-2-1','steak-2-2','steak-2-3');
UPDATE menu_items SET allergene='a,c,f,g,j,k', zusatz='2' WHERE id='steak-2-4'; -- BBQ + Bacon
UPDATE menu_items SET allergene='a,c,f,g,j,k' WHERE id='steak-2-5';             -- Veggie-Patty
UPDATE menu_items SET allergene='a' WHERE id='steak-3-2';                       -- Süßkartoffel
UPDATE menu_items SET allergene='j,l' WHERE id='steak-3-4';                     -- Beilagensalat

/* ================= Pasta ================= */
UPDATE menu_items SET allergene='a'     WHERE id='teigwaren-1-1';  -- Arrabbiata
UPDATE menu_items SET allergene='a,g'   WHERE id='teigwaren-1-2';  -- Caprese
UPDATE menu_items SET allergene='a,g'   WHERE id='teigwaren-1-3';  -- Veggie
UPDATE menu_items SET allergene='a,b,g' WHERE id='teigwaren-1-4';  -- Gambas
UPDATE menu_items SET allergene='a,d,g,l' WHERE id='teigwaren-1-5';-- Omega
UPDATE menu_items SET allergene='a,g'   WHERE id='teigwaren-1-6';  -- Steakhouse

/* ================= Schwäbische Teigwaren ================= */
UPDATE menu_items SET allergene='a,c,g'   WHERE id='teigwaren-2-1'; -- Spätzle
UPDATE menu_items SET allergene='a,c,g'   WHERE id='teigwaren-2-2'; -- Käsespätzle
UPDATE menu_items SET allergene='a,c,g,i' WHERE id='teigwaren-2-3'; -- Maultaschen
UPDATE menu_items SET allergene='a,c,g'   WHERE id='teigwaren-2-4'; -- Manti

/* ================= Süßes ================= */
UPDATE menu_items SET allergene='c,f,g'   WHERE id='suesses-1-1'; -- Vanilleeis m. Soße
UPDATE menu_items SET allergene='g,h'     WHERE id='suesses-1-2'; -- Panna Cotta, Haselnuss
UPDATE menu_items SET allergene='c,g'     WHERE id='suesses-1-3'; -- Crème brûlée
UPDATE menu_items SET allergene='c,g'     WHERE id='suesses-1-4'; -- Heiße Beeren
UPDATE menu_items SET allergene='a,c,f,g' WHERE id='suesses-1-5'; -- Pancake

/* ================= Getränke ================= */
-- Bier: glutenhaltiges Getreide. Die alkoholfreien genauso.
UPDATE menu_items SET allergene='a' WHERE id LIKE 'getraenke-4-%' OR id LIKE 'getraenke-5-%';
-- Wein und Schaumwein: Sulfite. Ob zusätzlich mit Ei oder Milch geschönt
-- wurde, steht auf dem Etikett der jeweiligen Flasche.
UPDATE menu_items SET allergene='l' WHERE id LIKE 'getraenke-6-%' OR id LIKE 'getraenke-7-%';

-- Alkoholfrei
UPDATE menu_items SET zusatz='9'          WHERE id='getraenke-8-2'; -- Limonade 0 % Zucker
UPDATE menu_items SET zusatz='1,9,10,12'  WHERE id='getraenke-8-3'; -- Cola/Zero/Orange/Zitrone
UPDATE menu_items SET zusatz='13'         WHERE id='getraenke-8-4'; -- Tonic, Bitter Lemon

-- Kaffee & Tee
UPDATE menu_items SET zusatz='12'                  WHERE id='getraenke-9-1';
UPDATE menu_items SET allergene='g', zusatz='12'   WHERE id IN ('getraenke-9-2','getraenke-9-3');
UPDATE menu_items SET allergene='c,g', zusatz='12' WHERE id='getraenke-9-4'; -- Affogato
UPDATE menu_items SET zusatz='12'                  WHERE id='getraenke-9-5'; -- schwarz/grün

-- Aperitifs mit Farbstoff (Aperol, Campari)
UPDATE menu_items SET zusatz='1' WHERE id IN ('getraenke-3-1','getraenke-3-4','getraenke-3-7');
UPDATE menu_items SET zusatz='1,12' WHERE id='getraenke-1-10';               -- Cuba Libre

/* ================= Freigabe bleibt aus ================= */
-- Der Vollständigkeit halber ausgeschrieben: Auch wenn oben etwas
-- danebengegangen wäre, kommt nichts davon vor den Gast.
UPDATE menu_items SET kennz_ok = 0, kennz_am = NULL, kennz_von = NULL;
