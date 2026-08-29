-- Detailtexte zur Karte — Stand der Produktionsdatenbank am 29.08.2026, 15:40.
--
-- ⚠️ Diese Datei ist eine **Momentaufnahme, keine Migration im üblichen Sinn.**
-- Sie wurde nicht geschrieben, sondern aus der laufenden Datenbank gelesen: Die
-- Texte sind am 29.08. zwischen 11 und 15 Uhr in einer anderen Sitzung entstanden
-- und standen nur in der Produktionsdatenbank — nicht im Repo, nicht in der
-- Sicherung von 10:56. Damit sie nicht an genau einer Stelle der Welt liegen,
-- sind sie hier festgehalten.
--
-- Verglichen wurde gegen den Datenbank-Export aus der Sicherung von 10:56 Uhr;
-- aufgeführt ist nur, was sich seither geändert hat: 85 von 132 Gerichten,
-- Spalten herkunft, reifung, garstufe, wein und geschichte (je mit englischer
-- Fassung, wo es eine gibt).
--
-- **Nicht einspielen, um „aufzuräumen".** Wer diese Datei erneut ausführt,
-- überschreibt jede spätere Änderung aus dem Panel. Sie ist zum Nachlesen und
-- für den Fall gedacht, dass die Texte verloren gehen.
--
-- Was hier bewusst NICHT drinsteht: Allergene und Zusatzstoffe. Die stehen
-- weiter auf `kennz_ok = 0` — kein Gericht ist von der Küche freigegeben, und
-- ohne diese Freigabe zeigt die Karte sie nicht an. Diese Datei ändert daran
-- nichts.
--
-- ── Noch zu klären ────────────────────────────────────────────────────
-- Mehrere Texte nennen konkrete Lieferanten und Arbeitsweisen: Metzgerei Seyb,
-- Hochdorfer Kronenbrauerei, Weingut Allmendinger, „am Stück gereift", „die
-- Leitungen spülen wir täglich". Das sind Tatsachenbehauptungen auf einer
-- öffentlichen Speisekarte. Gökhan muss sie bestätigen; stimmt eine nicht,
-- gehört sie sofort geändert.

-- getraenke-1-14 — Espresso Martini
UPDATE menu_items SET
    geschichte = 'Der Espresso kommt frisch aus der Maschine, nicht aus der Kanne. Nur so bildet sich die Schaumkrone.',
    geschichte_en = 'The espresso comes fresh from the machine, never from a jug. That is the only way the crema forms on top.'
  WHERE id = 'getraenke-1-14';

-- getraenke-1-5 — Gin Basil Smash
UPDATE menu_items SET
    geschichte = 'Basilikum wird im Shaker aufgeschlagen, nicht püriert — sonst wird der Drink bitter statt frisch.',
    geschichte_en = 'The basil is bruised in the shaker, not puréed — otherwise the drink turns bitter instead of fresh.'
  WHERE id = 'getraenke-1-5';

-- getraenke-1-6 — Negroni
UPDATE menu_items SET
    geschichte = 'Zu gleichen Teilen Gin, Campari und Wermut. An diesem Verhältnis ändern wir nichts.',
    geschichte_en = 'Equal parts gin, Campari and vermouth. We do not change those proportions.'
  WHERE id = 'getraenke-1-6';

-- getraenke-1-8 — Old Fashioned
UPDATE menu_items SET
    geschichte = 'Zucker, Bitter, Whiskey, ein großer Eiswürfel. Der Würfel ist mit Absicht groß: Er schmilzt langsamer und verwässert nicht.',
    geschichte_en = 'Sugar, bitters, whiskey, one large ice cube. The cube is large on purpose: it melts more slowly and does not water the drink down.'
  WHERE id = 'getraenke-1-8';

-- getraenke-1-9 — Caipirinha
UPDATE menu_items SET
    geschichte = 'Limette und Rohrzucker werden im Glas gestoßen, der Cachaça kommt darüber. Crushed Ice, kein Wasser.',
    geschichte_en = 'Lime and cane sugar are muddled in the glass, the cachaça goes on top. Crushed ice, no water.'
  WHERE id = 'getraenke-1-9';

-- getraenke-10-1 — Gin
UPDATE menu_items SET
    geschichte = 'Sechs Gins von trocken bis blumig, jeweils 4 cl. Sagen Sie uns, was Sie sonst trinken — wir treffen es meistens.',
    geschichte_en = 'Six gins from dry to floral, 4 cl each. Tell us what you usually drink and we will usually get it right.'
  WHERE id = 'getraenke-10-1';

-- getraenke-10-2 — Whisk(e)y
UPDATE menu_items SET
    geschichte = 'Von kanadisch mild bis Highland mit Alter. Der Dalmore 12 und der Jura 12 sind die beiden, nach denen am häufigsten gefragt wird.',
    geschichte_en = 'From mild Canadian to aged Highland. The Dalmore 12 and the Jura 12 are the two most often asked for.'
  WHERE id = 'getraenke-10-2';

-- getraenke-10-3 — Rum
UPDATE menu_items SET
    geschichte = 'Vier Rums, vom leichten Mixrum bis zum Ron Zacapa, der pur getrunken gehört.',
    geschichte_en = 'Four rums, from a light mixing rum to Ron Zacapa, which belongs in a glass on its own.'
  WHERE id = 'getraenke-10-3';

