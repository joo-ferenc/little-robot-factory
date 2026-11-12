# Little Robot Factory – webes változat (1.5.10)

Böngészőben futó változat: ugyanaz a 12 világ, 240 küldetés, a műhely, a csapatok, a tippek, a három nyelv
(magyar, német, angol), és a mozgó kerekek, lánctalp és póklábak, mint az Android-játékban.
A haladás a böngészőben marad (localStorage), az első betöltés után internet nélkül is játszható.

**1.5.10:** küldetéskártya: koppintásra indul a küldetés, hosszan nyomva nyílik ki az akadálysor (oldalra húzható).

**1.5.9:** a haladásjelző a pálya végén teljesen megtelik.

**1.5.8:** iPhone: a „Teljes képernyő” gomb elmagyarázza a kezdőképernyőre tételt (az iPhone böngészője nem enged teljes képernyőt); új „Fekvő nézet” gomb, amely álló telefonon is fekvőben mutatja a játékot.

**1.5.7:** a „Teljes képernyő” gombon nyíl helyett fehér négy-sarok jel.

**1.5.6:** a fejválasztó gombjain az egész fej látszik.

**1.5.5:** frissítés után az új változat töltődik be (a régi, tárolt példány nem ragad be); internet nélkül továbbra is indul.

**1.5.4:** a képernyő alja telefonon is látszik (Messenger / beépített böngésző, álló és fekvő helyzetben); alacsony fekvő képernyőn kisebb fejléc és garázs, állóban az egész műhely görgethető.

**1.5.3:** a darus híd csigája teljesen kerek, és nem látszik rajta a régi kötél darabja.

## Mappák

| Mappa / fájl | Tartalom |
|---|---|
| `index.html` | a játék belépési pontja |
| `js/engine.js` | játéklogika (pályák, képességek, csapatmotor) – a Kotlin `engine` átirata |
| `js/robot.js` | robot rajzolása (fej, test, kar, mozgó modulok) |
| `js/scene.js` | a pálya rajza (akadályok, daru kötéllel, kamera) |
| `js/app.js` | képernyők, mentés, hangok, nyelvek |
| `js/art.js` | képbetöltés, rajzoló segédek |
| `css/style.css` | megjelenés, betűk (Fredoka, magyarul Nunito) |
| `assets/img/` | a játék képei (WebP) |
| `assets/art.json` | illesztési adatok (váll, foglalat, talaj felszíne) |
| `assets/missions.json` | mind a 240 pálya |
| `assets/strings.json` | szövegek három nyelven |
| `assets/sounds/`, `assets/fonts/` | hangok, betűk (OFL) |
| `manifest.webmanifest`, `icons/` | telepíthető alkalmazás (kezdőképernyőre tehető) |
| `sw.js` | offline gyorsítótár |

## Helyi kipróbálás

A böngésző fájlból (`file://`) nem tölti be a modulokat, ezért egy kis webszerver kell, pl.:

```
python -m http.server 8000
```

majd: http://localhost:8000

## Közzététel GitHub Pages-en

1. GitHubon új, **nyilvános** tároló (pl. `little-robot-factory`).
2. A mappa teljes tartalma a tároló gyökerébe kerül (az `index.html` legyen a gyökérben).
3. Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, mappa: `/ (root)` → Save.
4. Kb. 1–2 perc múlva a játék itt érhető el: `https://<felhasználónév>.github.io/little-robot-factory/`

Telefonon/tableten a böngésző menüjében a „Hozzáadás a kezdőképernyőhöz” után teljes képernyős alkalmazásként indul.
