// 얼굴 위치만 찾아 실시간 영상을 잘라 그립니다. 녹화·저장·업로드하지 않습니다.
const cameraButton = document.querySelector('#camera-button');
const cameraStatus = document.querySelector('#camera-status');
const cameraVideo = document.querySelector('#camera-video');
const portrait = document.querySelector('#face-portrait');
const portraitContext = portrait.getContext('2d');
let cameraStream = null, cameraSession = 0, detectionTimer = null;
let detectorLoading = null, faceBox = null, faceSeenAt = -Infinity;
let lastDetectedVideoTime = -1;

function setCameraStatus(message) { cameraStatus.textContent = message; }

async function loadFaceDetector() {
  if (!detectorLoading) {
    detectorLoading = (async () => {
      await faceapi.tf.ready();
      const model = globalThis.FAIRY_FACE_MODEL;
      const bytes = Uint8Array.from(atob(model.weights), value => value.charCodeAt(0));
      const weights = faceapi.tf.io.decodeWeights(bytes.buffer, model.specs);
      faceapi.nets.tinyFaceDetector.loadFromWeightMap(weights);
    })().catch(error => { detectorLoading = null; throw error; });
  }
  return detectorLoading;
}

function stopCamera(message = '웹캠을 껐어요. 다시 켜면 내 얼굴이 나타나요.') {
  cameraSession++;
  clearTimeout(detectionTimer); detectionTimer = null;
  const stream = cameraStream; cameraStream = null;
  if (stream) stream.getTracks().forEach(track => track.stop());
  cameraVideo.srcObject = null;
  faceBox = null; faceSeenAt = -Infinity; lastDetectedVideoTime = -1;
  fairy.classList.remove('has-face');
  portraitContext.clearRect(0, 0, portrait.width, portrait.height);
  cameraButton.disabled = false;
  cameraButton.setAttribute('aria-pressed', 'false');
  cameraButton.querySelector('span:last-child').textContent = '웹캠 켜기';
  setCameraStatus(message);
}

async function detectFace(session) {
  if (!cameraStream || session !== cameraSession) return;
  try {
    if (cameraVideo.readyState >= 2 && cameraVideo.currentTime !== lastDetectedVideoTime) {
      lastDetectedVideoTime = cameraVideo.currentTime;
      const result = await faceapi.detectSingleFace(cameraVideo,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: .45 }));
      if (!cameraStream || session !== cameraSession) return;
      if (result) {
        const box = result.box;
        if (!faceBox || performance.now() - faceSeenAt > 800) {
          faceBox = { x: box.x, y: box.y, width: box.width, height: box.height };
        } else {
          for (const key of ['x', 'y', 'width', 'height']) faceBox[key] += (box[key] - faceBox[key]) * .35;
        }
        faceSeenAt = performance.now();
        setCameraStatus('얼굴을 찾았어요! 마우스를 움직여 나만의 요정을 만나보세요.');
      } else if (performance.now() - faceSeenAt > 800) {
        faceBox = null;
        fairy.classList.remove('has-face');
        setCameraStatus('카메라 정면을 봐주세요. 얼굴을 찾으면 자동으로 요정 안에 넣어드려요.');
      }
    }
  } catch {
    if (session === cameraSession) stopCamera('얼굴을 찾는 기능을 시작하지 못했어요. 웹캠을 다시 켜주세요.');
    return;
  }
  if (cameraStream && session === cameraSession) detectionTimer = setTimeout(() => detectFace(session), 140);
}

function drawPortrait() {
  if (cameraStream && faceBox && cameraVideo.readyState >= 2 && performance.now() - faceSeenAt < 1000) {
    const vw = cameraVideo.videoWidth, vh = cameraVideo.videoHeight;
    const aspect = portrait.width / portrait.height;
    const cropHeight = Math.min(vh, vw / aspect, Math.max(faceBox.height * 1.1, faceBox.width * 1.22 / aspect));
    const cropWidth = cropHeight * aspect;
    const sx = Math.max(0, Math.min(vw - cropWidth, faceBox.x + faceBox.width / 2 - cropWidth / 2));
    const sy = Math.max(0, Math.min(vh - cropHeight, faceBox.y + faceBox.height * .48 - cropHeight / 2));
    if (cropHeight > 0) {
      portraitContext.save();
      portraitContext.clearRect(0, 0, portrait.width, portrait.height);
      portraitContext.translate(portrait.width, 0); portraitContext.scale(-1, 1);
      portraitContext.drawImage(cameraVideo, sx, sy, cropWidth, cropHeight, 0, 0, portrait.width, portrait.height);
      portraitContext.restore();
      fairy.classList.add('has-face');
    }
  } else { fairy.classList.remove('has-face'); }
  requestAnimationFrame(drawPortrait);
}
requestAnimationFrame(drawPortrait);

cameraButton.addEventListener('click', async () => {
  if (cameraStream) { stopCamera(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus('Chrome에서 HTML 파일을 직접 열거나, 이 폴더의 실행.cmd로 열어주세요.');
    return;
  }
  const session = ++cameraSession;
  cameraButton.disabled = true;
  cameraButton.querySelector('span:last-child').textContent = '웹캠 준비 중…';
  setCameraStatus('Chrome에서 카메라 사용을 허용해주세요. 마이크는 사용하지 않아요.');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
    });
    if (session !== cameraSession) { stream.getTracks().forEach(track => track.stop()); return; }
    cameraStream = stream; cameraVideo.srcObject = stream;
    await cameraVideo.play();
    await loadFaceDetector();
    if (session !== cameraSession) return;
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (session === cameraSession) stopCamera('카메라 연결이 끊어졌어요. 웹캠을 다시 켜주세요.');
    }));
    cameraButton.disabled = false;
    cameraButton.setAttribute('aria-pressed', 'true');
    cameraButton.querySelector('span:last-child').textContent = '웹캠 끄기';
    setCameraStatus('얼굴을 찾고 있어요. 카메라 정면을 봐주세요.');
    detectFace(session);
  } catch (error) {
    if (session !== cameraSession) return;
    const messages = {
      NotAllowedError: '카메라 사용이 허용되지 않았어요. Chrome에서 카메라를 허용한 뒤 다시 켜주세요.',
      NotFoundError: '연결된 웹캠이 없어요. 웹캠을 연결한 뒤 다시 켜주세요.',
      NotReadableError: '웹캠을 사용할 수 없어요. 다른 카메라 앱을 닫고 다시 켜주세요.'
    };
    stopCamera(messages[error.name] || '웹캠을 시작하지 못했어요. Chrome에서 다시 열어주세요.');
  }
});
addEventListener('pagehide', () => stopCamera());
