# Instrukcja personalizacji zaproszenia ślubnego

## 1. Para Młoda i Treści
- Domyślna para: **Emilia i Aleksander**
- Domyślna data: **08 sierpnia 2027 (Niedziela), godz. 15:00**
- Ceremonia: Parafia pw. Przemienienia Pańskiego w Bydgoszczy (Opławiec)
- Przyjęcie: Dwór Hulanka, ul. Pawłówek 6, 85-438 Bydgoszcz

Wszystkie treści można dostosować bezpośrednio w pliku `index.html`.

## 2. Zdjęcia
W pliku `index.html` zastosowano luksusowe placeholdery z Unsplash w wysokiej rozdzielczości.
Aby użyć własnych zdjęć:
1. Wgraj pliki do folderu `assets/images/`:
   - `hero.jpg` — zdjęcie główne w tle
   - `kosciol.jpg` — zdjęcie kościoła
   - `dwor.jpg` — zdjęcie Dworu Hulanka
   - `photo1.jpg` do `photo6.jpg` — zdjęcia do galerii wspomnień
2. Zmień atrybuty `src` w `index.html` na odpowiednie ścieżki (np. `assets/images/hero.jpg`).

## 3. Dźwięk i Muzyka
Zgodnie z koncepcją minimalistycznego luksusu Haute-Couture, strona domyślnie działa w trybie bezdźwięcznym (silent luxury), zapewniając pełen komfort przeglądania bez niepożądanych dźwięków. Jeśli w przyszłości zechcesz dodać podkład muzyczny, możesz umieścić plik w folderze `assets/audio/`.

## 4. Personalizacja gości z parametru URL
Możesz generować unikalne linki dla każdego z gości:
- `index.html?gosc=Sz.+P.+Katarzyno+i+Michale`
- `index.html?gosc=Sz.+P.+Anna+i+Jan+Kowalscy`
- `index.html?gosc=Kochana+Babciu+i+Dziadku`

Imię gościa automatycznie pojawi się na kopercie, w nagłówku zaproszenia oraz w formularzu RSVP.
Gdy parametr nie zostanie podany, wyświetli się elegancki domyślny zwrot: **„Drodzy Goście”**.

Generator linków jest ukryty przed Gośćmi. Żeby go zobaczyć, otwórzcie stronę z dopiskiem `?para` (np. `index.html?para`); przycisk pojawi się w stopce.

## 5. Odbiorca odpowiedzi (RSVP)
Na górze pliku `js/rsvp.js` uzupełnijcie blok `COUPLE`: numer WhatsApp i SMS w formacie `48XXXXXXXXX` (bez +) oraz adres e-mail. Puste pole ukrywa dany przycisk; przycisk „Kopiuj treść odpowiedzi” jest zawsze dostępny.
