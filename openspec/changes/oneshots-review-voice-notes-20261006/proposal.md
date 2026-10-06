## Why
Martin (Zusatz-Goal 6.10.2026): „VOICE-Annotation: Zeiger/Cursor auf ein Element, Taste Start, während man REDET wird die Notiz gespeichert MIT der Cursor-Position zu dem Moment; Transkription via Grok-Voice-Harness (127.0.0.1:9381) ODER lokalem STT-Modell (dasselbe, das im Web-UI genutzt wird), baubar als Stub-Hook, der beides unterstützt.“ Tippen ist für Martin mühsam; Zeigen und Sprechen ist schneller.

Befund vor dem Bau:
- Der Harness (`servas-ai/browser-voice-harness`, `grok-voice serve --port 9381`) lehnt fremde Herkunft bewusst ab (`requestAllowed`: Host muss Loopback sein, `Sec-Fetch-Site: cross-site` → 403). Die Pages-Seite kann ihn also nicht direkt aufrufen.
- whisper.cpp (`whisper-cli`, `whisper-server`) ist auf dem Mac installiert, ein STT-Dienst läuft nicht.

## What Changes
- Taste **V** (und 🎙-Knopf): Aufnahme startet. Die Zeiger-Position beim Start jedes gesprochenen Abschnitts wird mit Element-Anker festgehalten. Jeder Abschnitt (Pause trennt) wird eine Markierung mit dem Text als Notiz; gleiche Stelle → Text wird angehängt. V oder Enter beendet, Esc bricht den laufenden Abschnitt ab.
- **Adapter-Hook** `window.OneshotsVoice.register(adapter)` mit eingebauten Adaptern:
  - `whisper`: lokales STT über die Brücke (whisper.cpp `/inference` oder OpenAI-kompatibel `/v1/audio/transcriptions`, konfigurierbar).
  - `grok`: Grok-Voice-Harness über die Brücke (`/v1/grok/start|stop|events`, Ereignis v1, `speaker: user`).
  - `browser`: Web Speech API, wenn der Browser sie hat.
  - `tippen`: kein STT, V öffnet die Notiz an der Zeiger-Stelle.
- **Brücke** `scripts/voice-bridge.mjs` (Node, ohne Abhängigkeiten): nur 127.0.0.1, Origin-Allowlist (`https://servas-ai.github.io`, Loopback), Token je Start (nie im Code), Private-Network-Preflight. Leitet serverseitig an STT und Harness weiter; die Schutzregel des Harness bleibt unverändert. `--open` öffnet die Übersicht schon gekoppelt.
- Markierung speichert `quelle: 'sprache'`, Adapter, Zeitpunkt.

## Capabilities
### New Capabilities
- `oneshots-review-voice`: Sprach-Notizen mit Zeiger-Position, Adapter-Hook und lokale Brücke.

### Modified Capabilities
- (keine)

## Akzeptanzkriterien
- **AC1** V startet; jede gesprochene Passage wird eine Markierung an der Zeiger-Position ihres Beginns (Element-Anker wie beim Klick).
- **AC2** Hook mit 4 Adaptern (`whisper`, `grok`, `browser`, `tippen`), Wahl bleibt je Browser; fremde Adapter per `register` einhängbar.
- **AC3** Brücke: nur Loopback, Allowlist + Token, keine Secrets im Repo; Harness-Schutz unangetastet.
- **AC4** Echter E2E: synthetische Sprache (macOS `say`) → Mikro der Seite → Brücke → whisper.cpp → Notiz enthält die gesprochenen Wörter, Markierung hat Koordinaten und Element.
- **AC5** Während des Sprechens sichtbar: Pegel, Status, Zwischentext (Grok/Browser) bzw. Abschnitt-Text (Whisper).
- **AC6** Ohne Brücke: klare Meldung, Rückfall `tippen`, keine Konsolenfehler außer dem abgelehnten Verbindungsversuch.
- **AC7** Grok-Pfad: Brücke reicht Status/Start/Stop/Ereignisse durch (gegen den echten Dienst auf 9381 geprüft). Eine echte Grok-Live-Sitzung startet nur mit Martins Go (eigenes Konto, AGB-Risiko laut Harness-CONTRACT).

## Impact
- `index.html` (Voice-Modul, 🎙-Knopf, Einstellungen), neu `scripts/voice-bridge.mjs`, README-Abschnitt, `.proof/`.
