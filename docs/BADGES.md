# Dokumentacja systemu badge'y lokalnych

Repozytorium wykorzystuje w pełni lokalny system generowania badge'y aplikacji w stylu `for-the-badge` (wzorowany na Shields.io), wyposażonych w oficjalne ikony projektów osadzone bezpośrednio w plikach wektorowych SVG.

Dzięki temu:
* Wyświetlanie w `README.md` jest całkowicie niezależne od zewnętrznych usług CDN (Shields.io, Simple Icons itp.).
* Grafiki ładują się natychmiast i działają w trybie offline.
* Pliki SVG są w 100% zgodne z sanitizacją GitHuba (brak zewnętrznych żądań sieciowych, brak skryptów JS, brak `foreignObject`).
* Każda aplikacja prezentuje swoje oryginalne, oficjalne logo.

---

## 1. Architektura systemu

```text
repository/
├── README.md                  # Główny plik z prezentacją aplikacji
├── badges.config.json         # Konfiguracja metadanych wszystkich aplikacji i stylów
├── assets/
│   ├── logos/                 # Oficjalne pliki źródłowe ikon (SVG lub wysokiej rozdzielczości PNG)
│   └── badges/                # Wygenerowane, samodzielne pliki SVG
├── scripts/
│   ├── data/                  # Tablice metryk znaków (Verdana 10px / Verdana 10px Bold)
│   ├── generate-badges.js     # Skrypt generujący pliki SVG oraz podgląd preview-badges.html
│   └── test-badges.js         # Zautomatyzowany zestaw testów jakościowych i spójności
└── docs/
    └── BADGES.md              # Niniejsza dokumentacja
```

---

## 2. Interaktywny asystent w terminalu (Rekomendowany)

Repozytorium wyposażone jest w profesjonalny interfejs terminalowy (TUI) ułatwiający zarządzanie badge'ami i bezbłędne dodawanie nowych aplikacji.

### Uruchomienie

Możesz uruchomić panel główny lub bezpośrednio kreator nowej pozycji:

```bash
# Główny panel zarządzania
npm start
# lub: node scripts/cli.js

# Bezpośredni kreator dodawania aplikacji
npm run add
# lub: node scripts/add-app.js
```

### Możliwości interfejsu TUI:
1. **Wybór kategorii:** Najpierw wybierasz istniejącą kategorię (`Desktop Apps`, `Android Apps`, `Browser Extentions`) za pomocą strzałek klawiatury (↑/↓) lub cyfr, albo wybierasz opcję `[+] Nowa kategoria...`, aby utworzyć nową sekcję w `README.md`.
2. **Kreator krok po kroku:**
   * Nazwa aplikacji (np. `Spotify`) oraz automatyczna propozycja identyfikatora `id` (`spotify`).
   * Etykieta prawej sekcji badge'a (z listy popularnych lub własna).
   * Kolor badge'a (z palety spójnej z repozytorium lub własny kod HEX).
   * Docelowy adres URL aplikacji.
   * Źródło logo: podanie ścieżki do lokalnego pliku `.svg`/`.png` lub bezpośredniego adresu URL (skrypt automatycznie pobierze i zweryfikuje plik).
   * Informacje licencyjne i źródłowe.
3. **Automatyzacja:**
   Po zatwierdzeniu podsumowania kreator:
   * Kopiuje/pobiera logo do `assets/logos/<id>.<ext>`.
   * Aktualizuje `badges.config.json`.
   * Generuje badge SVG w `assets/badges/<id>.svg`.
   * Dodaje link do nowej aplikacji w wybranej sekcji `README.md`.
   * Odświeża `preview-badges.html`.

---

## 3. Ręczne dodawanie aplikacji — krok po kroku

### Krok 1: Pobierz oficjalną ikonę projektu

Zasady pozyskiwania grafik:
1. Przejdź do oficjalnego repozytorium GitHub lub oficjalnej strony aplikacji.
2. Szukaj oryginalnej ikony w katalogach:
   * `assets/`, `icons/`, `images/`, `public/`, `resources/`
   * dla projektów Android: `fastlane/metadata/android/en-US/images/icon.png`, `app/src/main/res/`
3. **Format:** Preferuj wektorowy format SVG. Jeżeli SVG nie jest dostępny, pobierz PNG o wysokiej rozdzielczości (np. 512x512 lub 1024x1024).
4. **Ważne:** Nie używaj zamienników z Simple Icons, Font Awesome ani grafik generowanych przez AI. Używaj wyłącznie oficjalnych materiałów projektu.
5. Zapisz plik w katalogu `assets/logos/` pod nazwą identyfikatora aplikacji, np. `assets/logos/nowa-aplikacja.svg` (lub `.png`).

### Krok 2: Dodaj wpis do `badges.config.json`

Otwórz plik `badges.config.json` i dodaj obiekt aplikacji do tablicy `apps`:

