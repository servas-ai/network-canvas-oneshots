## 1. Brücke
- [ ] 1.1 `scripts/voice-bridge.mjs`: Loopback, Allowlist, Token, PNA-Preflight, `/health`
- [ ] 1.2 `/stt` → whisper.cpp `/inference` bzw. OpenAI-kompatibel, startet `whisper-server` bei Bedarf
- [ ] 1.3 `/grok/status|start|stop|events` → Harness 127.0.0.1:9381 (serverseitig)
- [ ] 1.4 `--open` koppelt die Übersicht (Port + Token im Hash, danach entfernt)

## 2. Übersicht
- [ ] 2.1 Adapter-Hook + Adapter `whisper`, `grok`, `browser`, `tippen`, Wahl gespeichert
- [ ] 2.2 Taste V / 🎙-Knopf, Zeiger-Position je Abschnitt, Element-Anker, Anhängen bei gleicher Stelle
- [ ] 2.3 Aufnahme 16 kHz mit Pausen-Schnitt (AudioWorklet), Pegel und Live-Text
- [ ] 2.4 Status/Einstellungen (Brücke online, Adapter), Rückfall ohne Brücke

## 3. Beweis
- [ ] 3.1 Brücke: Allowlist/Token-Test (403), echter whisper.cpp-Lauf
- [ ] 3.2 E2E mit synthetischer Sprache auf Pages → Markierung mit Text + Element
- [ ] 3.3 Grok-Durchreiche gegen den echten Dienst (Status), Live-Sitzung nur mit Go
- [ ] 3.4 Screenshots selbst gesichtet, Push, Runde an L13
