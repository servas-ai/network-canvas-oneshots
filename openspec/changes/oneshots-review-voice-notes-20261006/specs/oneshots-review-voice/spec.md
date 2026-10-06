## ADDED Requirements

### Requirement: The overview SHALL record voice notes anchored to the pointer
Pressing V (or the microphone button) MUST start a voice note. For every spoken passage the overview MUST capture the pointer position over the prototype at the moment the passage starts, resolve the element under it like a click marking, and save the transcribed text as the note of that marking. Passages at the same element MUST be appended to one marking. V or Enter MUST stop, Esc MUST discard the passage in progress.

#### Scenario: Point and talk
- **WHEN** the pointer rests on a button in the prototype, the viewer presses V and says "Knopf größer machen"
- **THEN** a marking with art element, the button's selector and the note "Knopf größer machen" is saved
- **AND** its coordinates are those of the pointer position when speaking began

#### Scenario: Move while talking
- **WHEN** the viewer speaks one sentence over element A, pauses, moves to element B and speaks again
- **THEN** two markings are saved, one per element, each with its own sentence

### Requirement: Transcription SHALL be pluggable
Transcription MUST go through an adapter interface (`available`, `start`, `stop`, events for partial and final text). The overview MUST ship the adapters `whisper` (local STT via the bridge), `grok` (Grok-Voice-Harness via the bridge), `browser` (Web Speech API when present) and `tippen` (no STT). `window.OneshotsVoice.register(adapter)` MUST add further adapters. The chosen adapter MUST persist per browser.

#### Scenario: Fallback without bridge
- **WHEN** no bridge is reachable and the viewer presses V
- **THEN** the overview says that the bridge is offline, shows how to start it, and offers typing the note at the pointer position

### Requirement: The local bridge SHALL be loopback-only and token-protected
`scripts/voice-bridge.mjs` MUST listen on 127.0.0.1 only, accept browser requests only from the allowlisted origins with the per-start token, answer Private-Network preflights, and forward audio to the configured STT endpoint and voice requests to the Grok-Voice-Harness server-side. It MUST NOT change or weaken the harness' own origin check and MUST NOT contain secrets.

#### Scenario: Foreign origin
- **WHEN** a page from another origin, or a request without the token, calls the bridge
- **THEN** the bridge answers 403 and forwards nothing

#### Scenario: Real local transcription
- **WHEN** the page sends a recorded passage to `/stt`
- **THEN** the bridge returns the text from whisper.cpp
