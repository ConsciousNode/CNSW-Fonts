import sys, time, socket, subprocess, json
from playwright.sync_api import sync_playwright
def serve(root):
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    return port, subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
p1, s1 = serve('/tmp/forge-delivered'); p2, s2 = serve('/tmp/fonttest'); time.sleep(0.7)
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1400, 'height': 1600}); errs = []; ext = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('request', lambda r: ext.append(r.url) if not r.url.startswith(f'http://127.0.0.1:{p1}') and not r.url.startswith('data:') and not r.url.startswith('blob:') else None)
        pg.goto(f'http://127.0.0.1:{p1}/cnsw-font-forge.html'); time.sleep(2.5)
        pg.screenshot(path='/home/claude/kehai-audit/forge-page.png')
        q = b.new_page(viewport={'width': 1600, 'height': 420}); q.goto(f'http://127.0.0.1:{p2}/specimen.html'); time.sleep(1.5)
        st = q.evaluate("() => Promise.all([...document.fonts].map(f => f.load().then(() => f.family + ':' + f.status, e => f.family + ':ERR')))")
        q.screenshot(path='/home/claude/kehai-audit/specimen-dom.png')
        b.close()
        print(json.dumps({'forgePageErrors': errs, 'externalRequests': ext, 'webFonts': st}))
finally:
    s1.terminate(); s2.terminate()
