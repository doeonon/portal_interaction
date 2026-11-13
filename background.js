const backgroundButton = document.querySelector('#background-button');
const backgroundReset = document.querySelector('#background-reset');
const backgroundFile = document.querySelector('#background-file');
const backgroundLayers = document.querySelectorAll('.scene');
let backgroundUrl = null, backgroundVersion = 0;

backgroundButton.addEventListener('click', () => backgroundFile.click());
backgroundFile.addEventListener('change', async () => {
  const file = backgroundFile.files[0];
  backgroundFile.value = '';
  if (!file) return;
  const version = ++backgroundVersion;
  const url = URL.createObjectURL(file);
  const image = new Image(); image.src = url;
  try {
    await image.decode();
    if (version !== backgroundVersion) { URL.revokeObjectURL(url); return; }
    backgroundLayers.forEach(layer => { layer.style.backgroundImage = `url("${url}")`; });
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    backgroundUrl = url;
    backgroundReset.hidden = false;
    notice.textContent = '새 숲을 적용했어요. 마우스를 움직여보세요. 파일을 다시 열면 기본 숲으로 돌아가요.';
  } catch {
    URL.revokeObjectURL(url);
    if (version === backgroundVersion) notice.textContent = '이 이미지를 열 수 없어요. JPG, PNG 같은 다른 이미지를 골라주세요.';
  }
});
backgroundReset.addEventListener('click', () => {
  backgroundVersion++;
  backgroundLayers.forEach(layer => { layer.style.removeProperty('background-image'); });
  if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
  backgroundUrl = null;
  backgroundReset.hidden = true;
  notice.textContent = '기본 숲으로 돌아왔어요.';
});
