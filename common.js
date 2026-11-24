/* Shared settings + helpers for index.html (public page) and admin.html (indexer) */
const CONFIG = {
  eventTitle: "Sneh Snamelan 2026",      // shown as the page heading
  eventSubtitle: "Upload a selfie and we'll find every photo you're in.",
  credit: "Designed and Developed By: Nikunj Soni & Sonam Soni",
  indexUrl: "index.json",                // file produced by admin.html
  threshold: 0.5,                        // lower = stricter (0.45 strict, 0.5 balanced, 0.6 loose)
  faceApiUrl: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.js",
  modelUrl: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/"
};

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src));
    document.head.appendChild(s);
  });
}

async function loadFaceModels() {
  if (!window.faceapi) await loadScript(CONFIG.faceApiUrl);
  await faceapi.tf.ready();
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(CONFIG.modelUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(CONFIG.modelUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(CONFIG.modelUrl)
  ]);
}

/* Blob/File -> canvas, scaled so the longest side <= maxSide (respects EXIF rotation) */
async function blobToCanvas(blob, maxSide) {
  let bmp;
  try { bmp = await createImageBitmap(blob, { imageOrientation: "from-image" }); }
  catch (e) { bmp = await createImageBitmap(blob); }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c;
}

async function detectFaces(canvas, minConfidence = 0.5) {
  return faceapi
    .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence }))
    .withFaceLandmarks()
    .withFaceDescriptors();
}

function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < 128; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/* index.photos: [{id, n, f:[Float32Array(128)...]}]  selfies: [Float32Array(128)...]
   Returns photos whose closest face is within `threshold`, best match first. */
function matchPhotos(photos, selfies, threshold) {
  const out = [];
  for (const p of photos) {
    let best = Infinity;
    for (const face of p.f) for (const s of selfies) {
      const d = euclid(face, s);
      if (d < best) best = d;
    }
    if (best <= threshold) out.push({ id: p.id, n: p.n, d: best });
  }
  return out.sort((a, b) => a.d - b.d);
}

const driveThumb = (id, w) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
const driveThumbAlt = (id, w) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;
const driveDownload = (id) => `https://drive.google.com/uc?export=download&id=${id}`;

if (typeof module !== "undefined") module.exports = { euclid, matchPhotos };
