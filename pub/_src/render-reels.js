// Rendu des reels : reel.html image par image (1080×1920, dsf 1) → ffmpeg H.264.
// Usage : node render-reels.js <reel|all> [--preview t1,t2,...]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const OUTDIR = path.join(ROOT, '..', 'videos');
const FPS = 30;
const [which, flag, list] = process.argv.slice(2);

// Index des séquences (temps de chaque image)
const seq = {};
for (const f of fs.readdirSync(path.join(ROOT, 'footage', 'seq'))) if (f.endsWith('.json')) seq[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(ROOT, 'footage', 'seq', f))).frames.map((x) => x.t);
fs.writeFileSync(path.join(ROOT, 'footage', 'seq.js'), 'window.SEQ=' + JSON.stringify(seq) + ';');

(async () => {
  global.window = {}; require(path.join(ROOT, 'reels.js'));
  const names = which === 'all' ? Object.keys(window.REELS) : which.split(',');
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const name of names) {
    await page.goto('file://' + path.join(ROOT, 'reel.html') + '?r=' + name);
    await page.waitForFunction(() => window.READY === true);
    const dur = await page.evaluate(() => window.DURATION);
    if (flag === '--preview') {
      const pdir = path.join(ROOT, 'preview'); fs.mkdirSync(pdir, { recursive: true });
      for (const t of list.split(',').map(Number)) {
        await page.evaluate((t) => window.render(t), t);
        await page.screenshot({ path: path.join(pdir, `${name}_${t}.png`) });
      }
      console.log('preview', name); continue;
    }
    const out = path.join(OUTDIR, name + '.mp4');
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(dur * FPS); const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.render(t), i / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
    console.log(name, n, 'images', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close();
})();
