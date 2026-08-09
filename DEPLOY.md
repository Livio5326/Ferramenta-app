# Preparazione al deploy

Il backend e' distribuibile come container Docker su Render, Railway, Fly.io o
un altro servizio compatibile. Il database consigliato e' MongoDB Atlas.

## Database

1. Creare un cluster MongoDB Atlas e un utente dedicato.
2. Autorizzare la rete del servizio che ospitera' il backend.
3. Copiare la stringa di connessione in `MONGO_URL`.

Non inserire password o stringhe reali nei file del repository.

## Backend

Creare un servizio Docker con cartella radice `backend` e configurare:

- `MONGO_URL`: stringa MongoDB Atlas;
- `DB_NAME`: nome del database, per esempio `ferramenta`;
- `JWT_SECRET`: valore casuale lungo almeno 32 byte;
- `CORS_ORIGINS`: eventuali indirizzi HTTPS del frontend web, separati da virgola;
- `UPLOAD_DIR`: `/data/uploads` se il servizio offre un volume persistente.

Il servizio espone la porta indicata dalla variabile `PORT`. Dopo il rilascio,
`https://DOMINIO/api/health` deve rispondere con `status: ok`.

La cartella `uploads` va collegata a un volume persistente. Senza un volume,
foto e file caricati possono sparire dopo un riavvio o un nuovo deploy. In
alternativa andra' integrato uno storage a oggetti (S3 o equivalente).

## App Expo

Impostare `EXPO_PUBLIC_BACKEND_URL` sull'URL HTTPS pubblico del backend, senza
`/api` finale, prima della build EAS:

```text
EXPO_PUBLIC_BACKEND_URL=https://ferramenta-api.example.com
```

Le build di produzione si interrompono se questa variabile manca, invece di
tentare erroneamente di collegarsi a `localhost`.

## Verifica dopo il rilascio

1. Aprire `/api/health` e verificare la connessione al database.
2. Effettuare il login dall'app su rete mobile.
3. Cercare un prodotto e registrare una vendita di prova.
4. Caricare una foto, riavviare il servizio e verificare che sia ancora presente.

## Prova locale del container

Dalla cartella `backend`, dopo aver creato il proprio `.env`:

```text
docker build -t ferramenta-api .
docker run --env-file .env -p 8000:8000 -v ferramenta-uploads:/data/uploads ferramenta-api
```
