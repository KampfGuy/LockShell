"""End-to-end check with Playwright (Chromium) at iPhone 12 size. Run: python3 tests/e2e.py"""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots')
os.makedirs(SHOTS, exist_ok=True)
import socket
_s = socket.socket(); _s.bind(('127.0.0.1', 0)); PORT = _s.getsockname()[1]; _s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
URL = f'http://127.0.0.1:{PORT}/index.html'

FORECAST = {
  "latitude": 40.71, "longitude": -74.0, "timezone": "America/New_York",
  "current": {"time": "2026-09-24T14:00", "temperature_2m": 22.4, "apparent_temperature": 23.0, "relative_humidity_2m": 58, "weather_code": 2, "is_day": 1, "wind_speed_10m": 11.5},
  "daily": {"time": ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"],
            "weather_code": [2, 61, 3, 0, 80], "temperature_2m_max": [24.1, 19.5, 21.0, 25.3, 22.2],
            "temperature_2m_min": [15.2, 13.8, 12.9, 14.6, 16.0], "precipitation_probability_max": [10, 80, 20, 0, 45]}
}

errors, fails = [], []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        geolocation={'latitude': 40.7128, 'longitude': -74.006}, permissions=['geolocation', 'microphone', 'camera'],
                        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')
    def fulfill_forecast(route):
        route.fulfill(status=200, content_type='application/json', body=json.dumps(FORECAST), headers={'access-control-allow-origin': '*'})
    # Simulate iPhone Safari, which has no Battery API.
    ctx.add_init_script('try { delete Navigator.prototype.getBattery; } catch (e) {}')
    ctx.route('https://api.open-meteo.com/**', fulfill_forecast)
    ctx.route('https://geocoding-api.open-meteo.com/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
              body=json.dumps({"results": [{"name": "New York", "latitude": 40.71, "longitude": -74.0, "admin1": "New York", "country_code": "US"}]})))
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    page.goto(URL)
    page.wait_for_timeout(600)
    shot = lambda n: page.screenshot(path=os.path.join(SHOTS, n))
    visible = lambda sel: page.eval_on_selector(sel, 'e => e.classList.contains("active")')

    check(visible('#lock'), 'lock screen shows first')
    check(page.locator('#lockPad button').count() >= 11, 'keypad rendered')
    check(page.eval_on_selector('.sb-batt', 'e => e.hidden'), 'battery hidden when getBattery is missing (iPhone)')
    shot('lock.png')

    def tap(k): page.click(f'#lockPad button[data-k="{k}"]')
    for k in '1111': tap(k)
    page.wait_for_timeout(700)
    check(visible('#lock') and not visible('#home'), 'wrong code rejected')
    check('Wrong' in page.inner_text('#lockSub'), 'wrong code message shown')
    for k in '1234': tap(k)
    page.wait_for_timeout(800)
    check(visible('#home'), 'home screen after 1234')
    labels = page.locator('#tiles .tile .lbl').all_inner_texts()
    print('   tiles:', labels)
    check(len(labels) == 11, '11 home apps')
    mic = page.evaluate('LS.settings.micPerm')
    check(mic in ('granted', 'unavailable', 'denied'), 'mic permission requested after first unlock: ' + mic)
    pin = page.evaluate('localStorage.getItem("lockshell.pin.v1")')
    check(pin and '1234' not in pin and len(json.loads(pin)['hash']) == 64, 'passcode stored as SHA-256 hash')
    shot('home.png')

    def open_app(id):
        page.click(f'#tiles .tile[data-app="{id}"]'); page.wait_for_timeout(500)
    def back(): page.click('#appBack'); page.wait_for_timeout(350)

    open_app('settings'); shot('settings.png')
    page.click('.set-row .seg button:has-text("Dark")'); page.wait_for_timeout(200)
    back(); page.wait_for_timeout(300)
    check(page.evaluate('document.documentElement.dataset.theme') == 'dark', 'dark theme applied')
    shot('dark-home.png')
    open_app('settings'); page.click('.set-row .seg button:has-text("Light")'); back()

    open_app('weather'); page.wait_for_timeout(1200)
    check('°' in page.inner_text('.wx-temp'), 'weather rendered from mocked Open-Meteo: ' + page.inner_text('.wx-temp'))
    check(page.locator('.wx-day').count() == 5, '5-day forecast')
    shot('weather.png'); back()

    open_app('buddy')
    def say(t):
        page.fill('.composer input', t); page.click('.composer button.send'); page.wait_for_timeout(300)
    say('what is 12 times 7')
    say('5 miles to km')
    say('tell me something sexy')
    bots = page.locator('.bubble.bot').all_inner_texts()
    check(any('= 84' in x for x in bots), 'Buddy answered math')
    check(page.locator('.bubble.refuse').count() == 1, 'Buddy refused explicit request')
    shot('buddy.png')
    say('open calculator'); page.wait_for_timeout(1500)
    check(page.inner_text('#appTitle') == 'Calculator', 'Buddy "open calculator" opened Calculator')
    back()
    open_app('buddy')
    check(page.locator('.bubble.me').count() >= 4, 'chat history kept while unlocked')
    back()

    open_app('calculator')
    for k in ['1', '2', '+', '7', '*', '3', '=']: page.click(f'.calc-keys button[data-k="{k}"]')
    check(page.inner_text('.calc-display') == '33', 'calculator 12+7×3 = 33 (got ' + page.inner_text('.calc-display') + ')')
    page.click('.calc-keys button[data-k="ac"]')
    for k in ['1', '2', '3', '4', '.', '5', '6', '*', '8', '=']: page.click(f'.calc-keys button[data-k="{k}"]')
    check(page.inner_text('.calc-display') == '9,876.48', 'calculator decimals 1234.56×8 (got ' + page.inner_text('.calc-display') + ')')
    shot('calculator.png'); back()

    open_app('games'); page.wait_for_timeout(200)
    page.click('.game-card:has-text("Snake")'); page.wait_for_timeout(300)
    page.click('.dpad .d-up'); page.wait_for_timeout(900); page.click('.dpad .d-right'); page.wait_for_timeout(500)
    shot('game.png')
    back(); check(page.inner_text('#appTitle') == 'Games', 'back from game returns to Games hub')
    page.click('.game-card:has-text("2048")'); page.wait_for_timeout(200); page.keyboard.press('ArrowLeft'); page.wait_for_timeout(200); back()
    page.click('.game-card:has-text("Tic-Tac-Toe")'); page.click('.ttt button >> nth=4'); page.wait_for_timeout(600)
    check(page.locator('.ttt button.o').count() == 1, 'tic-tac-toe AI moved'); back()
    page.click('.game-card:has-text("Memory")'); page.click('.mem button >> nth=0'); back(); back()

    os.makedirs(os.path.join(SHOTS, 'extra'), exist_ok=True)
    for app in ['camera', 'recorder', 'notes', 'timer', 'draw']:
        open_app(app); page.wait_for_timeout(400)
        check(visible('#appScreen'), app + ' opens'); shot('extra/' + app + '.png'); back()
    open_app('games'); shot('extra/games.png'); page.click('.game-card:has-text("2048")'); page.wait_for_timeout(200); shot('extra/2048.png'); back()
    page.click('.game-card:has-text("Memory")'); page.wait_for_timeout(200); shot('extra/memory.png'); back()
    page.click('.game-card:has-text("Tic-Tac-Toe")'); page.wait_for_timeout(200); shot('extra/ttt.png'); back(); back()
    open_app('settings')
    for name in ['Buddy', 'Microphone', 'Help & Setup', 'About']:
        page.click(f'.set-row:has-text("{name}")'); page.wait_for_timeout(300); shot('extra/settings-' + name.split()[0].lower() + '.png'); back()
    page.click('.set-row:has-text("Storage")'); page.wait_for_timeout(300)
    for k in '1234': page.click(f'#pinOverlay button[data-k="{k}"]')
    page.wait_for_timeout(600); shot('extra/settings-storage.png'); back(); back()
    open_app('camera'); page.wait_for_selector('.shutter:not([disabled])', timeout=8000); page.wait_for_timeout(500)
    page.click('.shutter'); page.wait_for_timeout(900)
    check(page.locator('.thumbs img').count() >= 1, 'camera captured a photo into IndexedDB'); shot('extra/camera-live.png'); back()
    open_app('notes'); page.click('.fab'); page.fill('.editor input', 'Shopping'); page.fill('.editor textarea', 'milk, eggs'); page.wait_for_timeout(900); back()
    check('Shopping' in page.inner_text('#appBody'), 'note autosaved'); shot('extra/notes-list.png'); back()
    open_app('light'); page.wait_for_timeout(200); check(page.locator('.light').count() == 1, 'light opens'); page.click('.light-done'); page.wait_for_timeout(300)
    check(visible('#home'), 'light Done returns home')

    open_app('light'); page.wait_for_timeout(200); shot('extra/light.png'); page.click('.light-done'); page.wait_for_timeout(300)
    page.click('#homeLock'); page.wait_for_timeout(400)
    check(visible('#lock'), 'lock button returns to lock screen')
    check(page.evaluate('LS.settings.idleMin') == 2, 'default auto-lock is 2 minutes')
    # Battery shown only when the API exists (e.g. Android Chrome)
    p2 = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
    p2.goto(URL); p2.wait_for_timeout(800)
    has = p2.evaluate('typeof navigator.getBattery === "function"')
    check((not p2.eval_on_selector('.sb-batt', 'e => e.hidden')) == has, 'battery shown only when navigator.getBattery exists (exists=%s)' % has)
    check(page.evaluate('LS.buddyAsk ? true : false'), 'buddy loaded')
    b.close()
srv.terminate()
print('\nErrors:', errors if errors else 'none')
if errors: fails.append('console/page errors')
print('RESULT:', 'ALL PASSED' if not fails else f'{len(fails)} FAILED: {fails}')
sys.exit(1 if fails else 0)
