# POKEBRICKS - Gestionale operativo

Applicazione desktop Electron con archivio JSON locale, catalogo prodotti, vendite live, rubrica derivata dalle vendite, bozze documentali stampabili e aggiornamenti da GitHub Releases.

## Avvio per sviluppo

1. Installa Node.js LTS.
2. Esegui `npm install`, quindi `npm start`.
3. Il progetto è collegato a `AntoMMA/POKEBRICKS---Gestionale-operativo` per gli aggiornamenti GitHub.

## Pacchetto e aggiornamenti

`npm run dist:win` crea l'installer Windows locale; `npm run release` pubblica gli artefatti su una GitHub Release. Gli aggiornamenti funzionano sulle build installate e firmate, con una release GitHub pubblicata e `latest.yml` prodotto da electron-builder. Gli aggiornamenti vengono scaricati automaticamente; a download finito l'app mostra percentuale, sfoca lo sfondo, attende cinque secondi ed esegue il riavvio. Prima di installare viene salvata una copia dei dati nella directory `backups` dell'area dati utente.

Per pubblicare una release firmata, crea i GitHub Actions secrets `WINDOWS_CERTIFICATE_BASE64` (contenuto del PFX codificato Base64) e `CSC_KEY_PASSWORD` (password del PFX). Poi pubblica un tag `v` che corrisponde alla versione in `package.json`, per esempio `v0.1.0`. Il workflow `.github/workflows/release.yml` crea la release firmata. Non inserire mai il PFX o la password nei file Git.

### Firma professionale

- **Windows:** questa configurazione usa il certificato PFX fornito. Esegui `npm run dist:win:signed`: il percorso del certificato viene letto da `POKEBRICKS_CERT_PATH` (o dal file locale ignorato `.env.local`) e la password viene richiesta in un prompt protetto. La password non viene scritta nel repository.
- **macOS:** richiede Developer ID Application, notarizzazione Apple e segreti del team configurati per electron-builder (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).
- Non inserire certificati o password in Git. Linux non offre una firma desktop universale equivalente; le firme dipendono dal canale di distribuzione scelto.

Il certificato è protetto da password. Finché non viene sbloccato durante una build, non ne sono stati verificati intestatario, uso per code signing o scadenza. Non posso dichiarare l'identità aziendale, il proprietario GitHub o le credenziali di pubblicazione al posto del distributore.

## Dati locali e limiti fiscali

I dati sono conservati come `pokebricks-data.json` nella directory `app.getPath('userData')`, separata dall'installazione. Il salvataggio usa file temporaneo e rinomina atomica; l'app non sincronizza il database con servizi cloud. Da Impostazioni si può esportare una copia JSON. Conserva copie di backup protette, specialmente quando il dispositivo è condiviso.

Catalogo, vendite e documenti sono una base operativa iniziale. Le stampe sono chiaramente marcate come bozze e non sostituiscono fattura elettronica o DDT fiscalmente validi. Per l'emissione italiana occorrono analisi del regime fiscale, XML FatturaPA, trasmissione e gestione esiti SDI, numerazione e conservazione a norma, oltre a una revisione di un commercialista. La firma digitale professionale dei pacchetti software e la firma elettronica di documenti fiscali sono processi distinti.

La personalizzazione attuale copre nome negozio, valuta e colore. Ulteriori campi, template, ruoli, canali live, flussi resi e integrazioni richiedono requisiti specifici e sviluppo dedicato.
