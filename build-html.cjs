const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
let html = read('index.html');
const image = fs.readFileSync(path.join(__dirname, 'forest2.png')).toString('base64');
const brightForest = fs.readFileSync(path.join(__dirname, 'forest1.png')).toString('base64');
const css = read('style.css').replace('forest2.png', `data:image/png;base64,${image}`)
  .replace('forest1.png', `data:image/png;base64,${brightForest}`);
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);
const fairyImage = fs.readFileSync(path.join(__dirname, 'assets/fairy.png')).toString('base64');
html = html.replace('src="assets/fairy.png"', `src="data:image/png;base64,${fairyImage}"`);
const flowerImage = fs.readFileSync(path.join(__dirname, 'flower.png')).toString('base64');
html = html.replace('src="flower.png"', `src="data:image/png;base64,${flowerImage}"`);
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