-- getraenke-10-4 — Wodka
UPDATE menu_items SET
    geschichte = 'Vier Wodkas, 4 cl. Der Ukiyo ist aus Reis gebrannt und schmeckt deutlich anders als die drei anderen — fragen Sie danach, wenn Sie etwas Neues wollen.',
    geschichte_en = 'Four vodkas, 4 cl. The Ukiyo is distilled from rice and tastes distinctly different from the other three — ask for it if you want something new.'
  WHERE id = 'getraenke-10-4';

-- getraenke-10-5 — Weinbrand
UPDATE menu_items SET
    geschichte = 'Von Asbach bis zum Adega Velha 12 XO. Der XO steht zwölf Jahre im Fass, das schmeckt man.',
    geschichte_en = 'From Asbach to the Adega Velha 12 XO. The XO spends twelve years in the barrel, and it shows.'
  WHERE id = 'getraenke-10-5';

-- getraenke-10-6 — Digestif & Likör
UPDATE menu_items SET
    geschichte = 'Obstler, Raki, Limoncello, Ouzo und die Klassiker. Für nach dem Steak — die Karte hört nicht beim Nachtisch auf.',
    geschichte_en = 'Fruit brandy, raki, limoncello, ouzo and the classics. For after the steak — the menu does not stop at dessert.'
  WHERE id = 'getraenke-10-6';

-- getraenke-10-7 — Wermut
UPDATE menu_items SET
    geschichte = 'Carpano, 6 cl, gekühlt und pur. Wermut ist bei uns kein Mixzusatz, sondern ein eigener Gang nach dem Essen.',
    geschichte_en = 'Carpano, 6 cl, chilled and neat. Here vermouth is not a mixer but a course of its own after the meal.'
  WHERE id = 'getraenke-10-7';

-- getraenke-4-1 — Pils
UPDATE menu_items SET
    herkunft = 'Hochdorfer Kronenbrauerei, vom Fass.',
    herkunft_en = 'Hochdorfer brewery, on tap.',
    geschichte = 'Herb und schlank. Die Leitungen spülen wir täglich — deshalb schmeckt das erste Glas am Abend wie das letzte.',
    geschichte_en = 'Bitter and lean. We flush the lines daily — which is why the first glass of the evening tastes like the last.'
  WHERE id = 'getraenke-4-1';

-- getraenke-4-2 — Helles
UPDATE menu_items SET
    herkunft = 'Hochdorfer Kronenbrauerei, vom Fass.',
    herkunft_en = 'Hochdorfer brewery, on tap.',
    geschichte = 'Milder als das Pils, dafür süffiger. Das Bier für den langen Abend.',
    geschichte_en = 'Milder than the Pils, but easier to drink. The beer for a long evening.'
  WHERE id = 'getraenke-4-2';

-- getraenke-4-3 — Weizen naturtrüb
UPDATE menu_items SET
    herkunft = 'Hochdorfer Kronenbrauerei, vom Fass.',
    herkunft_en = 'Hochdorfer brewery, on tap.',
    geschichte = 'Unfiltriert, deshalb trüb. Wir zapfen es langsam, damit die Schaumkrone hält.',
    geschichte_en = 'Unfiltered, hence cloudy. We pour it slowly so the head holds.'
  WHERE id = 'getraenke-4-3';

-- getraenke-4-4 — Radler
UPDATE menu_items SET
    herkunft = 'Hochdorfer Kronenbrauerei, vom Fass.',
    herkunft_en = 'Hochdorfer brewery, on tap.',
    geschichte = 'Halb Helles, halb Zitronenlimonade, frisch im Glas gemischt statt fertig gekauft.',
    geschichte_en = 'Half Helles, half lemonade, mixed fresh in the glass rather than bought ready-made.'
  WHERE id = 'getraenke-4-4';

-- getraenke-6-1 — Riesling
UPDATE menu_items SET
    herkunft = 'Weingut Allmendinger, aus der Nachbarschaft.',
    herkunft_en = 'Weingut Allmendinger, from the neighbourhood.',
    geschichte = 'Trocken, mit klarer Säure. Der Wein, der auf dieser Karte zu den meisten Vorspeisen passt.',
    geschichte_en = 'Dry, with clear acidity. The wine on this list that suits most of the starters.'
  WHERE id = 'getraenke-6-1';

-- getraenke-6-10 — Muskat-Trollinger
UPDATE menu_items SET
    herkunft = 'Weingut Faigle.',
    herkunft_en = 'Weingut Faigle.',
    geschichte = 'Fruchtiger Rosé mit deutlichem Muskatton. Gut zu allem, was süß und salzig zugleich ist.',
    geschichte_en = 'A fruity rosé with a clear muscat note. Good with anything that is sweet and salty at once.'
  WHERE id = 'getraenke-6-10';

-- getraenke-6-11 — Grauburgunder
UPDATE menu_items SET
    herkunft = 'Der Fischer.',
    herkunft_en = 'Der Fischer.',
    geschichte = 'Trocken und kräftig für einen Weißwein. Der Gegenspieler zu Grillgemüse und gebratenem Fisch.',
    geschichte_en = 'Dry and powerful for a white wine. The counterpart to grilled vegetables and pan-fried fish.'
  WHERE id = 'getraenke-6-11';

