const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const port = 8765;
const root = __dirname;
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/forest.js', ['forest.js', 'text/javascript; charset=utf-8']],
  ['/webcam.js', ['webcam.js', 'text/javascript; charset=utf-8']],
  ['/background.js', ['background.js', 'text/javascript; charset=utf-8']],
  ['/vendor/face-api/face-api.min.js', ['vendor/face-api/face-api.min.js', 'text/javascript; charset=utf-8']],
  ['/vendor/face-api/model-data.js', ['vendor/face-api/model-data.js', 'text/javascript; charset=utf-8']],
  ['/forest2.png', ['forest2.png', 'image/png']],
  ['/forest1.png', ['forest1.png', 'image/png']],
  ['/flower.png', ['flower.png', 'image/png']],
  ['/assets/fairy.png', ['assets/fairy.png', 'image/png']]
]);
function openChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  const chrome = candidates.find(file => fs.existsSync(file));
  if (chrome) spawn(chrome, [`http://127.0.0.1:${port}`], { detached: true, stdio: 'ignore' }).unref();
  else console.log(`Open Chrome: http://127.0.0.1:${port}`);
}
const server = http.createServer((req, res) => {
  const file = publicFiles.get(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(root, file[0]), (error, body) => {
    if (error) { res.writeHead(404); res.end('File not found'); return; }
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' }); res.end(body);
  });
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Close the earlier forest window and try again.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Secret Forest: http://127.0.0.1:${port}`);
  console.log('Keep this window open. Close it to stop.');
  if (process.argv.includes('--open')) openChrome();
});
