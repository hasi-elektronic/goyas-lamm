-- Stammdaten für den Wareneingang, abgeleitet aus der Live-Speisekarte
-- (132 Gerichte, Stand 2026-08-27).
--
-- Zwei Sorten Einträge:
--   * Was auf der Karte NAMENTLICH steht — Rumpsteak, Lachsfilet, Burrata,
--     Rucola, die Weine, die Fassbiere: 1:1 übernommen.
--   * Was sich aus den Beschreibungen ERGIBT — Sahne für die Sahne-Soßen, Mehl
--     und Eier für hausgemachte Spätzle und Maultaschen, Semmelbrösel für die
--     Panade: das ist eine Ableitung, kein Fakt. Gökhan soll durchgehen und
--     auslisten, was nicht stimmt.
--
-- Bewusst NICHT angelegt: die Spirituosenkarte und die Cocktailzutaten. Über
-- dreißig Flaschen mit geringem Umschlag würden die Auswahl beim Erfassen
-- aufblähen, ohne beim Wareneinsatz etwas zu bewegen. Kommen später, wenn die
-- Bar mitgezählt werden soll.
--
-- Die Einheit ist die EINKAUFSEINHEIT, nicht die Ausschankeinheit: Fassbier in
-- Litern, Flaschenbier und Limonade in Kisten, Wein je Flasche.
--
-- Reihenfolge (`sort`) ist so gewählt, dass in jeder Warengruppe die teuren
-- Positionen oben stehen.