-- getraenke-6-12 — Syrah
UPDATE menu_items SET
    herkunft = 'Der Fischer.',
    herkunft_en = 'Der Fischer.',
    geschichte = 'Der dunkelste Rote der Karte, mit Pfeffernote. Wenn ein Wein gegen 400 Gramm Rumpsteak bestehen soll, dann dieser.',
    geschichte_en = 'The darkest red on the list, with a peppery note. If a wine has to stand up to 400 grams of rump steak, this is the one.'
  WHERE id = 'getraenke-6-12';

-- getraenke-6-13 — Sauvignon Blanc
UPDATE menu_items SET
    geschichte = 'Halbtrocken, mit deutlicher Kräuternote. Der einzige Wein auf dieser Karte, der nicht aus der Nachbarschaft kommt — er passt zu den Garnelen zu gut, um ihn wegzulassen.',
    geschichte_en = 'Off-dry, with a clear herbal note. The only wine on this list that does not come from the neighbourhood — it goes too well with the prawns to leave out.'
  WHERE id = 'getraenke-6-13';

-- getraenke-6-2 — Weißburgunder
UPDATE menu_items SET
    herkunft = 'Weingut Allmendinger.',
    herkunft_en = 'Weingut Allmendinger.',
    geschichte = 'Ruhiger als der Riesling, weniger Säure, mehr Schmelz. Passt dorthin, wo Panade oder Sahne im Spiel sind.',
    geschichte_en = 'Calmer than the Riesling, less acidity, more body. It belongs where breadcrumbs or cream are involved.'
  WHERE id = 'getraenke-6-2';

-- getraenke-6-3 — Spätburgunder
UPDATE menu_items SET
    herkunft = 'Weingut Allmendinger.',
    herkunft_en = 'Weingut Allmendinger.',
    geschichte = 'Als Rosé ausgebaut und lieblich — für alle, denen Rotwein zum Steak zu viel ist.',
    geschichte_en = 'Made as a rosé and off-dry — for anyone who finds red wine too much with steak.'
  WHERE id = 'getraenke-6-3';

-- getraenke-6-4 — Trollinger-Lemberger
UPDATE menu_items SET
    herkunft = 'Weingut Allmendinger.',
    herkunft_en = 'Weingut Allmendinger.',
    geschichte = 'Der Alltagsrote der Gegend: leicht, unkompliziert, kühl serviert. Zum Vesper und zu den Teigwaren.',
    geschichte_en = 'The everyday red of this region: light, uncomplicated, served cool. For a cold platter or with the pasta dishes.'
  WHERE id = 'getraenke-6-4';

-- getraenke-6-5 — Lemberger
UPDATE menu_items SET
    herkunft = 'Weingut Allmendinger.',
    herkunft_en = 'Weingut Allmendinger.',
    geschichte = 'Derselbe Wein, mit dem wir den Jus für den Rostbraten ansetzen. Kräftig genug fürs Fleisch, ohne es zu überdecken.',
    geschichte_en = 'The same wine we use to build the jus for the Rostbraten. Strong enough for the meat without covering it up.'
  WHERE id = 'getraenke-6-5';

-- getraenke-6-6 — Traminer
UPDATE menu_items SET
    herkunft = 'Weingärtner.',
    herkunft_en = 'Weingärtner.',
    geschichte = 'Halbtrocken und deutlich blumig — ein Wein, den man entweder sofort mag oder gar nicht.',
    geschichte_en = 'Off-dry and distinctly floral — a wine you either take to at once or not at all.'
  WHERE id = 'getraenke-6-6';

-- getraenke-6-7 — Lemberger Weißherbst
UPDATE menu_items SET
    herkunft = 'Weingärtner.',
    herkunft_en = 'Weingärtner.',
    geschichte = 'Feinherber Rosé aus Lemberger-Trauben. Hält gegen Knoblauch und Schärfe besser als die meisten Weißweine.',
    geschichte_en = 'An off-dry rosé from Lemberger grapes. It stands up to garlic and heat better than most whites.'
  WHERE id = 'getraenke-6-7';

-- getraenke-6-8 — Merlot rosé
UPDATE menu_items SET
    herkunft = 'Weingärtner.',
    herkunft_en = 'Weingärtner.',
    geschichte = 'Trocken, hell in der Farbe, kühl zu trinken. Der Sommerwein auf dieser Karte.',
    geschichte_en = 'Dry, pale in colour, best served cool. The summer wine on this list.'
  WHERE id = 'getraenke-6-8';

-- getraenke-6-9 — Chardonnay
UPDATE menu_items SET
    herkunft = 'Weingut Faigle.',
    herkunft_en = 'Weingut Faigle.',
    geschichte = 'Trocken ausgebaut, mit Substanz. Steht zu Lachs und Garnelen, ohne unterzugehen.',
    geschichte_en = 'Made dry, with substance. It holds its own with salmon and prawns.'
  WHERE id = 'getraenke-6-9';

-- getraenke-7-1 — Sekt Hausmarke
UPDATE menu_items SET
    geschichte = 'Der Sekt fürs Anstoßen, offen im Glas. Wer den Abend feiern will, findet unten die drei Zardetto.',
    geschichte_en = 'The sparkling wine for a toast, poured by the glass. If the evening calls for something more, the three Zardetto are below.'
  WHERE id = 'getraenke-7-1';

