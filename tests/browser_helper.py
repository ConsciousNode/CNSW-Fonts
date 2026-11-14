#!/usr/bin/env python3
import base64
import json
import os
import tempfile
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

def main():
    repo_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    html_path = os.path.join(repo_dir, 'cnsw-font-forge.html')
    json_path = os.path.join(repo_dir, 'fonts', 'cnsw-fonts.json')
    screenshots_dir = os.path.join(repo_dir, 'screenshots')
    os.makedirs(screenshots_dir, exist_ok=True)

    with open(json_path, 'r', encoding='utf-8') as f:
        orig_json = json.load(f)
    with open(html_path, 'rb') as f:
        html_b64 = base64.b64encode(f.read()).decode('ascii')

    dl_dir = tempfile.mkdtemp(prefix='cnsw-dl-')
    opts = Options()
    opts.binary_location = '/usr/bin/chromium'
    opts.add_argument('--headless=new')
    opts.add_argument('--no-sandbox')
    opts.add_argument('--no-zygote')
    opts.add_argument('--disable-gpu')
    opts.add_argument('--disable-dev-shm-usage')
    opts.add_argument('--window-size=1400,2200')
    opts.add_experimental_option('prefs', {
        'download.default_directory': dl_dir,
        'download.prompt_for_download': False,
    })
    opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

    service = Service('/usr/bin/chromedriver')
    driver = webdriver.Chrome(service=service, options=opts)
    report = {
        'pageErrors': [],
        'loadedFonts': [],
        'editDiffs': [],
        'reimportRestored': False,
        'ttfNativeMatch': {},
        'screenshots': [],
    }

    try:
        driver.get('data:text/html;base64,' + html_b64)
        time.sleep(1.0)

        # Check browser console errors
        logs = driver.get_log('browser')
        for entry in logs:
            if entry.get('level') == 'SEVERE':
                report['pageErrors'].append(entry.get('message'))

        # Verify 4 WOFF FontFaces loaded
        loaded_fonts = driver.execute_script("""
            const out = [];
            for (const f of document.fonts) {
                if (f.status === 'loaded') out.push(f.family);
            }
            return out;
        """)
        report['loadedFonts'] = loaded_fonts

        # Capture 4x specimen screenshots
        for fid in ['sans', 'serif', 'thesuramos']:
            el = driver.find_element(By.CSS_SELECTOR, f'canvas[data-specimen="{fid}-4x"]')
            out_png = os.path.join(screenshots_dir, f'{fid}-4x.png')
            el.screenshot(out_png)
            report['screenshots'].append(f'screenshots/{fid}-4x.png')

        # Drive editor with real clicks: toggle 3 pixels in 'A' (code 65, sans)
        coords = [(0, 0), (0, 1), (6, 2)]
        for r, c in coords:
            btn = driver.find_element(By.CSS_SELECTOR, f'#editor-grid button[data-row="{r}"][data-col="{c}"]')
            btn.click()

        # Click export JSON button and read downloaded file
        driver.find_element(By.ID, 'export-json').click()
        dl_file = os.path.join(dl_dir, 'cnsw-fonts.json')
        for _ in range(30):
            if os.path.exists(dl_file):
                break
            time.sleep(0.1)
        with open(dl_file, 'r', encoding='utf-8') as f:
            exported = json.load(f)

        # Compare exported vs original
        diffs = []
        for fid in ['sans', 'serif', 'thesuramos']:
            for code in range(32, 128):
                k = str(code)
                r1 = orig_json['fonts'][fid]['glyphs'][k]
                r2 = exported['fonts'][fid]['glyphs'][k]
                for r in range(len(r1)):
                    for c in range(len(r1[r])):
                        if r1[r][c] != r2[r][c]:
                            diffs.append([fid, code, r, c])
        report['editDiffs'] = diffs

        # Re-import original JSON via file input
        file_input = driver.find_element(By.ID, 'import-json')
        file_input.send_keys(json_path)
        time.sleep(0.5)
        restored_str = driver.execute_script('return window.CNSWForge.getJsonString();')
        restored = json.loads(restored_str)
        report['reimportRestored'] = (restored == orig_json)

        # Measure Chromium native TTF rendering vs bitmaps (in a separate test-harness data URL)
        targets = [
            ('consciousnode-sans.ttf', 'sans', 'ink', 'ConsciousNode Sans'),
            ('cnsw-serif.ttf', 'serif', 'ink', 'CNSW Serif'),
            ('times-new-thesuramos.ttf', 'thesuramos', 'ink', 'Times New Thesuramos'),
            ('times-new-thesuramos-shadow.ttf', 'thesuramos', 'shadow', 'Times New Thesuramos Shadow'),
        ]
        for ttf_file, fid, mode, fam in targets:
            with open(os.path.join(repo_dir, 'fonts', ttf_file), 'rb') as f:
                b64 = base64.b64encode(f.read()).decode('ascii')
            fobj = orig_json['fonts'][fid]
            w, h = fobj['width'], fobj['height']
            baseline = fobj['metrics']['baselineRow']
            target_ch = '-' if mode == 'shadow' else ('+' if fobj['type'] == 'ternary' else '#')

            harness_html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
            <canvas id="c" width="{w}" height="{h}"></canvas>
            <script>
            window.measureTtf = async function(b64, fam, w, h, baseline) {{
              const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
              const face = new FontFace(fam, bin);
              await face.load();
              document.fonts.add(face);
              const cv = document.getElementById('c');
              const ctx = cv.getContext('2d', {{ willReadFrequently: true }});
              ctx.font = h + 'px "' + fam + '"';
              ctx.textBaseline = 'alphabetic';
              const out = [];
              for (let code = 32; code <= 126; code++) {{
                ctx.clearRect(0, 0, w, h);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(String.fromCharCode(code), 0, baseline + 1);
                const img = ctx.getImageData(0, 0, w, h).data;
                const bits = [];
                for (let i = 0; i < w * h; i++) bits.push(img[i * 4 + 3] >= 128 ? 1 : 0);
                out.push(bits);
              }}
              return out;
            }};
            </script></body></html>"""
            driver.get('data:text/html;base64,' + base64.b64encode(harness_html.encode('utf-8')).decode('ascii'))
            rendered = driver.execute_script('return window.measureTtf(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);', b64, fam, w, h, baseline)
            total_px = 0
            matched_px = 0
            for idx, code in enumerate(range(32, 127)):
                rows = fobj['glyphs'][str(code)]
                bits = rendered[idx]
                for r in range(h):
                    for c in range(w):
                        total_px += 1
                        expected = 1 if rows[r][c] == target_ch else 0
                        if bits[r * w + c] == expected:
                            matched_px += 1
            pct = round(100.0 * matched_px / total_px, 2)
            report['ttfNativeMatch'][ttf_file] = {'matched': matched_px, 'total': total_px, 'pct': pct}

    finally:
        driver.quit()

    print(json.dumps(report))

if __name__ == '__main__':
    main()
