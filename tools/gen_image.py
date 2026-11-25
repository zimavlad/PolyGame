#!/usr/bin/env python3
"""Generate or edit an image with Gemini image models (Nano Banana) using reference images.

usage: gen_image.py --out out.png --prompt "..." [--ref a.jpg --ref b.webp ...] [--model gemini-3-pro-image] [--aspect 1:1]
The API key is read from GEMINI_API_KEY or from the file named by GEMINI_API_KEY_FILE. Never commit keys.
"""
import argparse, base64, json, mimetypes, os, sys, urllib.request

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--prompt', required=True)
    ap.add_argument('--ref', action='append', default=[])
    ap.add_argument('--model', default='gemini-3-pro-image')
    ap.add_argument('--aspect', default='1:1')
    a = ap.parse_args()
    key = os.environ.get('GEMINI_API_KEY') or open(os.environ['GEMINI_API_KEY_FILE']).read().strip()
    parts = []
    for r in a.ref:
        mt = mimetypes.guess_type(r)[0] or 'image/png'
        if r.endswith('.webp'): mt = 'image/webp'
        parts.append({'inline_data': {'mime_type': mt, 'data': base64.b64encode(open(r, 'rb').read()).decode()}})
    parts.append({'text': a.prompt})
    body = {'contents': [{'role': 'user', 'parts': parts}],
            'generationConfig': {'responseModalities': ['IMAGE', 'TEXT'], 'imageConfig': {'aspectRatio': a.aspect}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{a.model}:generateContent',
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode()[:800]); sys.exit(1)
    n = 0
    for c in res.get('candidates', []):
        for p in c.get('content', {}).get('parts', []):
            d = p.get('inlineData') or p.get('inline_data')
            if d:
                path = a.out if n == 0 else a.out.replace('.png', f'_{n}.png')
                open(path, 'wb').write(base64.b64decode(d['data'])); print('saved', path); n += 1
            elif p.get('text'): print('text:', p['text'][:300])
    if not n: print(json.dumps(res)[:800]); sys.exit(1)

if __name__ == '__main__':
    main()
