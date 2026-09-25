# LockShell

A kiosk-style shell for a shared iPhone (built for iPhone 12, iOS Safari, installed with **Add to Home Screen**).
It looks like a phone: a lock screen with a passcode keypad, then a home screen of safe apps.

**Live:** https://kampfguy.github.io/LockShell/

> A web app cannot keep the iPhone's own OS lock engaged. Use iOS **Guided Access**
> (Settings > Accessibility > Guided Access) to keep the phone inside LockShell. Full steps are in the app under Settings > Help & Setup.

## Features
- Lock screen: clock, date, passcode keypad (default **1234**, stored as a salted SHA-256 hash, changeable in Settings), wrong code shakes.
- Home screen apps: Settings, Games (Snake, 2048, Tic-Tac-Toe, Memory), Buddy, Camera, Voice Recorder, Notes, Weather, Calculator, Timer/Stopwatch, Drawing, Light.
- Auto-lock after idle time (default 2 minutes), lock button, light/dark theme.
- Buddy: offline rule-based helper (math, unit conversion, time/date, definitions, jokes, facts, riddles, dice/coin, opens apps), spoken replies, tap-to-talk and an optional "Hey Buddy" wake word. Every message passes a safety filter first.
- Weather from Open-Meteo (free, no key), with city search and an offline cache.
- Works offline (service worker). No frameworks, no build step, no external CDNs, no accounts, no tracking.

## Development
Plain HTML/CSS/JS. Serve the folder with any static server, e.g. `python3 -m http.server`.

- `node tests/buddy.test.js`: Buddy safety filter and reply tests
- `python3 tests/e2e.py`: Playwright end-to-end run at 390x844 (writes `screenshots/`)
- `python3 make_icons.py`: regenerate icons (Pillow)

When you change assets, bump `VERSION` in `sw.js` so installed copies update.
