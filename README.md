# POKEBRICKS - Gestionale operativo

Applicazione desktop Electron con archivio JSON locale, catalogo prodotti, vendite live, rubrica derivata dalle vendite, bozze documentali stampabili e aggiornamenti da GitHub Releases.

## Avvio per sviluppo

1. Installa Node.js LTS.
2. Esegui `npm install`, quindi `npm start`.
3. Il progetto è collegato a `AntoMMA/POKEBRICKS---Gestionale-operativo` per gli aggiornamenti GitHub.

## Pacchetto e aggiornamenti

`npm run dist:win` crea l'installer Windows senza certificato digitale. Tutte le versioni da 0.1.8 in avanti sono distribuite senza certificato. Per pubblicare la release, aggiorna la versione in `package.json`, invia le modifiche al repository e pubblica il tag corrispondente, per esempio `v0.1.14`. Il workflow `.github/workflows/release.yml` genera il manifest di aggiornamento e carica in sequenza installer e file di supporto in un'unica release GitHub.

Le build senza firma possono mostrare un avviso di sicurezza di Windows durante il download o l'installazione. Gli aggiornamenti vengono scaricati automaticamente; a download finito l'app mostra la percentuale, le note della release, sfoca lo sfondo, attende cinque secondi ed esegue il riavvio. Prima di installare viene salvata una copia dei dati nella directory `backups` dell'area dati utente.

Poiché gli aggiornamenti Windows non hanno firma digitale, l'app non può verificare l'identità del firmatario: pubblica release solo tramite il repository GitHub ufficiale e proteggi l'accesso all'account e al repository.

La 0.1.8 è il passaggio dalle build firmate a quelle senza certificato. Le installazioni precedenti devono installare manualmente l'installer 0.1.8 una volta, sopra l'app esistente e senza disinstallarla; le versioni successive potranno usare il sistema automatico senza certificato.

## Dati locali e limiti fiscali

I dati sono conservati come `pokebricks-data.json` nella directory `app.getPath('userData')`, separata dall'installazione. Il salvataggio usa file temporaneo e rinomina atomica; l'app non sincronizza il database con servizi cloud. Da Impostazioni si può esportare una copia JSON. Conserva copie di backup protette, specialmente quando il dispositivo è condiviso.

Catalogo, vendite e documenti sono una base operativa iniziale. Le stampe sono chiaramente marcate come bozze e non sostituiscono fattura elettronica o DDT fiscalmente validi. Per l'emissione italiana occorrono analisi del regime fiscale, XML FatturaPA, trasmissione e gestione esiti SDI, numerazione e conservazione a norma, oltre a una revisione di un commercialista.

La personalizzazione attuale copre nome negozio, valuta e colore. Ulteriori campi, template, ruoli, canali live, flussi resi e integrazioni richiedono requisiti specifici e sviluppo dedicato.