-- getraenke-7-2 — Zardetto Frizzante
UPDATE menu_items SET
    herkunft = 'Prosecco DOC, Veneto.',
    herkunft_en = 'Prosecco DOC, Veneto.',
    geschichte = 'Der leichteste der drei: weniger Druck auf der Flasche, feinere Perlage. Als Aperitif gedacht.',
    geschichte_en = 'The lightest of the three: less pressure in the bottle, a finer bead. Intended as an aperitif.'
  WHERE id = 'getraenke-7-2';

-- getraenke-7-3 — Zardetto Spumante
UPDATE menu_items SET
    herkunft = 'Prosecco DOC, Veneto.',
    herkunft_en = 'Prosecco DOC, Veneto.',
    geschichte = 'Brut ausgebaut, kräftiger in der Perlage als der Frizzante. Hält auch neben den Vorspeisen stand.',
    geschichte_en = 'Made brut, with a stronger bead than the Frizzante. It holds its own alongside the starters.'
  WHERE id = 'getraenke-7-3';

-- getraenke-7-4 — Zardetto Rosé
UPDATE menu_items SET
    herkunft = 'Prosecco Millesimato DOC, Veneto.',
    herkunft_en = 'Prosecco Millesimato DOC, Veneto.',
    geschichte = 'Millesimato heißt: Trauben aus einem einzigen Jahrgang. Trocken, hell, mit etwas Beere.',
    geschichte_en = 'Millesimato means grapes from a single vintage. Dry, pale, with a hint of berry.'
  WHERE id = 'getraenke-7-4';

-- getraenke-8-2 — Hausgemachte Limonade · 0 % Zucker
UPDATE menu_items SET
    geschichte = 'Sechs Sorten, alle bei uns angesetzt und ohne Zucker gesüßt. Wer keinen Alkohol trinkt, bekommt hier mehr als Cola.',
    geschichte_en = 'Six varieties, all made here and sweetened without sugar. If you are not drinking alcohol, there is more here than cola.'
  WHERE id = 'getraenke-8-2';

-- getraenke-8-5 — Säfte & Nektare
UPDATE menu_items SET
    geschichte = 'Direktsäfte von Kumpf, auch als Schorle. Kein Konzentrat.',
    geschichte_en = 'Pressed juices from Kumpf, also available as a spritzer. No concentrate.'
  WHERE id = 'getraenke-8-5';

-- getraenke-9-4 — Affogato
UPDATE menu_items SET
    geschichte = 'Ein Espresso über eine Kugel Vanilleeis gegossen. Kommt getrennt an den Tisch, damit Sie selbst gießen — sonst ist das Eis geschmolzen, bevor es bei Ihnen ist.',
    geschichte_en = 'An espresso poured over a scoop of vanilla ice cream. It comes to the table separately so you can pour it yourself — otherwise the ice cream has melted before it reaches you.'
  WHERE id = 'getraenke-9-4';

-- getraenke-9-5 — Tee von der Sternschnuppe
UPDATE menu_items SET
    geschichte = 'Loser Tee, kein Beutel. Wir ziehen ihn ab und stellen die Kanne dazu, damit er nicht bitter wird.',
    geschichte_en = 'Loose leaf, not bags. We take the leaves out and leave the pot with you, so it does not turn bitter.'
  WHERE id = 'getraenke-9-5';

-- klassiker-1-1 — Schweizer Wurstsalat
UPDATE menu_items SET
    garstufe = 'Zieht am besten eine Viertelstunde durch, bevor er auf den Tisch kommt — genau so lange lassen wir ihn stehen.',
    garstufe_en = 'It is best after a quarter of an hour of marinating — which is exactly how long we let it stand.',
    wein = 'Riesling-Schorle'
  WHERE id = 'klassiker-1-1';

-- klassiker-1-2 — Schweineschnitzel „Wiener Art“
UPDATE menu_items SET
    garstufe = 'Die Panade liegt in Wellen auf dem Fleisch — das ist das Zeichen, dass sie nicht angeklebt ist.',
    garstufe_en = 'The crumb sits in waves on the meat — the sign that it has not been glued on.'
  WHERE id = 'klassiker-1-2';

-- klassiker-1-3 — Garnelenpfanne
UPDATE menu_items SET
    geschichte = 'Garnelen, Grillgemüse und Basmatireis kommen zusammen in die Pfanne, damit der Sud in den Reis geht.',
    geschichte_en = 'Prawns, grilled vegetables and basmati rice go into the pan together, so the juices run into the rice.'
  WHERE id = 'klassiker-1-3';

-- klassiker-1-4 — Fleischpfanne
UPDATE menu_items SET
    garstufe = 'Die Streifen kommen zuletzt dazu und bleiben rosa — durchgebraten auf Wunsch.',
    garstufe_en = 'The strips go in last and stay pink — well done on request.',
    wein = 'Lemberger, 0,2 l'
  WHERE id = 'klassiker-1-4';

