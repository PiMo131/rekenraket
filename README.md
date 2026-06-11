# RekenRaket 🚀

Een statische, gamified webapp waarmee kinderen (± 6–10 jaar) **rekenvaardigheid** oefenen: optellen, aftrekken, de tafels van 1 t/m 10 en de bijbehorende deelsommen. Geen account, geen backend, geen database — alles draait lokaal in de browser.

## Snel starten (lokaal)

De app gebruikt ES-modules, dus `index.html` direct openen via `file://` werkt niet. Start een mini-webserver in de projectmap:

```bash
# Python
python -m http.server 8000

# of Node
npx serve .
```

Open daarna `http://localhost:8000`.

## Deployen op GitHub Pages

1. Maak een repository en push deze map (met `index.html` in de root).
2. Ga naar **Settings → Pages**.
3. Kies **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Klaar: `https://<gebruikersnaam>.github.io/<repo>/`

Alle paden in de app zijn relatief (`./css/...`, `./js/...`), dus de app werkt ook in een sub-pad zoals `/<repo>/` zonder aanpassingen. Er is geen build-stap.

## Bestandsstructuur

```
rekenraket/
├── index.html          # alle schermen (welkom, home, spel, samenvatting, ...)
├── css/
│   ├── fonts.css       # lokaal gehoste fonts (geen externe afhankelijkheden)
│   └── style.css       # ruimte-thema, mobile-first, reduced-motion
├── fonts/              # Fredoka & Nunito (variabele woff2, latin)
└── js/
    ├── app.js          # schermen, spel-lus, invoer (numpad + toetsenbord)
    ├── questions.js    # somgeneratie per categorie en level
    ├── engine.js       # adaptieve vraagmotor (mastery, gewogen selectie)
    ├── code.js         # geheime voortgangscodes (base32 + checksum)
    ├── storage.js      # localStorage-laag
    └── minigame.js     # speelpauze: Slang (Snake)
```

## Hoe de levels werken

**Plus/min (level 1–6):** t/m 5 → t/m 10 → t/m 20 → tientaloverschrijding → t/m 50 → t/m 100. Minsommen worden nooit negatief.

**Keer/delen (level 1–4):** tafels 1, 2, 5, 10 → + 3, 4, 6 → + 7, 8, 9 → alles door elkaar. Deelsommen zijn altijd kloppend (rest 0). Hogere levels bevatten ook de eerdere tafels: de adaptieve motor zorgt vanzelf dat nieuwe (zwakke) sommen vaker langskomen dan beheerste.

**Level omhoog:** pas na **2 rondes op rij met ≥ 80% in één keer goed**. Eén goede ronde is dus geen bewijs van beheersing.

**Level omlaag:** gaat het 3 rondes op rij moeizaam (< 50% in één keer goed), dan biedt het samenvattingsscherm aan om "even bij te tanken" op een level lager. De keuze blijft aan het kind; er gaat nooit ongevraagd iets omlaag.

Daarnaast is er de **tafels-kiezer**: het kind (of de leraar) vinkt zelf tafels 1 t/m 10 aan en oefent die als keersommen in de vorm zoals op school geleerd (`1 × 7` t/m `10 × 7`). Handig voor "deze week oefenen we de tafel van 7". Deelsommen zitten in de klassieke modus.

## De adaptieve vraagmotor (`engine.js`)

Per som (een "feit", bijv. `m:7x8`) wordt bijgehouden:

| veld | betekenis |
|------|-----------|
| `n`  | aantal pogingen |
| `c`  | aantal keer goed |
| `t`  | gemiddelde antwoordtijd (exponentieel gemiddelde) |
| `m`  | beheersingsscore 0–5 |
| `w`  | "recent fout"-teller |

- **Selectie:** rondes worden samengesteld met gewogen trekking; gewicht ≈ `(6 − mastery)² + foutbonus`. Zwakke en nieuwe sommen komen dus vaak terug, beheerste sommen af en toe (mix van bekend en nieuw).
- **Herhaling binnen de ronde:** een fout beantwoorde som wordt 3 plekken verderop nogmaals aangeboden (max. 4 herkansingen per ronde).
- **Beheersing vraagt tempo:** boven mastery 3 groeit de score alleen bij een antwoord binnen 6 seconden. Goed *én* vlot, meerdere keren — geen geluksrondes.
- **Fouten zijn zacht:** mastery zakt, de som komt terug, maar er is geen straf of negatieve score.

## Geheime voortgangscodes (`code.js`)

Omdat er geen account is, fungeert een code als "spaarcode" om op een ander apparaat ongeveer verder te gaan. De code bevat: level per categorie (gemengde radix, 6·6·4·4 = 576 combinaties), XP in stappen van 100 (= precies het pilotenniveau, 64 bakjes) en sterren in stappen van 10 (16 bakjes). Samen 589.824 < 2²⁰ combinaties → **20 bits, gecodeerd in 4 base32-tekens + 1 checksum-teken**. Formaat:

```
RAKET-7K2M-9
└woord┘└data┘└checksum
```

Het woord vooraan is decoratie en wordt bij het inlezen genegeerd; de checksum vangt elke typfout van één teken af. De code is bewust **niet** beveiligd tegen valsspelen — het is een savegame, geen geheim.

Bewust weggelaten uit de code: de gekozen tafels (opnieuw aanvinken kost twee seconden en bespaarde 10 bits) en de individuele somgeschiedenis (het `facts`-model); die bouwt zich op het nieuwe apparaat snel opnieuw op. Oude codes in het 8-tekens v1-formaat worden nog steeds herkend en ingelezen.

Na elke ronde staat de actuele code in het samenvattingsscherm; hij is ook altijd te vinden onder *Voor ouders en leraren*.

## Voor ouders en leraren

Het ouderscherm toont naast de geheime code ook:

- **Lastige sommen:** de (maximaal 5) sommen waar het kind nog het meest moeite mee heeft, rechtstreeks uit het voortgangsmodel van de adaptieve motor. Handig om te zien waar gericht oefenen loont.
- **Volledige back-up:** de geheime code bewaart alleen de grote lijnen; "Voortgang opslaan als bestand" downloadt álles (inclusief de individuele somgeschiedenis) als JSON, en "Voortgang inladen" zet dat op een ander apparaat weer terug.

## Privacy

Er wordt niets verstuurd. Voortgang staat in `localStorage` van de browser. "Voortgang wissen" in het ouderscherm verwijdert alles. De fonts worden lokaal meegeleverd, dus de app doet geen enkel extern verzoek.

## Volgende ontwikkelstappen

1. **PWA / offline:** manifest + service worker zodat de app installeerbaar is en offline werkt (de fonts zijn al lokaal; er zijn geen externe afhankelijkheden meer).
2. **Speed Run-modus:** zoveel mogelijk sommen in een vriendelijke tijdslimiet.
3. **Avonturenpad:** levelkaart met werelden/planeten en badges.
4. **Meerkeuze-invoer** als optie voor de allerjongsten.
5. **Geluidseffecten** (standaard uit, aan te zetten).
6. **Dagelijkse uitdaging** (lokaal, datumgebonden).
7. **Extra mini-games** (memory, ballonnen, doolhof) in rotatie.