```json
{
  "id": "nowa-aplikacja",
  "name": "NOWA APLIKACJA",
  "category": "UTILITIES",
  "color": "#008080",
  "logo": "assets/logos/nowa-aplikacja.svg",
  "url": "https://github.com/autor/nowa-aplikacja",
  "section": "Android Apps",
  "logoSource": "https://github.com/autor/nowa-aplikacja (assets/icon.svg)",
  "license": "GPL-3.0",
  "licenseUrl": "https://github.com/autor/nowa-aplikacja/blob/main/LICENSE"
}
```

#### Pola konfiguracji:
* `id` *(wymagane)*: Unikalny identyfikator w formacie kebab-case. Określa nazwę generowanego pliku `assets/badges/<id>.svg`.
* `name` *(wymagane)*: Nazwa aplikacji wyświetlana w lewej sekcji badge'a (tekst jest automatycznie formatowany wielkimi literami).
* `category` *(wymagane)*: Nazwa kategorii wyświetlana w prawej sekcji badge'a pogrubionym fontem.
* `color` *(wymagane)*: Kolor tła prawej sekcji (kod HEX lub nazwa koloru CSS).
* `textColor` *(opcjonalne)*: Kolor tekstu prawej sekcji. Domyślnie biały (`#ffffff`). Dla bardzo jasnych teł (np. `#99ccff`) ustaw ciemny odcień (`#333333`).
* `logo` *(wymagane)*: Ścieżka względna do pliku źródłowego logo w `assets/logos/`.
* `url` *(wymagane)*: Docelowy link do oficjalnego repozytorium lub strony aplikacji.
* `section` *(opcjonalne)*: Sekcja w `README.md` (`Desktop Apps`, `Android Apps`, `Browser Extentions`).
* `logoSource` *(wymagane)*: Źródło pochodzenia grafiki (repozytorium/ścieżka/URL).
* `license` *(wymagane)*: Licencja projektu/grafiki (np. `MIT`, `Apache-2.0`, `GPL-3.0`).
* `licenseUrl` *(opcjonalne)*: Link do tekstu licencji.

### Krok 3: Wybór koloru i kategorii

Aby zachować spójność z istniejącymi kategoriami w repozytorium, stosuj poniższą paletę:

| Kategoria | Domyślny kolor | Kod HEX |
|---|---|---|
| Project / System Tool | blue | `#007ec6` |
| Music Player / Extension | red | `#dd4343` |
| Tools / Manga Reader | orange | `#ea7233` |
| Editor / App Manager | green | `#67ac09` |
| App Store | blueviolet | `#8a2be2` |
| Audio Player | pastel blue | `#99ccff` (z ciemnym tekstem `#333333`) |
| Utilities | teal | `#008080` |
| Desktop Mode | darkblue | `#00008b` |
| File Manager | yellow | `#d8b800` |

### Krok 4: Uruchom generator badge'y

Wykonaj polecenie w katalogu głównym repozytorium:

```bash
node scripts/generate-badges.js
```

Generator:
1. Odczyta konfigurację z `badges.config.json`.
2. Zweryfikuje obecność wszystkich plików logo.
3. Wyliczy dokładne szerokości sekcji zgodnie z tablicami metryk czcionek Verdana.
4. Osadzi logo jako bezpieczny ciąg base64.
5. Wygeneruje gotowy plik SVG do katalogu `assets/badges/<id>.svg`.
6. Utworzy plik `preview-badges.html` z tabelarycznym podglądem na ciemnym i jasnym tle.

### Krok 5: Zaktualizuj `README.md`

Dodaj odnośnik w odpowiedniej sekcji `README.md`:

```markdown
[![Nowa Aplikacja](assets/badges/nowa-aplikacja.svg)](https://github.com/autor/nowa-aplikacja)
```

Zadbaj o:
* Poprawny tekst alternatywny w nawiasach kwadratowych.
* Wskazanie na lokalny plik w `assets/badges/`.
* Aktualny, działający URL do aplikacji.

### Krok 6: Zweryfikuj poprawność (Uruchomienie testów)

Uruchom pełny zestaw testów automatycznych:

```bash
node scripts/test-badges.js
```

Testy automatycznie sprawdzają:
1. Poprawność pliku konfiguracyjnego `badges.config.json`.
2. Istnienie i integralność wszystkich plików w `assets/logos/`.
3. Brak zewnętrznych odwołań (Shields.io, Simple Icons itp.) w `README.md`.
4. Poprawność składni XML wygenerowanych plików SVG.
5. Bezpieczeństwo sanitarne GitHuba (brak `<script>` i `<foreignObject>`).
6. Brak zewnętrznych zależności sieciowych wewnątrz plików SVG.
7. Prawidłowe proporcje i wymiary badge'y (wysokość 28 px, ikona 14x14 px).
8. Determinizm generatora (ponowne generowanie daje identyczne pliki).
9. Dostępność docelowych adresów URL aplikacji.

Możesz także otworzyć wygenerowany plik `preview-badges.html` w przeglądarce, aby naocznym podglądem ocenić spójność wizualną.