-- klassiker-1-5 — Lachsfilet
UPDATE menu_items SET
    garstufe = 'Innen glasig — wer durch möchte, sagt es bitte dazu.',
    garstufe_en = 'Translucent inside — if you prefer it cooked through, please say so.',
    geschichte = 'Auf der Hautseite angebraten, dann fertig gezogen. Dazu Blattspinat und eine Weißwein-Soße, die wir mit demselben Wein ansetzen, den es im Glas gibt.',
    geschichte_en = 'Seared on the skin side, then finished gently. Served with leaf spinach and a white wine sauce made with the same wine we pour by the glass.'
  WHERE id = 'klassiker-1-5';

-- klassiker-1-6 — Rostbraten
UPDATE menu_items SET
    herkunft = 'Unser Rindfleisch kommt aus Argentinien, der Lemberger aus der Nachbarschaft.',
    herkunft_en = 'Our beef comes from Argentina, the Lemberger from the neighbourhood.',
    garstufe = 'Dazu handgeschabte Spätzle oder Bratkartoffeln, und eine Maultasche liegt ohnehin mit auf dem Teller.',
    garstufe_en = 'With hand-scraped Spätzle or fried potatoes, and a Maultasche is on the plate in any case.'
  WHERE id = 'klassiker-1-6';

-- klassiker-1-7 — Wiener Schnitzel vom Kalb
UPDATE menu_items SET
    garstufe = 'Preiselbeeren gehören dazu, Zitrone auf Wunsch.',
    garstufe_en = 'Cranberries belong with it, lemon on request.',
    wein = 'Weißburgunder'
  WHERE id = 'klassiker-1-7';

-- klassiker-1-8 — Doradenfilet
UPDATE menu_items SET
    geschichte = 'Dorade filetiert, auf der Haut gebraten, dazu eine Honig-Senf-Soße, die wir selbst anrühren.',
    geschichte_en = 'Sea bream, filleted and fried on the skin, with a honey-mustard sauce we mix ourselves.'
  WHERE id = 'klassiker-1-8';

-- steak-1-1 — Hüftesteak
UPDATE menu_items SET
    reifung = 'Am Stück gereift, erst kurz vor dem Service portioniert.',
    reifung_en = 'Aged as a whole cut, portioned only shortly before service.',
    garstufe = 'Aus der Hüfte: wenig Fett, dafür der kräftigste Fleischgeschmack der drei Zuschnitte. Auf dem Stein bis rosa, nicht weiter.',
    garstufe_en = 'From the rump: little fat, but the strongest beef flavour of the three cuts. On the stone until pink, no further.'
  WHERE id = 'steak-1-1';

-- steak-1-2 — Rumpsteak
UPDATE menu_items SET
    reifung = 'Am Stück gereift, erst kurz vor dem Service portioniert.',
    reifung_en = 'Aged as a whole cut, portioned only shortly before service.',
    garstufe = 'Der Fettrand ist kein Versehen: Er schmilzt auf dem Stein und würzt jede Scheibe von selbst. Bitte erst probieren, dann entscheiden, ob er weg soll.',
    garstufe_en = 'The fat edge is not an oversight: it melts on the stone and seasons every slice by itself. Please try it before deciding to cut it away.'
  WHERE id = 'steak-1-2';

-- steak-1-3 — Filet
UPDATE menu_items SET
    reifung = 'Am Stück gereift, erst kurz vor dem Service portioniert.',
    reifung_en = 'Aged as a whole cut, portioned only shortly before service.',
    garstufe = 'Das zarteste Stück vom Rind, aus der Mitte geschnitten und ohne Sehne. Rosa vom Stein nehmen — auf dem heißen Stein gart jede Scheibe noch weiter.',
    garstufe_en = 'The most tender cut of beef, taken from the centre and free of sinew. Take it off pink — on the hot stone every slice keeps cooking.'
  WHERE id = 'steak-1-3';

-- steak-2-1 — Hamburger
UPDATE menu_items SET
    herkunft = 'Das Rindfleisch für die Patties kommt aus Argentinien.',
    herkunft_en = 'The beef for the patties comes from Argentina.',
    garstufe = 'Wer es ganz durch möchte, sagt es bitte bei der Bestellung.',
    garstufe_en = 'If you want it well done, please say so when ordering.',
    geschichte = 'Das Patty drehen wir selbst aus grob gewolftem Rind — nur Fleisch, Salz und Pfeffer. Gebraten wird es auf den Punkt, nicht durch.',
    geschichte_en = 'We shape the patty ourselves from coarsely minced beef — meat, salt and pepper, nothing else. It is cooked to the point, not through.'
  WHERE id = 'steak-2-1';

-- steak-2-2 — Cheeseburger
UPDATE menu_items SET
    herkunft = 'Das Rindfleisch für die Patties kommt aus Argentinien.',
    herkunft_en = 'The beef for the patties comes from Argentina.',
    geschichte = 'Cheddar kommt auf das Patty, solange es noch in der Pfanne liegt — so schmilzt er richtig statt nur weich zu werden.',
    geschichte_en = 'The cheddar goes onto the patty while it is still in the pan — that way it truly melts instead of merely softening.'
  WHERE id = 'steak-2-2';

