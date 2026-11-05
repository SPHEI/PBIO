## Nazwa Projektu
**Budżeter Pro**
## Zespół
* Jakub Knapik
## Język
* TypeScript
## Technologie
* React 
* Node.js
* Express 
* SQLite
* Prisma
## Opis
Aplikacja webowa do monitorowania zysków oraz wydatków w celu lepszego budżetowania. Użytkownik będzie mógł zapisywać swoje zyski/wydatki, po czym sprawdzać swój balans oraz proste statystyki np. średni balans na miesiąc.

# Uruchamianie i wymagania
Aplikacja wymaga zainstalowania **node.js** (https://nodejs.org/en).

Aby uruchomić aplikację należy otworzyć terminal w folderze app po czym wykonać komendę:
```npm run all```

Polecenie instaluje wymagane biblioteki po czym uruchamia aplikacje.
Przy pierwszym uruchomieniu zostanie automatycznie stworzona baza danych. Do bazy zostanie dodany admin z hasłem zdefiniowanym w pliku ```.env```. Jeśli plik .env nie istnieje to zostanie utworzony bazując na ```.env```.example.

**Pozostałe komendy:**
```npm run setup_env``` Tworzy plik .env jeśli nie istnieje.
```npm run install_all``` Instaluje wymagane biblioteki oraz tworzy .env jeśli nie istnieje.
```npm run server``` Tworzy bazę danych jeśli nie istnieje i uruchamia serwer.
```npm run client``` Uruchamia stronę.
```npm run dev``` Jednocześnie uruchamia serwer i stronę.

## Adresy
Frontend/Strona -   http://localhost:3000/
Backend/API -       http://localhost:5000/

## Endpointy
Wszystkie adresy zaczynają się od http://localhost:5000
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
Invoke-RestMethod -Uri "http://localhost:5000/api/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username": "myusername", "password": "mypassword"}'
Linux:
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username": "myusername", "password": "mypassword"}'
```