"""Short smoke test against the live GitHub Pages URL. Run: python3 tests/live_smoke.py [url]"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'https://kampfguy.github.io/LockShell/'
errors, fails = [], []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    # only count console errors from ShellOS itself (kid sites in the frame log their own noise)
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and (m.location or {}).get('url', '').startswith(URL.split('?')[0]) else None)
    r = page.goto(URL + '?smoke=1'); page.wait_for_timeout(1500)
    check(r.status == 200, 'live page 200')
    check(page.title() == 'ShellOS', 'title ShellOS')
    check(page.evaluate('LS.VERSION') == '1.3.0', 'LS.VERSION 1.3.0')
    act = lambda s: page.eval_on_selector(s, 'e => e.classList.contains("active")')
    tap = lambda k: page.click(f'#lockPad button[data-k="{k}"]')
    for k in '19845': tap(k)
    page.wait_for_timeout(700); check(act('#lock') and not act('#home'), 'lock screen rejects developer code')
    tap('back'); page.wait_for_timeout(100)
    for k in '1234': tap(k)
    page.wait_for_timeout(900); check(act('#home'), '1234 unlocks')
    try: page.wait_for_selector('#modal:not([hidden])', timeout=3000); page.click('#modalSheet .ghost-btn'); page.wait_for_timeout(300)
    except Exception: pass
    labels = page.locator('#tiles .tile .lbl').all_inner_texts()
    check(all(x in labels for x in ['YouTube', 'Photos', 'Stories', 'Quiz', 'Piano', 'Shell']) and len(labels) == 19, 'new apps on home by default (19 tiles)')
    page.click('#tiles .tile[data-app="youtube"]'); page.wait_for_timeout(800)
    check(page.locator('.yt-card').count() >= 30, 'YouTube lists the approved library')
    page.click('.yt-card >> nth=0'); page.wait_for_timeout(2500)
    f = page.locator('iframe.yt-frame')
    sb = f.get_attribute('sandbox') or ''; src = f.get_attribute('src') or ''
    check(src.startswith('https://www.youtube-nocookie.com/embed/') and 'rel=0' in src and 'allow-popups' not in sb and 'allow-top-navigation' not in sb and 'allow-scripts' in sb,
          'YouTube plays in a sandboxed youtube-nocookie iframe (' + sb + ')')
    page.wait_for_timeout(4000)
    yf = [x for x in page.frames if 'youtube-nocookie.com' in x.url]
    ok = False
    try: ok = bool(yf) and yf[0].locator('video').count() >= 1
    except Exception: pass
    check(ok, 'real YouTube embed loads inside the sandbox')
    page.click('#appBack'); page.wait_for_timeout(300); page.click('#appBack'); page.wait_for_timeout(400)
    page.click('#voiceFab'); page.wait_for_timeout(400)
    check(page.locator('#voiceOverlay:not([hidden])').count() == 1, 'mic button opens voice Buddy'); page.click('.voice-x'); page.wait_for_timeout(300)
    page.click('#tiles .tile[data-app="settings"]'); page.wait_for_timeout(500)
    page.click('.set-row:has-text("About")'); page.wait_for_timeout(300)
    check('Limit Adult Websites' in page.inner_text('#appBody') and 'youtube safety' in page.inner_text('#appBody').lower() and '19845' not in page.content(), 'About expanded, no dev code'); page.click('#appBack'); page.wait_for_timeout(300)
    page.click('.set-row:has-text("Developer")'); page.wait_for_timeout(300)
    def code(c):
        for k in c: page.click(f'#pinOverlay button[data-k="{k}"]')
        page.click('#pinOverlay .primary-btn'); page.wait_for_timeout(500)
    code('55555'); check(page.inner_text('#appTitle') == 'Settings', 'wrong developer code rejected')
    code('19845'); check(page.inner_text('#appTitle') == 'Developer Tools', 'developer code opens Developer Tools')
    page.click('button[aria-label="Include Piano"]'); page.wait_for_timeout(300)
    page.click('.dev-exit'); page.wait_for_timeout(300); page.click('#appBack'); page.wait_for_timeout(400)
    check(page.locator('#tiles .tile[data-app="piano"]').count() == 0, 'hiding Piano in Dev tools removes it')
    page.click('#tiles .tile[data-app="games"]'); page.wait_for_timeout(400)
    page.click('.game-card:has-text("Sky Hop")'); page.wait_for_timeout(600)
    check(page.inner_text('#appTitle') == 'Sky Hop', 'Sky Hop starts'); page.click('#appBack'); page.wait_for_timeout(200); page.click('#appBack'); page.wait_for_timeout(300)
    page.click('#tiles .tile[data-app="shell"]'); page.wait_for_timeout(500)
    page.click('.sh-chips button:has-text("Dinosaur")')
    try: page.wait_for_selector('.wk-article h1', timeout=15000)
    except Exception: pass
    check(page.locator('.wk-article h1').count() == 1 and page.inner_text('.wk-article h1') == 'Dinosaur', 'real Simple Wikipedia "Dinosaur" renders in Shell')
    def addr(t):
        page.fill('.sh-addr', t); page.press('.sh-addr', 'Enter'); page.wait_for_timeout(2500)
    addr('simple.wikipedia.org/wiki/Nanjing_Massacre'); check(page.locator('.sh-blocked').count() == 1, 'massacre article blocked')
    addr('simple.wikipedia.org/wiki/Pornography'); check(page.locator('.sh-blocked').count() == 1, 'sexual article blocked')
    addr('youtube.com'); check(page.locator('.sh-blocked').count() == 1 and 'youtube app' in page.inner_text('.sh-blocked').lower(), 'youtube.com blocked in Shell, points to YouTube app')
    addr('example.com'); check(page.locator('.sh-blocked').count() == 1, 'non-allowlisted site blocked')
    page.click('.sh-nav[aria-label="Shell home"]'); page.wait_for_timeout(300)
    page.click('.sh-tile[data-host="kids.nationalgeographic.com"]'); page.wait_for_timeout(7000)
    fr = [f for f in page.frames if f != page.main_frame]
    ok = False
    try: ok = bool(fr) and 'nationalgeographic' in fr[0].url and len(fr[0].inner_text('body')) > 200
    except Exception: pass
    check(ok, 'real kid site (Nat Geo Kids) loads in the Shell frame')
    caches = page.evaluate('caches.keys()')
    check('lockshell-v1.3.0' in caches, 'SW cache lockshell-v1.3.0 (' + ','.join(caches) + ')')
    check(not errors, 'no ShellOS page/console errors ' + str(errors[:3]))
    b.close()
print('RESULT:', 'ALL PASSED' if not fails else 'FAILED ' + str(fails))
sys.exit(1 if fails else 0)