-- steak-2-3 — Chili-Cheeseburger
UPDATE menu_items SET
    herkunft = 'Das Rindfleisch für die Patties kommt aus Argentinien.',
    herkunft_en = 'The beef for the patties comes from Argentina.',
    geschichte = 'Cheddar und eingelegte Jalapeños. Die Schärfe kommt aus dem Sud der Jalapeños, nicht aus einer Soße.',
    geschichte_en = 'Cheddar and pickled jalapeños. The heat comes from the pickling liquor, not from a sauce.'
  WHERE id = 'steak-2-3';

-- steak-2-4 — BBQ-Burger
UPDATE menu_items SET
    herkunft = 'Das Rindfleisch für die Patties kommt aus Argentinien.',
    herkunft_en = 'The beef for the patties comes from Argentina.',
    geschichte = 'Bacon wird knusprig ausgelassen, die BBQ-Soße setzen wir selbst an — rauchig, aber nicht süß.',
    geschichte_en = 'The bacon is rendered until crisp, and we make the BBQ sauce ourselves — smoky, but not sweet.'
  WHERE id = 'steak-2-4';

-- steak-2-5 — Veggie-Burger
UPDATE menu_items SET
    geschichte = 'Das Patty ist vegetarisch, gebraten wird es in einer eigenen Pfanne — nicht auf derselben Fläche wie das Fleisch.',
    geschichte_en = 'The patty is vegetarian and fried in its own pan — not on the same surface as the meat.'
  WHERE id = 'steak-2-5';

-- steak-2-6 — Patty extra
UPDATE menu_items SET
    geschichte = 'Ein zweites Patty für den Burger Ihrer Wahl.',
    geschichte_en = 'A second patty for the burger of your choice.'
  WHERE id = 'steak-2-6';

-- steak-3-1 — Pommes
UPDATE menu_items SET
    geschichte = 'Frittiert, gesalzen, sonst nichts.',
    geschichte_en = 'Fried, salted, nothing else.'
  WHERE id = 'steak-3-1';

-- steak-3-2 — Süßkartoffel-Pommes
UPDATE menu_items SET
    geschichte = 'Unsere Empfehlung zum Steak vom Stein — die Süße hält gegen das kräftige Fleisch.',
    geschichte_en = 'Our recommendation with steak from the stone — the sweetness holds up against the strong meat.'
  WHERE id = 'steak-3-2';

-- steak-3-3 — Gemüse
UPDATE menu_items SET
    geschichte = 'Saisonales Gemüse vom Grill, erst auf Bestellung.',
    geschichte_en = 'Seasonal vegetables from the grill, cooked to order.'
  WHERE id = 'steak-3-3';

-- steak-3-4 — Salat
UPDATE menu_items SET
    geschichte = 'Der kleine gemischte Salat vorweg: Blattsalate, Gurke, Tomate, unser Hausdressing.',
    geschichte_en = 'The small mixed salad to start: leaf salads, cucumber, tomato, our house dressing.'
  WHERE id = 'steak-3-4';

-- suesses-1-1 — Portion Vanilleeis
UPDATE menu_items SET
    geschichte = 'Zwei Kugeln, dazu Schokoladen- oder Beerensoße — beide aus unserer Küche.',
    geschichte_en = 'Two scoops with chocolate or berry sauce — both from our kitchen.'
  WHERE id = 'suesses-1-1';

-- suesses-1-3 — Crème brûlée
UPDATE menu_items SET
    garstufe = 'Einmal kräftig mit dem Löffel durchschlagen, dann haben Sie beides in einem Bissen.',
    garstufe_en = 'Crack it firmly with the spoon once, and you get both in one bite.'
  WHERE id = 'suesses-1-3';

-- suesses-1-4 — Heiße Beeren
UPDATE menu_items SET
    geschichte = 'Beeren heiß, Eis kalt, Sahne dazwischen. Der halbe Reiz ist der Temperaturunterschied.',
    geschichte_en = 'Berries hot, ice cream cold, cream in between. Half the appeal is the difference in temperature.'
  WHERE id = 'suesses-1-4';

-- teigwaren-1-1 — Pasta Arrabbiata
UPDATE menu_items SET
    garstufe = 'Auf Wunsch drehen wir die Schärfe herunter.',
    garstufe_en = 'We will tone down the heat on request.',
    geschichte = 'Tomate, Knoblauch, Chili, Olivenöl. Scharf ist sie mit Absicht — arrabbiata heißt wörtlich „zornig“.',
    geschichte_en = 'Tomato, garlic, chilli, olive oil. It is meant to be hot — arrabbiata literally means angry.'
  WHERE id = 'teigwaren-1-1';

-- teigwaren-1-2 — Pasta Caprese
UPDATE menu_items SET
    wein = 'Riesling, 0,2 l',
    geschichte = 'Büffelmozzarella kommt erst zum Schluss in die Tomaten-Sahne-Soße, damit er weich wird statt zäh.',
    geschichte_en = 'The buffalo mozzarella goes into the tomato cream sauce only at the end, so it turns soft instead of stringy.'
  WHERE id = 'teigwaren-1-2';

-- teigwaren-1-3 — Pasta Veggie
UPDATE menu_items SET
    wein = 'Grauburgunder',
    geschichte = 'Dasselbe Grillgemüse wie im Veggie-Salat, hier in Tomaten-Sahne-Soße. Wir grillen es frisch, es kommt nicht aus dem Glas.',
    geschichte_en = 'The same grilled vegetables as in the veggie salad, here in tomato cream sauce. We grill them fresh; they do not come out of a jar.'
  WHERE id = 'teigwaren-1-3';

