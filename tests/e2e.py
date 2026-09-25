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
    # Simulate iPhone's motion permission prompt being answered with "Allow".
    ctx.add_init_script('try { DeviceMotionEvent.requestPermission = () => Promise.resolve("granted"); } catch (e) {}')
    ctx.route('https://api.open-meteo.com/**', fulfill_forecast)
    ctx.route('https://geocoding-api.open-meteo.com/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
              body=json.dumps({"results": [{"name": "New York", "latitude": 40.71, "longitude": -74.0, "admin1": "New York", "country_code": "US"}]})))
    # Wikipedia mock for the fixed test pages; everything else (e.g. the real 'Dinosaur' screenshot) goes to the network.
    from urllib.parse import urlparse, parse_qs
    SAFE_HTML = '<div class="mw-parser-output"><table class="infobox"><tr><th>Mock page</th></tr></table><p><b>Mock Safe Page</b> is about <a href="/wiki/Moon">the Moon</a> and <a href="https://youtube.com/x">a video site</a>.</p><script>window.__pwned=1</script><img src="x" onerror="window.__pwned=2"><p onclick="window.__pwned=3">Rocks are cool.</p><h2>References</h2><p>ref list</p></div>'
    def wiki(route):
        q = parse_qs(urlparse(route.request.url).query)
        g = lambda k: (q.get(k) or [''])[0]
        J = lambda obj: route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(obj))
        if g('action') == 'parse' and g('page') == 'Mock Safe Page':
            return J({'parse': {'title': 'Mock Safe Page', 'text': SAFE_HTML, 'categories': [{'category': 'Rocks'}]}})
        if g('action') == 'parse' and g('page') == 'Mystery Page':
            return J({'parse': {'title': 'Mystery Page', 'text': '<p>Nothing to see.</p>', 'categories': [{'category': 'Massacres_in_Europe'}]}})
        if g('action') == 'parse' and g('page') == 'Broken Page':
            return route.fulfill(status=500, body='oops')
        if g('list') == 'search' and g('srsearch') == 'rockmock':
            return J({'query': {'search': [{'title': 'Mock Safe Page', 'snippet': 'rocks'}, {'title': 'Porn star', 'snippet': 'x'}, {'title': 'Mystery Page', 'snippet': 'x'}]}})
        if g('prop') == 'categories' and 'Mock Safe Page' in g('titles'):
            return J({'query': {'pages': [{'title': 'Mock Safe Page', 'categories': [{'title': 'Category:Rocks'}]}, {'title': 'Mystery Page', 'categories': [{'title': 'Category:Massacres_in_Europe'}]}]}})
        return route.fallback()
    ctx.route('https://simple.wikipedia.org/**', wiki)
    ctx.route('https://kids.nationalgeographic.com/**', lambda r: r.fulfill(status=200, content_type='text/html', body='<html><body><h1>Nat Geo Kids (mock)</h1><a id="out" href="https://example.com/">out</a></body></html>'))
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    expected = []  # errors the test causes on purpose: the mocked HTTP 500 and the CSP block of the frame escape attempt
    def on_console(m):
        if m.type != 'error': return
        if "Framing 'https://example.com/' violates" in m.text or 'status of 500' in m.text: expected.append(m.text)
        else: errors.append('console.' + m.type + ': ' + m.text)
    page.on('console', on_console)
    page.goto(URL)
    page.wait_for_timeout(600)
    def shot(n):
        page.evaluate('document.getElementById("toast").classList.remove("show")'); page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(SHOTS, n))
    visible = lambda sel: page.eval_on_selector(sel, 'e => e.classList.contains("active")')

    check(visible('#lock'), 'lock screen shows first')
    check(page.title() == 'ShellOS', 'page title is ShellOS')
    check(page.evaluate('document.querySelector(\'meta[name="apple-mobile-web-app-title"]\').content') == 'ShellOS', 'apple-mobile-web-app-title is ShellOS')
    man = page.evaluate('fetch("manifest.json").then(r => r.json())')
    check(man['name'] == 'ShellOS' and man['short_name'] == 'ShellOS', 'manifest name/short_name ShellOS')
    check(page.text_content('.lock-brand') == 'ShellOS', 'lock screen shows ShellOS')
    check('frame-src' in page.evaluate('(document.querySelector(\'meta[http-equiv="Content-Security-Policy"]\') || {}).content || ""'), 'frame policy (CSP frame-src) installed')
    check(page.locator('#lockPad button').count() >= 11, 'keypad rendered')
    check(page.eval_on_selector('.sb-batt', 'e => e.hidden'), 'battery hidden when getBattery is missing (iPhone)')
    shot('shellos-lock.png')

    def tap(k): page.click(f'#lockPad button[data-k="{k}"]')
    for k in '1111': tap(k)
    page.wait_for_timeout(700)
    check(visible('#lock') and not visible('#home'), 'wrong code rejected')
    check('Wrong' in page.inner_text('#lockSub'), 'wrong code message shown')
    for k in '19845': tap(k)
    page.wait_for_timeout(700)
    check(visible('#lock') and not visible('#home'), 'lock screen rejects the developer code')
    # shaking on the lock screen does nothing
    def shake(direct=False):
        for i in range(6):
            if direct: page.evaluate('v => LS.voice.onMotion({ accelerationIncludingGravity: { x: v, y: 0, z: 9.8 } })', 18 if i % 2 else -18)
            else: page.evaluate('v => window.dispatchEvent(new DeviceMotionEvent("devicemotion", { accelerationIncludingGravity: { x: v, y: 0, z: 9.8 } }))', 18 if i % 2 else -18)
            page.wait_for_timeout(90)
    shake(direct=True); page.wait_for_timeout(200)
    check(page.locator('#voiceOverlay:not([hidden])').count() == 0, 'shake does nothing on the lock screen')
    tap('back'); page.wait_for_timeout(100)
    for k in '1234': tap(k)
    page.wait_for_timeout(800)
    check(visible('#home'), 'home screen after 1234')
    page.wait_for_selector('#modal:not([hidden])', timeout=4000)
    check('Shake for Buddy' in page.inner_text('#modalSheet'), 'motion permission sheet shown after first unlock')
    page.click('#modalSheet .primary-btn'); page.wait_for_timeout(500)
    check(page.evaluate('LS.settings.motionPerm') == 'granted', 'motion permission granted from the sheet: ' + page.evaluate('LS.settings.motionPerm'))
    labels = page.locator('#tiles .tile .lbl').all_inner_texts()
    print('   tiles:', labels)
    check(len(labels) == 15, '15 home apps')
    check(all(x in labels for x in ['Piano', 'Calendar', 'Dice', 'Shell']), 'new apps on the home screen by default (no dev tools)')
    mic = page.evaluate('LS.settings.micPerm')
    check(mic in ('granted', 'unavailable', 'denied'), 'mic permission requested after first unlock: ' + mic)
    pin = page.evaluate('localStorage.getItem("lockshell.pin.v1")')
    check(pin and '1234' not in pin and len(json.loads(pin)['hash']) == 64, 'passcode stored as SHA-256 hash')
    shot('shellos-home.png')

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

    # ================= Voice-only Buddy =================
    shake(); page.wait_for_timeout(400)
    check(page.locator('#voiceOverlay:not([hidden])').count() == 1, 'shake opens voice-only Buddy')
    check(page.locator('#voiceOverlay input, #voiceOverlay textarea').count() == 0, 'voice overlay has no text input')
    page.evaluate('LS.voice.ask("what is 12 times 7")'); page.wait_for_timeout(400)
    check('84' in page.inner_text('.voice-reply') and '12 times 7' in page.inner_text('.voice-heard'), 'voice Buddy shows what it heard and its reply')
    shot('voice-buddy.png')
    page.evaluate('LS.voice.ask("tell me something sexy")'); page.wait_for_timeout(300)
    check('Sorry' in page.inner_text('.voice-reply') and 'sexy' not in page.inner_text('#voiceOverlay'), 'voice Buddy uses the safety filter and does not echo blocked words')
    page.click('.voice-x'); page.wait_for_timeout(300)
    check(page.locator('#voiceOverlay:not([hidden])').count() == 0, 'X closes voice Buddy')
    page.click('#voiceFab'); page.wait_for_timeout(400)
    check(page.locator('#voiceOverlay:not([hidden])').count() == 1, 'floating mic button opens voice Buddy')
    page.evaluate('LS.voice.ask("hello")'); page.wait_for_timeout(16000)
    check(page.locator('#voiceOverlay:not([hidden])').count() == 0, 'voice Buddy auto-closes after idle')
    page.evaluate('LS.settings.shake = false'); shake(); page.wait_for_timeout(300)
    check(page.locator('#voiceOverlay:not([hidden])').count() == 0, 'shake toggle off disables shake'); page.evaluate('LS.settings.shake = true')

    # ================= About =================
    open_app('settings'); page.click('.set-row:has-text("About")'); page.wait_for_timeout(300)
    about = page.inner_text('#appBody')
    check(all(k in about for k in ['ShellOS', 'Version 1.2.0', 'Apps (15)', 'Games (8)', 'Buddy', 'Safety', 'Shell filter', 'Privacy', 'Open-Meteo', 'Wikipedia', 'iPhone limits', 'volume buttons', 'Guided Access', 'Limit Adult Websites', 'Kampf Kaiser']), 'About has version, apps, games, Buddy, safety, privacy, limits, Screen Time, credits')
    check('19845' not in about and '19845' not in page.content(), 'About never shows the developer code')
    shot('about.png'); back()
    page.click('.set-row:has-text("Shake for Buddy")'); page.wait_for_timeout(300); shot('extra/settings-shake.png'); back(); back()

    # ================= Shell =================
    open_app('shell'); page.wait_for_timeout(300)
    check(page.locator('.sh-tile').count() >= 8, 'Shell home shows kid website tiles')
    shot('shell-home.png')
    def addr(t):
        page.fill('.sh-addr', t); page.press('.sh-addr', 'Enter'); page.wait_for_timeout(700)
    addr('https://simple.wikipedia.org/wiki/Mock_Safe_Page'); page.wait_for_selector('.wk-article', timeout=6000)
    check(page.inner_text('.wk-article h1') == 'Mock Safe Page' and 'Rocks are cool' in page.inner_text('.wk-article'), 'safe article renders in-app (mocked Wikipedia)')
    check(page.evaluate('window.__pwned') is None and page.locator('.wk-article script, .wk-article img, .wk-article [onclick], .wk-article [onerror]').count() == 0, 'article HTML sanitized (no scripts, handlers or images)')
    check(page.locator('.wk-article a[data-wiki="Moon"]').count() == 1 and page.locator('.wk-article a[href*="youtube"]').count() == 0, 'internal links stay in-app; external links removed')
    check('ref list' not in page.inner_text('.wk-article'), 'reference sections dropped')
    addr('rockmock'); page.wait_for_selector('.sh-result', timeout=6000)
    res = page.locator('.sh-result b').all_inner_texts()
    check(res == ['Mock Safe Page'], 'search results filtered by title and category: ' + str(res))
    page.click('.sh-nav[aria-label="Shell home"]'); addr('simple.wikipedia.org/wiki/Mystery_Page'); page.wait_for_selector('.sh-blocked', timeout=6000)
    check("isn't available on ShellOS" in page.inner_text('.sh-blocked'), 'article with a blocked category shows the kid block screen')
    shot('shell-blocked.png')
    page.click('.sh-blocked .primary-btn'); page.wait_for_timeout(300)
    check(page.locator('.sh-blocked').count() == 0, 'block screen Back button works')
    addr('simple.wikipedia.org/wiki/Broken_Page'); page.wait_for_selector('.sh-blocked', timeout=6000)
    check(page.locator('.wk-article').count() == 0, 'API failure fails closed (nothing shown)')
    addr('s3x videos'); page.wait_for_timeout(300)
    check(page.locator('.sh-blocked').count() == 1 and page.locator('.sh-result').count() == 0, 'explicit search query shows nothing')
    addr('youtube.com'); check(page.locator('.sh-blocked').count() == 1, 'non-allowlisted URL is blocked')
    addr('https://evil.example/kids.nationalgeographic.com'); check(page.locator('.sh-blocked').count() == 1, 'look-alike URL is blocked')
    hist = page.evaluate('LS.shellHistory()')
    check(any(h['blocked'] and 'youtube' in h['target'] for h in hist), 'blocked attempts saved in Shell history')
    page.click('.sh-nav[aria-label="Shell home"]'); page.wait_for_timeout(200)
    page.click('.sh-tile[data-host="kids.nationalgeographic.com"]'); page.wait_for_timeout(1500)
    fr = [f for f in page.frames if f != page.main_frame]
    check(page.locator('iframe.sh-frame').count() == 1 and fr and 'Nat Geo Kids (mock)' in fr[0].inner_text('body'), 'allowlisted kid site loads in a frame (mocked)')
    sb = page.get_attribute('iframe.sh-frame', 'sandbox') or ''
    check('allow-scripts' in sb and 'allow-top-navigation' not in sb and 'allow-popups' not in sb, 'frame sandbox blocks top navigation and pop-ups')
    try: fr[0].evaluate('location.href = "https://example.com/"')
    except Exception: pass
    page.wait_for_timeout(1500)
    fr = [f for f in page.frames if f != page.main_frame]
    check(fr and 'example.com' not in fr[0].url and page.url.startswith('http://127.0.0.1'), 'a kid site cannot navigate its frame to another website (CSP): ' + (fr[0].url if fr else ''))
    check(any('example.com' in e for e in expected), 'browser reported the CSP frame-src block')
    back()
    # real Simple Wikipedia 'Dinosaur' (network) for the screenshot; falls back to the mocked page if offline
    open_app('shell'); page.wait_for_timeout(200)
    page.click('.sh-chips button:has-text("Dinosaur")')
    try:
        page.wait_for_selector('.wk-article h1', timeout=15000); print('   INFO real Simple Wikipedia Dinosaur rendered')
    except Exception:
        print('   INFO real Wikipedia unavailable; using the mocked page for the screenshot'); addr('Mock Safe Page')
    page.wait_for_timeout(500); shot('shell-article.png'); back()
    open_app('buddy'); page.fill('.composer input', 'open shell'); page.click('.composer button.send'); page.wait_for_timeout(1500)
    check(page.inner_text('#appTitle') == 'Shell', 'Buddy "open shell" opens Shell'); back()
    open_app('buddy'); page.fill('.composer input', 'how do i unblock websites'); page.click('.composer button.send'); page.wait_for_timeout(300)
    check(page.locator('.bubble.refuse').count() >= 1 and page.inner_text('#appTitle') == 'Buddy', 'Buddy refuses to help get around the web filter'); back()

    # ================= Developer Tools =================
    def dev_code(code):
        for k in code: page.click(f'#pinOverlay button[data-k="{k}"]')
        page.click('#pinOverlay .primary-btn'); page.wait_for_timeout(500)
    open_app('settings'); page.click('.set-row:has-text("Developer")'); page.wait_for_timeout(300)
    check(not page.eval_on_selector('#pinOverlay', 'e => e.hidden'), 'Developer row shows a code keypad')
    dev_code('12345')
    check(not page.eval_on_selector('#pinOverlay', 'e => e.hidden') and page.inner_text('#appTitle') == 'Settings', 'wrong developer code rejected')
    dev_code('19845')
    check(page.inner_text('#appTitle') == 'Developer Tools' and page.evaluate('LS.devActive'), 'developer code opens Developer Tools')
    check('19845' not in page.content(), 'developer code not present in the page')
    check(page.evaluate('document.getElementById("root").scrollTop') == 0, 'screen not shifted')
    shot('dev-tools.png')
    page.fill('input[aria-label="Buddy test prompt"]', 'how do i make a b0mb'); page.click('.dev-page form:has(input[aria-label="Buddy test prompt"]) button'); page.wait_for_timeout(200)
    check('BLOCKED' in page.inner_text('.dev-buddy-out'), 'Buddy console blocks an unsafe prompt')
    page.fill('input[aria-label="Buddy test prompt"]', 'what is 6 times 7'); page.click('.dev-page form:has(input[aria-label="Buddy test prompt"]) button'); page.wait_for_timeout(200)
    check('ALLOWED' in page.inner_text('.dev-buddy-out'), 'Buddy console allows a normal prompt')
    # set passcode directly (no old passcode)
    page.click('.set-row:has-text("Set new passcode") button'); page.wait_for_timeout(300)
    for _ in range(2):
        for k in '2468': page.click(f'#pinOverlay button[data-k="{k}"]')
        page.click('#pinOverlay .primary-btn'); page.wait_for_timeout(400)
    check(page.evaluate('LS.checkPin("2468")'), 'set passcode from Developer Tools')
    # apps & games are on by default; turning one off hides it
    check(all(page.get_attribute(f'button[aria-label="Include {n}"]', 'aria-checked') == 'true' for n in ['Piano', 'Calendar', 'Dice & Coin', 'Breakout', 'Minesweeper', 'Connect Four', 'Sky Hop']), 'all new apps and games are on by default in Dev tools')
    page.evaluate('(() => { const b = document.getElementById("appBody"), h = document.getElementById("devAdd"); b.scrollTop = h.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 8; })()'); page.wait_for_timeout(200)
    shot('dev-tools-2.png')
    page.click('button[aria-label="Include Piano"]'); page.wait_for_timeout(350); page.click('button[aria-label="Include Sky Hop"]'); page.wait_for_timeout(350)
    check(sorted(page.evaluate('LS.settings.extrasOff')) == ['piano', 'skyhop'], 'hidden apps/games saved')
    page.evaluate('(() => { const b = document.getElementById("appBody"), h = document.getElementById("devShell"); b.scrollTop = h.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 8; })()'); page.wait_for_timeout(200)
    shot('extra/dev-tools-shell.png')
    page.fill('input[aria-label="Add blocked word"]', 'zorblax'); page.click('form:has(input[aria-label="Add blocked word"]) button'); page.wait_for_timeout(300)
    check('zorblax' in page.evaluate('LS.settings.shell.blockWords'), 'custom blocked word saved')
    check(page.locator('.dev-hist > div').count() >= 3, 'Shell history visible in Dev tools')
    page.click('.dev-exit'); page.wait_for_timeout(300)
    check(page.inner_text('#appTitle') == 'Settings' and not page.evaluate('LS.devActive'), 'Exit returns to Settings')
    back()
    labels = page.locator('#tiles .tile .lbl').all_inner_texts()
    check('Piano' not in labels, 'hidden app removed from home')
    open_app('games'); check(page.locator('.game-card:has-text("Sky Hop")').count() == 0, 'hidden game removed from Games'); back()
    open_app('buddy'); page.fill('.composer input', 'open piano'); page.click('.composer button.send'); page.wait_for_timeout(1400)
    check(page.inner_text('#appTitle') == 'Buddy' and "isn't on this phone" in page.locator('.bubble.bot').last.inner_text(), 'Buddy will not open a hidden app'); back()
    open_app('shell'); addr('zorblax facts'); check(page.locator('.sh-blocked').count() == 1, 'custom blocked word blocks Shell search'); back()
    open_app('settings'); page.click('.set-row:has-text("Developer")'); page.wait_for_timeout(200); dev_code('19845')
    page.click('button[aria-label="Include Piano"]'); page.wait_for_timeout(350); page.click('button[aria-label="Include Sky Hop"]'); page.wait_for_timeout(350)
    page.click('.dev-exit'); page.wait_for_timeout(300); back()
    labels = page.locator('#tiles .tile .lbl').all_inner_texts()
    check(all(x in labels for x in ['Piano', 'Calendar', 'Dice']), 'new apps on home screen: ' + str(labels))
    shot('home-with-new-apps.png')
    open_app('piano'); page.wait_for_timeout(300)
    box = page.locator('.wkey').nth(3).bounding_box(); page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] - 30); page.mouse.down(); page.wait_for_timeout(150)
    check(page.locator('.wkey.down').count() == 1, 'piano key plays'); shot('piano.png'); page.mouse.up(); back()
    open_app('calendar'); page.wait_for_timeout(200)
    page.click('.cal-day.today'); page.click('text=+ Add event'); page.fill('.sheet input[type=text]', 'Soccer practice'); page.fill('.sheet input[type=time]', '16:30'); page.click('.sheet .primary-btn'); page.wait_for_timeout(200)
    check('Soccer practice' in page.inner_text('#appBody'), 'calendar event added'); shot('extra/calendar.png'); back()
    open_app('dice'); page.click('.big-roll'); page.wait_for_timeout(1100)
    check('Total' in page.inner_text('.dice-total'), 'dice rolled: ' + page.inner_text('.dice-total')); shot('extra/dice.png')
    page.click('.seg button:has-text("Coin")'); page.click('.big-roll'); page.wait_for_timeout(1500)
    check(page.inner_text('.dice-total') in ('Heads!', 'Tails!'), 'coin flipped'); shot('extra/coin.png'); back()
    open_app('games'); page.wait_for_timeout(200)
    check(page.locator('.game-card').count() == 8, '8 games in Games (4 new ones on by default)'); shot('games-new.png')
    page.click('.game-card:has-text("Breakout")'); page.wait_for_timeout(300)
    page.click('canvas.board2'); page.wait_for_timeout(1200); shot('breakout.png'); back()
    page.click('.game-card:has-text("Minesweeper")'); page.wait_for_timeout(300)
    page.click('.ms-c >> nth=44'); page.wait_for_timeout(200)
    check(page.locator('.ms-c.open').count() > 1, 'minesweeper reveals cells'); shot('minesweeper.png'); back()
    page.click('.game-card:has-text("Connect Four")'); page.wait_for_timeout(300)
    page.click('.c4-cell >> nth=38'); page.wait_for_timeout(1200)
    check(page.locator('.c4-cell.red').count() == 1 and page.locator('.c4-cell.yel').count() == 1, 'connect four AI replied'); shot('extra/connect4.png'); back()
    page.click('.game-card:has-text("Sky Hop")'); page.wait_for_timeout(300)
    for _ in range(4): page.click('canvas.board2'); page.wait_for_timeout(250)
    shot('extra/skyhop.png'); back(); back()
    open_app('buddy'); page.fill('.composer input', 'play minesweeper'); page.click('.composer button.send'); page.wait_for_timeout(1500)
    check(page.inner_text('#appTitle') == 'Minesweeper', 'Buddy opens a new game'); back(); back()
    # Developer Tools closes to the lock screen on auto-lock
    open_app('settings'); page.click('.set-row:has-text("Developer")'); page.wait_for_timeout(200); dev_code('19845')
    page.evaluate('LS.settings.idleMin = 0.03'); page.wait_for_timeout(7000)
    check(visible('#lock') and not page.evaluate('LS.devActive'), 'Developer Tools closes to lock screen on auto-lock')
    page.evaluate('LS.settings.idleMin = 2; LS.saveSettings()')
    for k in '1234': tap(k)
    page.wait_for_timeout(700)
    check(visible('#lock'), 'old passcode rejected after change')
    for k in '2468': tap(k)
    page.wait_for_timeout(800)
    check(visible('#home'), 'new passcode unlocks')

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
    # Existing 1.1 install: settings v2 (new items were opt-in) + a saved passcode -> migrated, nothing lost
    c3 = b.new_context(viewport={'width': 390, 'height': 844})
    c3.add_init_script('''if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1");
      localStorage.setItem("lockshell.settings.v2", JSON.stringify({ theme: "dark", idleMin: 5, hidden: ["camera"], extras: [], weatherUnit: "C" }));
      localStorage.setItem("lockshell.pin.v1", JSON.stringify({ salt: "abc", hash: "f".repeat(64), len: 4 })); }''')
    p3 = c3.new_page(); p3.goto(URL); p3.wait_for_timeout(800)
    tiles3 = p3.evaluate('Array.from(document.querySelectorAll("#tiles .tile")).map(t => t.dataset.app)')
    st3 = p3.evaluate('JSON.parse(localStorage.getItem("lockshell.settings.v3"))')
    check(all(x in tiles3 for x in ['piano', 'calendar', 'dice', 'shell']) and 'camera' not in tiles3, 'migration: new apps on for existing installs, hidden apps stay hidden')
    check(st3['theme'] == 'dark' and st3['idleMin'] == 5 and st3['weatherUnit'] == 'C' and st3['extrasOff'] == [], 'migration: old settings kept in v3')
    check(p3.evaluate('JSON.parse(localStorage.getItem("lockshell.pin.v1")).hash') == 'f' * 64, 'migration: saved passcode untouched')
    c3.close()
    b.close()
srv.terminate()
print('\nErrors:', errors if errors else 'none')
if errors: fails.append('console/page errors')
print('RESULT:', 'ALL PASSED' if not fails else f'{len(fails)} FAILED: {fails}')
sys.exit(1 if fails else 0)