INSERT INTO suppliers (id,name,kundennr,kontakt,telefon,email,note,active,sort,created_at) VALUES ('l1a0432db17e000173b3','Metzgerei Seyb',NULL,NULL,NULL,NULL,'Auf der Speisekarte namentlich genannt (Schweizer Wurstsalat).',1,0,'2026-08-27T12:30:00.000Z');
INSERT INTO suppliers (id,name,kundennr,kontakt,telefon,email,note,active,sort,created_at) VALUES ('l1a0432db17e00021057','Hochdorfer Kronenbrauerei',NULL,NULL,NULL,NULL,'Fassbier und Flaschenbiere laut Karte.',1,0,'2026-08-27T12:30:00.000Z');
INSERT INTO suppliers (id,name,kundennr,kontakt,telefon,email,note,active,sort,created_at) VALUES ('l1a0432db17e00033a59','Weingut Allmendinger',NULL,NULL,NULL,NULL,'Riesling, Weißburgunder, Spätburgunder, Trollinger-Lemberger, Lemberger.',1,0,'2026-08-27T12:30:00.000Z');
INSERT INTO suppliers (id,name,kundennr,kontakt,telefon,email,note,active,sort,created_at) VALUES ('l1a0432db17e0004e898','Weingärtner',NULL,NULL,NULL,NULL,'Traminer, Lemberger Weißherbst, Merlot rosé.',1,0,'2026-08-27T12:30:00.000Z');
INSERT INTO suppliers (id,name,kundennr,kontakt,telefon,email,note,active,sort,created_at) VALUES ('l1a0432db17e00050459','Weingut Faigle',NULL,NULL,NULL,NULL,'Chardonnay, Muskat-Trollinger.',1,0,'2026-08-27T12:30:00.000Z');
INSERT INTO suppliers (id,name,kundennr,kontakt,telefon,email,note,active,sort,created_at) VALUES ('l1a0432db17e00063196','Der Fischer',NULL,NULL,NULL,NULL,'Grauburgunder, Syrah.',1,0,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0007c5cd','Rinderfilet','fleisch','kg',NULL,'fleisch','Kühlhaus',1,10,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0008a7d1','Rumpsteak','fleisch','kg',NULL,'fleisch','Kühlhaus',1,11,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0009e87f','Hüftsteak','fleisch','kg',NULL,'fleisch','Kühlhaus',1,12,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e000a15e6','Rostbraten','fleisch','kg',NULL,'fleisch','Kühlhaus',1,13,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e000b0d31','Rindersteakstreifen','fleisch','kg',NULL,'fleisch','Kühlhaus',1,14,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e000c0d8d','Kalbsrücken','fleisch','kg',NULL,'fleisch','Kühlhaus',1,15,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e000dfc5a','Schweinerücken','fleisch','kg',NULL,'fleisch','Kühlhaus',1,16,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e000eb0d5','Rinderhackfleisch','fleisch','kg',NULL,'hack','Kühlhaus',1,17,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e000fdf54','Burger-Patty','fleisch','stk',NULL,'tk','Tiefkühl',1,18,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00102359','Bacon','fleisch','kg',NULL,'zub','Kühlhaus',1,19,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0011847f','Wurst für Wurstsalat','fleisch','kg','l1a0432db17e000173b3','zub','Kühlhaus',1,20,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0012275f','Suppenfleisch & Rinderknochen','fleisch','kg',NULL,'fleisch','Kühlhaus',1,21,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0013e4c6','Lachsfilet','fisch','kg',NULL,'fisch','Kühlhaus',1,30,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0014b8ab','Doradenfilet','fisch','kg',NULL,'fisch','Kühlhaus',1,31,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0015ea87','Garnelen','fisch','kg',NULL,'tk','Tiefkühl',1,32,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0016a7c0','Büffelmozzarella','molkerei','kg',NULL,'molkerei','Kühlhaus',1,40,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00173a06','Burrata','molkerei','kg',NULL,'molkerei','Kühlhaus',1,41,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00180a65','Feta','molkerei','kg',NULL,'molkerei','Kühlhaus',1,42,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0019f9a0','Grana Padano','molkerei','kg',NULL,'molkerei','Kühlhaus',1,43,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e001a79a1','Emmentaler','molkerei','kg',NULL,'molkerei','Kühlhaus',1,44,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e001be234','Bergkäse','molkerei','kg',NULL,'molkerei','Kühlhaus',1,45,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e001cd041','Cheddar','molkerei','kg',NULL,'molkerei','Kühlhaus',1,46,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e001d514a','Sahne','molkerei','l',NULL,'molkerei','Kühlhaus',1,47,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e001e9198','Butter','molkerei','kg',NULL,'molkerei','Kühlhaus',1,48,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e001f7bb2','Naturjoghurt','molkerei','kg',NULL,'molkerei','Kühlhaus',1,49,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00208046','Milch','molkerei','l',NULL,'molkerei','Kühlhaus',1,50,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0021341a','Eier','molkerei','stk',NULL,'ei','Kühlhaus',1,51,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00227f64','Rucola','obst','kg',NULL,NULL,'Küche',1,60,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00236a8d','Blattsalat','obst','kg',NULL,NULL,'Küche',1,61,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00240dba','Tomaten','obst','kg',NULL,NULL,'Küche',1,62,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e002599c0','Kirschtomaten','obst','kg',NULL,NULL,'Küche',1,63,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00267c72','Zucchini','obst','kg',NULL,NULL,'Küche',1,64,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00279708','Grillgemüse (Paprika, Aubergine)','obst','kg',NULL,NULL,'Küche',1,65,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00284949','Spinat','obst','kg',NULL,NULL,'Küche',1,66,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00299f37','Avocado','obst','stk',NULL,NULL,'Küche',1,67,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e002af573','Ananas','obst','stk',NULL,NULL,'Küche',1,68,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e002bcf53','Zwiebeln','obst','kg',NULL,NULL,'Trockenlager',1,69,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e002cf3f1','Knoblauch','obst','kg',NULL,NULL,'Küche',1,70,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e002d4d87','Kartoffeln','obst','kg',NULL,NULL,'Trockenlager',1,71,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e002e5edf','Zitronen','obst','kg',NULL,NULL,'Küche',1,72,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e002f01d4','Limetten','obst','kg',NULL,NULL,'Küche',1,73,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00301acd','Orangen','obst','kg',NULL,NULL,'Küche',1,74,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0031386e','Erdbeeren','obst','kg',NULL,NULL,'Küche',1,75,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0032450f','Bananen','obst','kg',NULL,NULL,'Küche',1,76,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00330c67','Basilikum','obst','stk',NULL,NULL,'Küche',1,77,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e003408ca','Pommes frites','tk','kg',NULL,'tk','Tiefkühl',1,80,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00352e42','Süßkartoffel-Pommes','tk','kg',NULL,'tk','Tiefkühl',1,81,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0036fe3c','Vanilleeis','tk','l',NULL,'tk','Tiefkühl',1,82,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00370fcc','Beerenmischung','tk','kg',NULL,'tk','Tiefkühl',1,83,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00380e7e','Veggie-Patty','tk','stk',NULL,'tk','Tiefkühl',1,84,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00394a4f','Penne','trocken','kg',NULL,NULL,'Trockenlager',1,90,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e003a8db1','Basmati-Reis','trocken','kg',NULL,NULL,'Trockenlager',1,91,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e003bfb11','Mehl','trocken','kg',NULL,NULL,'Trockenlager',1,92,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e003cc2aa','Semmelbrösel','trocken','kg',NULL,NULL,'Trockenlager',1,93,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e003d032d','Olivenöl','trocken','l',NULL,NULL,'Trockenlager',1,94,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e003e2f9f','Frittieröl','trocken','l',NULL,NULL,'Trockenlager',1,95,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e003fabf6','Pinienkerne','trocken','kg',NULL,NULL,'Trockenlager',1,96,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0040e3fd','Haselnüsse','trocken','kg',NULL,NULL,'Trockenlager',1,97,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00413251','Burger-Buns','trocken','stk',NULL,NULL,'Küche',1,98,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0042b90e','Passierte Tomaten','trocken','kg',NULL,NULL,'Trockenlager',1,99,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0043d46e','BBQ-Soße','trocken','l',NULL,NULL,'Trockenlager',1,100,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00443030','Preiselbeeren','trocken','kg',NULL,NULL,'Trockenlager',1,101,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00455cf6','Linsen','trocken','kg',NULL,NULL,'Trockenlager',1,102,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00464496','Jalapeños','trocken','kg',NULL,NULL,'Trockenlager',1,103,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0047af7e','Espressobohnen','trocken','kg',NULL,NULL,'Trockenlager',1,104,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0048862b','Tee Sternschnuppe','trocken','packung',NULL,NULL,'Trockenlager',1,105,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00499260','Fassbier Pils','getraenke','l','l1a0432db17e00021057',NULL,'Getränkelager',1,110,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e004acf34','Fassbier Helles','getraenke','l','l1a0432db17e00021057',NULL,'Getränkelager',1,111,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e004b6b0c','Fassbier Weizen naturtrüb','getraenke','l','l1a0432db17e00021057',NULL,'Getränkelager',1,112,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e004c3205','Kristallweizen 0,5 l','getraenke','kiste','l1a0432db17e00021057',NULL,'Getränkelager',1,115,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e004da69c','Keller-Gold 0,5 l','getraenke','kiste','l1a0432db17e00021057',NULL,'Getränkelager',1,116,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e004e26cb','Naturradler 0,33 l','getraenke','kiste','l1a0432db17e00021057',NULL,'Getränkelager',1,117,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e004fb72d','Helles alkoholfrei 0,5 l','getraenke','kiste','l1a0432db17e00021057',NULL,'Getränkelager',1,118,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005043de','Sportweizen alkoholfrei 0,5 l','getraenke','kiste','l1a0432db17e00021057',NULL,'Getränkelager',1,119,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005118f4','Riesling','getraenke','flasche','l1a0432db17e00033a59',NULL,'Getränkelager',1,125,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005257f1','Weißburgunder','getraenke','flasche','l1a0432db17e00033a59',NULL,'Getränkelager',1,126,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0053dfe9','Spätburgunder rosé','getraenke','flasche','l1a0432db17e00033a59',NULL,'Getränkelager',1,127,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0054dfa0','Trollinger-Lemberger','getraenke','flasche','l1a0432db17e00033a59',NULL,'Getränkelager',1,128,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00557d74','Lemberger','getraenke','flasche','l1a0432db17e00033a59',NULL,'Getränkelager',1,129,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00565c40','Traminer','getraenke','flasche','l1a0432db17e0004e898',NULL,'Getränkelager',1,130,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0057e439','Lemberger Weißherbst','getraenke','flasche','l1a0432db17e0004e898',NULL,'Getränkelager',1,131,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0058b941','Merlot rosé','getraenke','flasche','l1a0432db17e0004e898',NULL,'Getränkelager',1,132,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00597a84','Chardonnay','getraenke','flasche','l1a0432db17e00050459',NULL,'Getränkelager',1,133,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005a7122','Muskat-Trollinger','getraenke','flasche','l1a0432db17e00050459',NULL,'Getränkelager',1,134,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005b321c','Grauburgunder','getraenke','flasche','l1a0432db17e00063196',NULL,'Getränkelager',1,135,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005cbf39','Syrah','getraenke','flasche','l1a0432db17e00063196',NULL,'Getränkelager',1,136,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005df0ea','Sauvignon Blanc','getraenke','flasche',NULL,NULL,'Getränkelager',1,137,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005ee533','Sekt Hausmarke','getraenke','flasche',NULL,NULL,'Getränkelager',1,140,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e005f0191','Zardetto Frizzante','getraenke','flasche',NULL,NULL,'Getränkelager',1,141,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0060ca66','Zardetto Spumante','getraenke','flasche',NULL,NULL,'Getränkelager',1,142,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00617d8c','Zardetto Rosé','getraenke','flasche',NULL,NULL,'Getränkelager',1,143,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0062ad95','Ensinger Bio-Gourmet still','getraenke','kiste',NULL,NULL,'Getränkelager',1,150,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00639cb8','Ensinger Bio-Gourmet medium','getraenke','kiste',NULL,NULL,'Getränkelager',1,151,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0064aa2f','Afri Cola 0,33 l','getraenke','kiste',NULL,NULL,'Getränkelager',1,152,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0065de68','Afri Cola ohne Zucker 0,33 l','getraenke','kiste',NULL,NULL,'Getränkelager',1,153,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0066816d','Bluna Orange 0,33 l','getraenke','kiste',NULL,NULL,'Getränkelager',1,154,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0067ea7d','Afri Zitrone 0,33 l','getraenke','kiste',NULL,NULL,'Getränkelager',1,155,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e0068fa9c','Schweppes Tonic 0,2 l','getraenke','kiste',NULL,NULL,'Bar',1,156,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e00694ee1','Schweppes Bitter Lemon 0,2 l','getraenke','kiste',NULL,NULL,'Bar',1,157,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e006ae411','Schweppes Ginger Ale 0,2 l','getraenke','kiste',NULL,NULL,'Bar',1,158,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e006be779','Schweppes Wildberry 0,2 l','getraenke','kiste',NULL,NULL,'Bar',1,159,'2026-08-27T12:30:00.000Z');
INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at) VALUES ('a1a0432db17e006ce986','Kumpf Säfte & Nektare 0,2 l','getraenke','kiste',NULL,NULL,'Getränkelager',1,160,'2026-08-27T12:30:00.000Z');