-- teigwaren-1-4 — Pasta Gambas
UPDATE menu_items SET
    wein = 'Sauvignon Blanc',
    geschichte = 'Garnelen in Limetten-Sahne-Soße. Die Limette kommt als Saft und als Abrieb hinein — der Abrieb macht den Duft, der Saft die Säure.',
    geschichte_en = 'Prawns in a lime cream sauce. The lime goes in as juice and as zest — the zest gives the aroma, the juice the acidity.'
  WHERE id = 'teigwaren-1-4';

-- teigwaren-1-5 — Pasta Omega
UPDATE menu_items SET
    wein = 'Chardonnay, Weingut Faigle',
    geschichte = 'Lachsfilet und Blattspinat in Weißwein-Sahne-Soße. Der Weißwein darin ist derselbe, den Sie auch im Glas bekommen.',
    geschichte_en = 'Salmon fillet and leaf spinach in a white wine cream sauce. The white wine in it is the same one you get by the glass.'
  WHERE id = 'teigwaren-1-5';

-- teigwaren-1-6 — Pasta Steakhouse
UPDATE menu_items SET
    garstufe = 'Die Rinderstreifen kommen zuletzt in die Pfanne, damit sie saftig bleiben.',
    garstufe_en = 'The beef strips go into the pan last, so they stay juicy.',
    wein = 'Lemberger, 0,2 l'
  WHERE id = 'teigwaren-1-6';

-- teigwaren-2-1 — Portion Spätzle
UPDATE menu_items SET
    garstufe = 'Als Beilage zu Rostbraten und Schnitzel die naheliegendste Wahl.',
    garstufe_en = 'The obvious choice as a side for Rostbraten and Schnitzel.'
  WHERE id = 'teigwaren-2-1';

-- teigwaren-2-2 — Käsespätzle
UPDATE menu_items SET
    wein = 'Trollinger-Lemberger, 0,2 l'
  WHERE id = 'teigwaren-2-2';

-- teigwaren-2-3 — Maultaschen
UPDATE menu_items SET
    garstufe = 'In der Brühe gibt es sie auch: in der Rinderkraftbrühe.',
    garstufe_en = 'You can also have them in broth: in the beef consommé.',
    wein = 'Lemberger, 0,2 l'
  WHERE id = 'teigwaren-2-3';

-- teigwaren-2-4 — Manti
UPDATE menu_items SET
    garstufe = 'Kommen mit heißer Butter und Tomatenmark übergossen an den Tisch — bitte gleich essen, sie kühlen schnell aus.',
    garstufe_en = 'They arrive with hot butter and tomato paste poured over — please eat straight away, they cool quickly.',
    wein = 'Lemberger Weißherbst, 0,2 l'
  WHERE id = 'teigwaren-2-4';

-- vorspeisen-1-1 — Tomatencremesuppe
UPDATE menu_items SET
    garstufe = 'Mit unserem Brot, solange es noch warm ist.',
    garstufe_en = 'With our bread, while it is still warm.',
    geschichte = 'Reife Tomaten, etwas Sahne, ein Blatt Basilikum obendrauf. Mehr ist nicht drin und mehr braucht sie auch nicht.',
    geschichte_en = 'Ripe tomatoes, a little cream, a basil leaf on top. Nothing else in it, and nothing else needed.'
  WHERE id = 'vorspeisen-1-1';

-- vorspeisen-1-2 — Linsensuppe
UPDATE menu_items SET
    wein = 'Trollinger-Lemberger, 0,2 l',
    geschichte = 'Schwäbisch angesetzt, mit Wurzelgemüse und einem Schuss Essig zum Schluss. Sie steht auf der Karte, weil hier in der Gegend jeder mit ihr groß geworden ist.',
    geschichte_en = 'Made the Swabian way, with root vegetables and a dash of vinegar at the end. It is on the menu because everyone around here grew up with it.'
  WHERE id = 'vorspeisen-1-2';

-- vorspeisen-1-3 — Rinderkraftbrühe
UPDATE menu_items SET
    herkunft = 'Unser Rindfleisch kommt aus Argentinien.',
    herkunft_en = 'Our beef comes from Argentina.',
    garstufe = 'Die Tasse zuerst, die Maultasche zuletzt — sonst zieht sie sich voll.',
    garstufe_en = 'Broth first, the Maultasche last — otherwise it soaks through.'
  WHERE id = 'vorspeisen-1-3';

-- vorspeisen-2-2 — Bruschetta
UPDATE menu_items SET
    wein = 'Riesling, 0,2 l',
    geschichte = 'Geröstetes Landbrot, Tomatenwürfel mit Knoblauch und Olivenöl, frischer Rucola darüber. Belegt wird erst nach Ihrer Bestellung — sonst weicht das Brot durch.',
    geschichte_en = 'Toasted country bread, diced tomato with garlic and olive oil, fresh rocket on top. We top it only after you order — otherwise the bread goes soft.'
  WHERE id = 'vorspeisen-2-2';

-- vorspeisen-2-3 — Büffelmozzarella
UPDATE menu_items SET
    wein = 'Weißburgunder'
  WHERE id = 'vorspeisen-2-3';

