import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 300; 

const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 전역 변수들
let particlesMesh; 
let particleVelocities = []; 
let originalPositions = []; 
let currentImage = null;    
let currentMode = 'idle';   

// UI 요소들 (오타 수정 완료!)
const controlsPanel = document.getElementById('controlsPanel');
const resSlider = document.getElementById('resSlider');
const spreadSlider = document.getElementById('speedSlider'); // 🌟 여기 오타 수정됨!
const turbSlider = document.getElementById('turbSlider');
const windSlider = document.getElementById('windSlider');

const btnReset = document.getElementById('btnReset');
const btnExplode = document.getElementById('btnExplode');
const btnWave = document.getElementById('btnWave');
const btnImage = document.getElementById('btnImage');
const btnVideo = document.getElementById('btnVideo');

// 이미지를 파티클로 변환
function processImageToParticles(img) {
  if(particlesMesh) scene.remove(particlesMesh);
  particleVelocities = [];
  originalPositions = [];
  currentMode = 'idle'; 
  
  // 🌟 새 이미지가 올라오면 카메라 각도를 정면(초기 상태)으로 리셋!
  controls.reset(); 
  camera.position.set(0, 0, 300);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const maxSize = parseInt(resSlider.value); 
  let width = img.width;
  let height = img.height;
  
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  } else {
    width = Math.floor(width);
    height = Math.floor(height);
  }
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height).data;
  const positions = [];
  const colors = [];

  for(let y = 0; y < height; y++) {
    for(let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const a = imageData[index + 3];

      if(a > 0) {
        const pX = x - width / 2;
        const pY = -(y - height / 2); 
        const pZ = 0; 

        positions.push(pX, pY, pZ);
        originalPositions.push(pX, pY, pZ); 
        colors.push(imageData[index]/255, imageData[index+1]/255, imageData[index+2]/255); 

        particleVelocities.push(
          (Math.random() - 0.5) * 2, 
          (Math.random() - 0.5) * 2, 
          (Math.random() - 0.5) * 3  
        );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); 

  let pSize = 1.5 * (200 / maxSize);
  const material = new THREE.PointsMaterial({ size: pSize, vertexColors: true });
  
  particlesMesh = new THREE.Points(geometry, material);
  scene.add(particlesMesh);
}

// 파일 업로드 이벤트
document.getElementById('imageInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  controlsPanel.style.display = 'block';

  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.onload = () => {
    currentImage = img; 
    processImageToParticles(img);
  };
});

// 컨트롤 이벤트 연결
resSlider.addEventListener('change', () => {
  if(currentImage) processImageToParticles(currentImage);
});

btnReset.addEventListener('click', () => {
  currentMode = 'idle';
  if(!particlesMesh) return;
  const positions = particlesMesh.geometry.attributes.position.array;
  for(let i = 0; i < positions.length; i++) {
    positions[i] = originalPositions[i];
  }
  particlesMesh.geometry.attributes.position.needsUpdate = true;
});

btnExplode.addEventListener('click', () => currentMode = 'explode');
btnWave.addEventListener('click', () => currentMode = 'wave');

// 이미지 저장
btnImage.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'PARSAWOO_Particle.png';
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
});

// 영상 녹화
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

btnVideo.addEventListener('click', () => {
  if (!isRecording) {
    const stream = renderer.domElement.captureStream(60); 
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'PARSAWOO_Record.webm'; a.click();
      URL.revokeObjectURL(url); recordedChunks = []; 
    };
    mediaRecorder.start(); isRecording = true;
    btnVideo.innerText = "Stop & Save"; btnVideo.classList.add('recording');
  } else {
    mediaRecorder.stop(); isRecording = false;
    btnVideo.innerText = "Record Video"; btnVideo.classList.remove('recording');
  }
});

// 메인 애니메이션 루프
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  if(particlesMesh) {
    const spread = parseFloat(spreadSlider.value);
    const turb = parseFloat(turbSlider.value);
    const wind = parseFloat(windSlider.value);
    const time = performance.now() * 0.003; 

    const positions = particlesMesh.geometry.attributes.position.array;

    if(currentMode === 'explode') {
      for(let i = 0; i < positions.length; i += 3) {
        positions[i] += (particleVelocities[i] * spread) + wind; 
        positions[i+1] += particleVelocities[i+1] * spread;   
        positions[i+2] += particleVelocities[i+2] * spread;   
      }
      particlesMesh.geometry.attributes.position.needsUpdate = true; 

    } else if(currentMode === 'wave') {
      for(let i = 0; i < positions.length; i += 3) {
        positions[i] += (particleVelocities[i] * spread * 0.1) + wind;       
        positions[i+1] += particleVelocities[i+1] * spread * 0.1;   
        
        const waveX = Math.sin(time + positions[i+1] * 0.05) * turb * 0.3;
        const waveY = Math.cos(time + positions[i] * 0.05) * turb * 0.3;
        const waveZ = Math.sin(time + positions[i]*0.05 + positions[i+1]*0.05) * turb * 0.5;

        positions[i] += waveX;
        positions[i+1] += waveY;
        positions[i+2] += (particleVelocities[i+2] * spread * 0.1) + waveZ;   
      }
      particlesMesh.geometry.attributes.position.needsUpdate = true; 

    } 
    // 🌟 대기 모드(idle)일 때 자동으로 회전하던 코드를 완전히 삭제했습니다!
    // 이제 사진을 올려도, 사용자가 마우스로 돌리거나 모드를 바꾸기 전까지는 완벽하게 정면을 응시하며 멈춰있습니다.
  }
  
  renderer.render(scene, camera);
}

animate();