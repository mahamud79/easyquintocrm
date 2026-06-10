## Modifiche richieste

### 1. Formattazione Euro italiana (punto migliaia)
Sostituire ovunque la formattazione provvigioni con `toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`:
- **`liquidato.tsx`** — colonna provvigioni
- **`statistiche.tsx`** — riquadro viola "Provvigioni totali", tab "Annuale" colonna provvigioni, tab "Per Banche" colonna provvigioni (verifico che `eur()` venga applicato a tutti)
- **`preventivi-cessioni.tsx`** e **`preventivi-salvati_.$id.tsx`** — tutte le cifre € visualizzate

### 2. Preventivi cessioni — campo "Settore ATC" in scheda cliente
- In **`clienti.$id.tsx`**: aggiungere subito sotto "Tipo di lavoro" il campo **Settore ATC** (stesso dropdown della "Tipologia" in preventivo cessioni). Salvataggio nel cliente store.
- In **`preventivi-cessioni.tsx`**: quando si seleziona un cliente esistente, precompilare "Tipologia" leggendo dal cliente: prima `settoreAtc`, fallback su `tipoLavoro`.
- Aggiornare **`clienti-store.ts`** con il nuovo campo `settoreAtc`.

### 3. Ricerca cliente esistente — eliminare record fantasma "aaa"
- In **`preventivi-cessioni.tsx`**: la funzione "Cerca cliente esistente" deve interrogare solo `leads-store` e `pratiche-store` (no preventivi salvati o store autonomi).
- Pulire da `clienti-store` (e localStorage) i record orfani non collegati a lead/pratica all'avvio dell'app.

### 4. Verifica calcoli reddito in preventivo cessioni
- Rivedere le formule in `preventivi-cessioni.tsx` per il blocco "Situazione reddituale": quota cedibile (1/5 del netto), rata massima sostenibile, capacità residua. Confermare conformità alla normativa CQS/CQP italiana (Lordo→Netto stipendio/pensione, ritenute, quinto cedibile su netto, esclusione TFR, ecc.).

### 5. Preventivo salvato (visualizzazione `preventivi-salvati_.$id.tsx`)
- **Comune**: leggere dal cliente collegato → `comuneResidenza` invece del campo del preventivo (se collegato).
- **Calcolo prestito**:
  - Rinominare "Tasso (TAN)" → **"Tasso nominale annuo (TAN)"**
  - Aggiungere campo editabile **"Tasso effettivo globale medio (TAEG)"** subito dopo
- **Flag Provvigioni**: checkbox "Mostra provvigioni" → nasconde/visualizza la sezione provvigioni sia a video sia nel PDF/invio.
- **Situazione reddituale**:
  - Cifre editabili inline (input numerici al posto delle label statiche)
  - Rimuovere il campo "Soglia indebitamento"
- **Download PDF**: implementare con `jsPDF + html2canvas`. Installare `jspdf` e `html2canvas`. Bottone "Scarica PDF" funzionante che esporta la scheda preventivo.

### 6. Persistenza
- Aggiungere ai modelli del preventivo i campi: `taeg`, `mostraProvvigioni`, valori editabili reddituali.

## File coinvolti
- `src/lib/clienti-store.ts` (campo settoreAtc + cleanup orfani)
- `src/lib/preventivi-store.ts` (campi taeg, mostraProvvigioni, override reddituali)
- `src/routes/_authenticated/clienti.$id.tsx` (nuovo campo Settore ATC)
- `src/routes/_authenticated/preventivi-cessioni.tsx` (ricerca cliente, precompilazione tipologia, formattazione €)
- `src/routes/_authenticated/preventivi-salvati_.$id.tsx` (TAN/TAEG, flag provvigioni, comune da cliente, reddituale editabile, PDF, formattazione €)
- `src/routes/_authenticated/liquidato.tsx` (formattazione provvigioni)
- `src/routes/_authenticated/statistiche.tsx` (verifica formattazione in tutte le tab)
- nuove dipendenze: `jspdf`, `html2canvas`
