## Cel
Celem aplikacji jest zapewnienie użytkownikom środowiska w którym mogą przechowywać i sprawdzać swoje zyski oraz wydatki.
## Rodzaje możliwości użytkowników
* **Użytkownik niezalogowany**
    Jedyne co ten użytkownik może zrobić to się zalogować lub założyć konto.
* **Użytkownik zalogowany**
    Użytkownik może:
    * dodawać/usuwać własne zyski/wydatki
    * sprawdzać historię swoich zysków/wydatków (z sortowaniem/filtrami)
    * wylogować się 
    * zmienić swoje hasło
    * usunąć swoje konto
* **Admin**
    Admin może:
    * wyszukiwać użytkowników (z sortowaniem/filtrami)
    * oglądać zyski/wydatki wszyskich użytkowników 
    * sprawdzać historię zysków/wydatków wszyskich użytkowników (z sortowaniem/filtrami)
    * dodawać/usuwać zyski/wydatki wszystkich użytkowników
    * usuwać konta

## Wymagania funkcjonalne (min 6)
* **Rejestracja i logowanie**: Użytkownik może założyć konto przy użyciu loginu i hasła.
* **Dodawanie/usuwanie zysków/wydatków**: Użytkownik może dodać swój zysk/wydatek wraz z nazwą, datą oraz notatką/komentarzem. Wpisy mogą również zostać usunięte.
* **Sprawdzanie historii**: Użytkownik może sprawdzić swoje wpisy z wybranego zakresu dat. Wpisy może sortować oraz filtrować wg nazwy, daty, ilości lub komentarza.
* **Wyszukiwanie użytkowników**: Administrator może wyszukiwać użytkowników po nazwie. Dodatkowo wyniki może sortować wg nazwy użytkownika, ilości wpisów, daty dołączenia lub daty ostatniego logowania.
* **Usuwanie kont**: System pozwala na usuwanie kont użytkowników. Konto może zostać usunięte tylko poprzez administratora oraz użytkownika, do którego należy konto.
* **Baza danych**: System przechowuje dane w bazie danych. Z bazy wyciągane są tylko potrzebne dane do wykonania zadania.
## Wymagania bezpieczeństwa (min 6)
* Hasła użytkowników muszą być zaszyfrowane/zhashowane w bazie danych.
* Dane logowania powinny być zaszyfrowane/zhashowane przed wysłaniem do backendu.
* Użytkownik powinien mieć dostęp tylko do własnych wpisów. Wpisy innych użytkowników nie powinny dochodzić do frontendu.
* Usunięcie użytkownika powinno również usunąć powiązane z nimi dane.
* Użytkownicy nie powinni mieć dostępu do panelu administratora, oraz nie powinni mieć możliwości wywołania funkcjonalności na backendzie.
* Baza danych powinna być chroniona przed nieuprawnonym dostępem.
* Administratorzy muszą potwierdzać każdą akcję. System powinien przechowywać logi każdej akcji dokonanej przez administratora.

## Model zagrożeń
| Zagrożenie | Czego dotyczy | Możliwe konsekwencje | Planowana kontrola/działanie |   
|---|---|---|---|
| Przechwycenie danych logowania (MITM) | Logowanie | Przejęcie kontroli nad kontem przez atakującego | Szyfrowanie danych przed wysłaniem do serwera |   
| Nadużycie uprawnień administratora | System  | Usunięcie wszystkich danych, zatrzymanie serwisu | Potwierdzenie działań, Logowanie akcji administratorów |  
| Wysłanie nadmiernej ilości danych z backendu | Dane | Wyciek danych | Wysyłanie tylko wymaganych informacji z backendu | 
| Nieuprawniony dostęp do panelu administratora | System | Usunięcie wszystkich danych, zatrzymanie serwisu | Poprawna autoryzacja poleceń od użytkowników podających się za administratora | 