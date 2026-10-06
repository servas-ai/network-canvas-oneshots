## 1. Brücke
- [x] 1.1 `scripts/voice-bridge.mjs`: Loopback, Allowlist, Token, PNA-Preflight, `/health` (Beleg: E2E AC3: fremde Origin 403, ohne Token 403, fremder Host 403, Preflight mit `Access-Control-Allow-Private-Network: true`)
- [x] 1.2 `/stt` → whisper.cpp `/inference` bzw. OpenAI-kompatibel, startet `whisper-server` bei Bedarf (Beleg: Log `whisper_started`; E2E AC4 „Der Knopf ist viel zu klein.“)
- [x] 1.3 `/grok/status|start|stop|events` → Harness 127.0.0.1:9381 (serverseitig) (Beleg: E2E AC7 Status 200 vom echten Harness, consent=True)
- [x] 1.4 `--open` koppelt die Übersicht (Port + Token im Hash, danach entfernt) (Beleg: E2E „Pairing via #voice= stored, hash removed“)

## 2. Übersicht
- [x] 2.1 Adapter-Hook + Adapter `whisper`, `grok`, `browser`, `tippen`, Wahl gespeichert (Beleg: E2E „four adapters“, „register(adapter) plugs in a custom STT“; `.proof/2026-10-06_r2-sprach-einstellungen.png`)
- [x] 2.2 Taste V / Sprechen-Knopf, Zeiger-Position je Abschnitt, Element-Anker, Anhängen bei gleicher Stelle (Beleg: E2E AC1 Share-Knopf + Sticky-Werkzeug, Koordinaten = Element-Rechteck `[323,15,64,42]`; `.proof/2026-10-06_r2-sprach-notizen-liste.png`)
- [x] 2.3 Aufnahme mit Pausen-Schnitt (AudioWorklet, 16 kHz WAV), Pegel und Live-Text (Beleg: E2E AC5 Pegel 20 px, „Hört zu …“; `.proof/2026-10-06_r2-sprechen-live.png`)
- [x] 2.4 Status/Einstellungen, Rückfall ohne Brücke, Hinweis bei gesperrtem lokalen Netzwerk (Beleg: E2E AC6; `.proof/2026-10-06_r2-bruecke-offline.png`)

## 3. Beweis
- [x] 3.1 Brücke: Allowlist/Token-Test (403), echter whisper.cpp-Lauf (Beleg: E2E AC3/AC4)
- [x] 3.2 E2E mit synthetischer Sprache auf Pages → Markierung mit Text + Element (Beleg: 27/27 auf der Pages-URL, `.proof/2026-10-06_r2-e2e-result.json`)
- [x] 3.3 Grok-Durchreiche gegen den echten Dienst (Status), Live-Sitzung nur mit Go (Beleg: E2E AC7; keine Live-Sitzung gestartet)
- [x] 3.4 Screenshots selbst gesichtet, Push, Runde an L13 (Beleg: 6 Dateien `.proof/2026-10-06_r2-*.png`, Commits 4a1aee0 · 2626780 · f9769bc)
