const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
let html = read('index.html');
const image = fs.readFileSync(path.join(__dirname, 'assets/secret-forest.png')).toString('base64');
const css = read('style.css').replace('assets/secret-forest.png', `data:image/png;base64,${image}`);
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);
const fairyImage = fs.readFileSync(path.join(__dirname, 'assets/fairy.png')).toString('base64');
html = html.replace('src="assets/fairy.png"', `src="data:image/png;base64,${fairyImage}"`);
const scripts = ['vendor/face-api/face-api.min.js', 'vendor/face-api/model-data.js', 'forest.js', 'webcam.js', 'background.js'];
for (const file of scripts) {
  let source = read(file);
  if (file.endsWith('face-api.min.js')) source = `/* face-api.js 0.22.2\n${read('vendor/face-api/LICENSE')}\nBundled TensorFlow.js Core 1.7.4\n${read('vendor/face-api/TENSORFLOW-LICENSE')}\n*/\n` + source;
  source = source.replace(/<\/script/gi, '<\\/script');
  html = html.replace(`<script src="${file}"></script>`, () => `<script>\n${source}\n</script>`);
}
const output = path.join(__dirname, '보라빛_비밀의_숲.html');
fs.writeFileSync(output, html, 'utf8');
console.log(`Saved: ${output} (${fs.statSync(output).size} bytes)`);
