## Nazwa Projektu
**Budżeter Pro**
## Zespół
* Jakub Knapik
## Język
* TypeScript
## Technologie
* React 
* Node.js
* Mkcert
* Express 
* SQLite
* Prisma
## Opis
Aplikacja webowa do monitorowania zysków oraz wydatków w celu lepszego budżetowania. Użytkownik będzie mógł zapisywać swoje zyski/wydatki, po czym sprawdzać swój balans oraz proste statystyki np. średni balans na miesiąc.

# Uruchamianie i wymagania
Aplikacja wymaga zainstalowania **node.js** (https://nodejs.org/en) oraz **mkcert** (https://github.com/FiloSottile/mkcert).

Przy pierwszym uruchomieniu należy utworzyć lokalny certyfikat CA poleceniem `mkcert -install`. Aplikacja automatycznie utworzy certyfikat dla `localhost`.

Aby uruchomić aplikację należy otworzyć terminal w folderze app po czym wykonać komendę:
```npm run all```

Polecenie instaluje wymagane biblioteki po czym uruchamia aplikacje.

Przy pierwszym uruchomieniu zostanie automatycznie stworzona baza danych. Do bazy zostanie dodany admin z hasłem zdefiniowanym w pliku ```.env```. Jeśli plik .env nie istnieje to zostanie utworzony bazując na ```.env```.example.

**Pozostałe komendy:**
* ```npm run setup_env``` Tworzy plik .env jeśli nie istnieje.
* ```npm run install_all``` Instaluje wymagane biblioteki oraz tworzy .env jeśli nie istnieje.
* ```npm run server``` Tworzy bazę danych jeśli nie istnieje i uruchamia serwer.
* ```npm run client``` Uruchamia stronę.
* ```npm run dev``` Jednocześnie uruchamia serwer i stronę.

## Adresy
* Frontend/Strona -   https://localhost:3000/
* Backend/API -       https://localhost:5000/

## Endpointy
Wszystkie adresy zaczynają się od https://localhost:5000
| Typ | Adres | Funkcja | Dostępność
|---|---|---|---|
GET |   /  |    Wiadomość powitalna | Wszyscy
GET |   /api  |    Lista endpointów | Wszyscy
GET |   /api/health  |    Status serwera | Wszyscy
POST |   /api/register  |    Rejestracja | Wszyscy
POST |   /api/login  |    Logowanie | Wszyscy
PUT |   /api/password  |    Zmiana hasła | Użytkownicy
DELETE |   /api/account  |    Usuwanie własnego konta | Użytkownicy
POST |   /api/entries  |    Tworzenie wpisu | Użytkownicy
DELETE |   /api/entries  |    Usuwanie wpisu | Użytkownicy
GET |   /api/entries  |    Lista wpisów | Administratorzy
GET |   /api/users  |    Lista użytkowników | Administratorzy
DELETE |   /api/users  |    Usuwanie konta | Administratorzy


**Przykładowe żądanie**
```
Windows:
Invoke-RestMethod -Uri "https://localhost:5000/api/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username": "user@example.com", "password": "mypassword"}'
Linux:
curl -X POST https://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "password": "mypassword"}'
```

# Testowanie
Projekt wykorzystuje **Vitest** oraz **Supertest**.

Aby przeprowadzić testy należy otworzyć terminal w folderze app po czym wykonać komendę:
```npm run tests```

Komenda wymaga zainstalowania bibliotek (```npm run install_all``` - automatycznie wykonane, jeśli aplikacja była już wcześniej uruchamiana).

Testy pokrywają wszystkie endpointy dostępne na backendzie, z wyjątkiem / oraz /api. Funkcje testowane są dla poprawnych oraz błędnych danych.

Testy wykorzystują symulowaną bazę danych - nie modyfikują bazy danych używanej przez samą aplikację.

# Ciągła Integracja (CI)
Projekt wykorzystuje **Github Actions** do automatycznego testowania projektu przy każdym push/pull requeście.

Plik z konfiguracją znajduje się w folderze ```.github/workflows```.

Po każdym push/pull requeście narzędzie tworzy środowisko testowe, instaluje zależności, tworzy certyfikaty przy użyciu mkcert, po czym wykonuje testy.