-- vorspeisen-2-4 — Buratta
UPDATE menu_items SET
    garstufe = 'Kommt bewusst nicht eiskalt auf den Tisch. Kalt schmeckt Burrata nach nichts.',
    garstufe_en = 'Deliberately not served ice-cold. Cold burrata tastes of nothing.',
    wein = 'Chardonnay, Weingut Faigle',
    geschichte = 'Burrata ist Mozzarella mit einem Kern aus Rahm — beim Aufschneiden läuft er aus. Dazu gebratene Zucchini, Kirschtomaten, Rucola und geröstete Pinienkerne.',
    geschichte_en = 'Burrata is mozzarella with a cream centre — it runs out when you cut it open. Served with fried courgette, cherry tomatoes, rocket and toasted pine nuts.'
  WHERE id = 'vorspeisen-2-4';

-- vorspeisen-2-5 — Garnelen
UPDATE menu_items SET
    garstufe = 'Nehmen Sie Brot dazu — das Öl im Topf ist der halbe Gang.',
    garstufe_en = 'Take bread with it — the oil left in the pot is half the dish.',
    wein = 'Sauvignon Blanc',
    geschichte = 'Im Tontopf mit Knoblauch, Olivenöl und Chili. Der Topf kommt heiß an den Tisch und brutzelt dort noch eine Weile weiter.',
    geschichte_en = 'In a clay pot with garlic, olive oil and chilli. The pot arrives hot at the table and keeps sizzling for a while.'
  WHERE id = 'vorspeisen-2-5';

-- vorspeisen-2-6 — Carpaccio
UPDATE menu_items SET
    herkunft = 'Unser Rindfleisch kommt aus Argentinien.',
    herkunft_en = 'Our beef comes from Argentina.',
    garstufe = 'Wird kurz vor dem Servieren aufgeschnitten, nicht vorbereitet.',
    garstufe_en = 'Sliced just before serving, never prepared in advance.',
    wein = 'Lemberger, 0,2 l'
  WHERE id = 'vorspeisen-2-6';

-- vorspeisen-3-1 — Salat Schwäbisch
UPDATE menu_items SET
    wein = 'Riesling, 0,2 l',
    geschichte = 'Blattsalate mit zwei hausgemachten Maultaschen, in Butter angebraten und in Streifen darauf gelegt. Der schwäbische Weg, einen Salat sättigend zu machen.',
    geschichte_en = 'Leaf salads with two house-made Maultaschen, fried in butter and sliced over the top. The Swabian way of turning a salad into a meal.'
  WHERE id = 'vorspeisen-3-1';

-- vorspeisen-3-2 — Salat Veggie
UPDATE menu_items SET
    wein = 'Grauburgunder',
    geschichte = 'Gegrilltes Gemüse kommt warm auf die kalten Blätter, dazu Feta. Das Gemüse grillen wir erst auf Bestellung, deshalb dauert der Salat etwas länger als die anderen.',
    geschichte_en = 'Grilled vegetables go warm onto the cold leaves, with feta. We grill the vegetables to order, so this salad takes a little longer than the others.'
  WHERE id = 'vorspeisen-3-2';

-- vorspeisen-3-3 — Salat Gambas
UPDATE menu_items SET
    wein = 'Muskat-Trollinger, Weingut Faigle',
    geschichte = 'Garnelen kurz und heiß gebraten, dazu frische Ananas. Die Süße der Ananas gegen das Salzige der Garnele — das ist der ganze Trick.',
    geschichte_en = 'Prawns fried briefly over high heat, with fresh pineapple. The sweetness of the pineapple against the salt of the prawn — that is the whole trick.'
  WHERE id = 'vorspeisen-3-3';

-- vorspeisen-3-4 — Salat Omega
UPDATE menu_items SET
    wein = 'Chardonnay, Weingut Faigle',
    geschichte = 'Lachsfilet auf den Punkt gebraten, Avocado in Spalten dazu. Der Lachs bleibt innen glasig — wer ihn durch möchte, sagt es bitte beim Bestellen.',
    geschichte_en = 'Salmon fillet cooked to the point, avocado in wedges alongside. The salmon stays translucent inside — if you would like it cooked through, please say so when ordering.'
  WHERE id = 'vorspeisen-3-4';

-- vorspeisen-3-5 — Salat Steakhouse
UPDATE menu_items SET
    garstufe = 'Die Streifen kommen warm auf den kalten Salat. Wer sie durchgebraten mag, sagt es bitte dazu.',
    garstufe_en = 'The strips go warm onto the cold salad. If you prefer them well done, please say so.',
    wein = 'Trollinger-Lemberger, 0,2 l'
  WHERE id = 'vorspeisen-3-5';

-- vorspeisen-3-6 — Salat Wien
UPDATE menu_items SET
    wein = 'Weißburgunder',
    geschichte = 'Vom selben Kalbsrücken wie das Wiener Schnitzel, nur in Streifen geschnitten und paniert. Dieselbe Panade, dieselbe Pfanne.',
    geschichte_en = 'From the same veal loin as the Wiener Schnitzel, only cut into strips and breaded. Same crumb, same pan.'
  WHERE id = 'vorspeisen-3-6';
