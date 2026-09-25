# LockShell — ShellOS

**ShellOS** is a kid-safe, kiosk-style shell for a shared iPhone (built for iPhone 12, iOS Safari, installed with **Add to Home Screen**).
It looks like a phone: a lock screen with a passcode keypad, then a home screen of safe apps. The project/repo name is LockShell.

**Live:** https://kampfguy.github.io/LockShell/

> A web app cannot keep the iPhone's own OS lock engaged. Use iOS **Guided Access**
> (Settings > Accessibility > Guided Access) to keep the phone inside ShellOS, and turn on
> **Screen Time > Content & Privacy Restrictions > Web Content > Limit Adult Websites** for Apple's own web filter.
> Full steps are in the app under Settings > Help & Setup and Settings > About.

## Features
- Lock screen: clock, date, passcode keypad (default **1234**, stored as a salted SHA-256 hash, changeable in Settings), wrong code shakes.
- Home screen apps: Settings, Games, Buddy, **Shell**, Camera, Voice Recorder, Notes, Weather, Calculator, Timer/Stopwatch, Drawing, Light, Piano, Calendar, Dice & Coin.
- Games: Snake, 2048, Tic-Tac-Toe, Memory, Breakout, Minesweeper, Connect Four, Sky Hop.
- Auto-lock after idle time (default 2 minutes), lock button, light/dark theme.
- Buddy: offline rule-based helper (math, unit conversion, time/date, definitions, jokes, facts, riddles, dice/coin, opens apps, searches Shell), spoken replies, tap-to-talk and an optional "Hey Buddy" wake word. Every message and every reply passes a safety filter.
- **Voice-only Buddy:** shake the phone (Motion permission on iPhone), tap the floating mic on Home, or say "Hey Buddy": a full-screen listening orb with captions and spoken replies. (Web apps cannot read the volume buttons.)
- **Shell:** a kid-safe browser. Simple English Wikipedia is fetched through the Wikipedia API and rendered in-app after the title, categories and full text pass `js/shell-filter.js` (fails closed). Sexual topics are blocked; war/history is allowed but atrocity/graphic pages are blocked. A short list of checked kid websites opens in a sandboxed frame; a Content-Security-Policy `frame-src` stops those sites from navigating to anywhere else. Every other address is blocked.
- Weather from Open-Meteo (free, no key), with city search and an offline cache.
- Works offline (service worker) except Weather and Shell. No frameworks, no build step, no external CDNs, no accounts, no tracking.

## Development
Plain HTML/CSS/JS. Serve the folder with any static server, e.g. `python3 -m http.server`.

- `node tests/buddy.test.js`: Buddy safety filter and reply tests
- `node tests/shell-filter.test.js`: Shell filter tests (offline)
- `node tests/shell-live.js`: real check against Simple English Wikipedia (needs internet)
- `python3 tests/e2e.py`: Playwright end-to-end run at 390x844 (writes `screenshots/`)
- `python3 tests/live_smoke.py`: short smoke test against the live site
- `python3 make_icons.py`: regenerate icons (Pillow)

When you change assets, bump `VERSION` in `sw.js` so installed copies update.
