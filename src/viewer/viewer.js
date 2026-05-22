/**
 * Specify7+ 3D Viewer
 * Inspired by UMORF viewer (umorf.ummp.lsa.umich.edu)
 *
 * Features:
 *  - STL / OBJ / PLY model loading
 *  - OrbitControls (rotate, pan, zoom)
 *  - Measurement tool (S = start, E = end, ESC = clear)
 *  - Background color switcher
 *  - Opacity / Ambient / Directional light sliders
 *  - Wireframe & double-sided toggles
 *  - Reset camera button
 *  - Download button
 */

import * as THREE from '../../lib/three/three.module.js';
import { OrbitControls } from '../../lib/three/jsm/OrbitControls.js';
import { STLLoader }     from '../../lib/three/jsm/STLLoader.js';
import { OBJLoader }     from '../../lib/three/jsm/OBJLoader.js';
import { PLYLoader }     from '../../lib/three/jsm/PLYLoader.js';

// ─── URL Parameters ───────────────────────────────────────────────────────────
const urlParams    = new URLSearchParams(window.location.search);
const modelUrl     = urlParams.get('url');
const displayTitle = urlParams.get('title') || urlParams.get('filename') || urlParams.get('name') || '3D Model';

// ─── Three.js globals ─────────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let meshGroup   = null;      // the loaded model group
let ambientLight, dirLight1, dirLight2;
let initialCamPos, initialCamTarget;
let material    = null;      // shared / representative material reference

// ─── Measurement state ────────────────────────────────────────────────────────
const MEASURE = { IDLE: 0, WAITING_END: 1 };
let measureState   = MEASURE.IDLE;
let measurePoints  = [];     // THREE.Vector3 world-space points
let measureLineObj = null;   // THREE.Line in the scene
let raycaster      = new THREE.Raycaster();
let mouse          = new THREE.Vector2();

// DOM refs (populated after DOMContentLoaded)
let container, measureCanvas, measureCtx;
let dotStart, dotEnd, measureResult, measureDistEl;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showError(msg) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('error-message').textContent = msg;
}

function hideLoading() {
    const el = document.getElementById('loading');
    el.classList.add('hidden');
}

// Project a THREE.Vector3 world point onto 2D screen coords
function worldToScreen(worldVec) {
    const vec = worldVec.clone().project(camera);
    const hw  = container.clientWidth  / 2;
    const hh  = container.clientHeight / 2;
    return {
        x: (vec.x + 1) * hw,
        y: (-vec.y + 1) * hh
    };
}

// ─── Measurement drawing ──────────────────────────────────────────────────────
function drawMeasureLine() {
    if (!measureCtx) return;
    measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);

    if (measurePoints.length === 0) return;

    const p0 = worldToScreen(measurePoints[0]);
    positionDot(dotStart, p0.x, p0.y);

    if (measurePoints.length < 2) return;

    const p1 = worldToScreen(measurePoints[1]);
    positionDot(dotEnd, p1.x, p1.y);

    // Draw dashed line
    measureCtx.beginPath();
    measureCtx.setLineDash([6, 4]);
    measureCtx.lineWidth   = 2;
    measureCtx.strokeStyle = '#ffcb05';
    measureCtx.moveTo(p0.x, p0.y);
    measureCtx.lineTo(p1.x, p1.y);
    measureCtx.stroke();
}

function positionDot(dotEl, x, y) {
    dotEl.style.left = x + 'px';
    dotEl.style.top  = y + 'px';
    dotEl.classList.remove('hidden');
}

function clearMeasurement() {
    measurePoints  = [];
    measureState   = MEASURE.IDLE;
    dotStart.classList.add('hidden');
    dotEnd.classList.add('hidden');
    measureResult.classList.add('hidden');
    if (measureCtx) measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
    if (measureLineObj) { scene.remove(measureLineObj); measureLineObj = null; }
}

function displayDistance(p0, p1) {
    const dist = p0.distanceTo(p1);
    let text;
    if (dist < 1)      text = (dist * 1000).toFixed(2) + ' mm';
    else if (dist < 100) text = dist.toFixed(3) + ' units';
    else               text = dist.toFixed(1) + ' units';
    measureDistEl.textContent = '📏 ' + text;
    measureResult.classList.remove('hidden');
}

// Pick a world-space point on the model surface under mouse
function pickPoint(event) {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const objects = [];
    if (meshGroup) meshGroup.traverse(c => { if (c.isMesh) objects.push(c); });
    const hits = raycaster.intersectObjects(objects, false);
    return hits.length ? hits[0].point.clone() : null;
}

// ─── Material helpers ─────────────────────────────────────────────────────────
function getAllMaterials() {
    const mats = [];
    if (!meshGroup) return mats;
    meshGroup.traverse(c => {
        if (c.isMesh) {
            const m = c.material;
            if (Array.isArray(m)) mats.push(...m);
            else mats.push(m);
        }
    });
    return mats;
}

// ─── Three.js initialisation ──────────────────────────────────────────────────
function initThree() {
    container = document.getElementById('threejs-container');

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Scene & background
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#00274c');

    // Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.001, 10000);
    camera.position.set(0, 0, 5);

    // Lights
    ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(1, 2, 3);
    scene.add(dirLight1);

    dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-2, -1, -2);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xffffff, 0.2);
    dirLight3.position.set(0, -5, 0);
    scene.add(dirLight3);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping    = true;
    controls.dampingFactor    = 0.08;
    controls.rotateSpeed      = 0.8;
    controls.zoomSpeed        = 1.2;
    controls.screenSpacePanning = true;

    // Resize
    window.addEventListener('resize', onResize);

    // Measurement overlay canvas
    measureCanvas = document.getElementById('measure-canvas');
    measureCtx    = measureCanvas.getContext('2d');
    resizeMeasureCanvas();

    // Animate
    animate();
}

function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    resizeMeasureCanvas();
}

function resizeMeasureCanvas() {
    measureCanvas.width  = container.clientWidth;
    measureCanvas.height = container.clientHeight;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    if (measurePoints.length > 0) drawMeasureLine();
}

// ─── Model loading ────────────────────────────────────────────────────────────
function getExtension(url) {
    const SUPPORTED = ['stl', 'obj', 'ply'];

    // 1. Extension from the viewer's own 'name' param (most reliable — set by content-script)
    const nameParam = urlParams.get('name') || urlParams.get('filename') || urlParams.get('title') || '';
    const extFromName = nameParam.split('.').pop().toLowerCase();
    if (SUPPORTED.includes(extFromName)) return extFromName;

    // 2. Extension from the URL path (before query string)
    const urlPath = url.split('?')[0];
    const extFromPath = urlPath.split('.').pop().toLowerCase();
    if (SUPPORTED.includes(extFromPath)) return extFromPath;

    // 3. Extension from 'filename=' inside the model URL's query string
    try {
        const params = new URLSearchParams(new URL(url).search);
        const fn = params.get('filename') || params.get('downloadname') || '';
        const extFromQuery = fn.split('.').pop().toLowerCase();
        if (SUPPORTED.includes(extFromQuery)) return extFromQuery;
    } catch (_) {}

    return extFromPath; // return whatever we got so the error message is useful
}

function loadModel(url) {
    const ext = getExtension(url);

    let loader;
    if      (ext === 'stl') loader = new STLLoader();
    else if (ext === 'obj') loader = new OBJLoader();
    else if (ext === 'ply') loader = new PLYLoader();
    else { showError('Unsupported format: .' + ext); return; }

    loader.load(
        url,
        (result) => onModelLoaded(result, ext),
        (xhr)    => {
            if (xhr.lengthComputable) {
                const pct = Math.round(xhr.loaded / xhr.total * 100);
                document.getElementById('loading-label').textContent = `Loading… ${pct}%`;
            }
        },
        (err)    => {
            console.error(err);
            showError('Error loading model. Check the URL and that the server allows cross-origin requests.');
        }
    );
}

function onModelLoaded(result, ext) {
    meshGroup = new THREE.Group();

    let geometry = null;

    if (ext === 'obj') {
        result.traverse(child => {
                if (child.isMesh) {
                    if (!child.geometry.attributes.normal) {
                        child.geometry.computeVertexNormals();
                    }
                    const hasColors = child.geometry.attributes.color !== undefined;
                const mat = new THREE.MeshStandardMaterial({
                    color: hasColors ? 0xffffff : 0xcccccc, 
                    roughness: 0.6, metalness: 0.1,
                    side: THREE.FrontSide, transparent: false, opacity: 1,
                    vertexColors: hasColors
                });
                child.material = mat;
                if (!geometry) geometry = child.geometry;
            }
        });

        // Update toggle state based on whether colors exist
        const vcToggle = document.getElementById('vertexcolor-toggle');
        const hasColors = geometry && geometry.attributes.color !== undefined;
        if (vcToggle) vcToggle.checked = hasColors;

        meshGroup.add(result);
    } else {
        geometry = result;
        
        // Compute normals if missing (some PLY files don't have them, making them appear black)
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }

        const hasColors = geometry.attributes.color !== undefined;
        material = new THREE.MeshStandardMaterial({
            color: hasColors ? 0xffffff : 0xcccccc, 
            roughness: 0.6, metalness: 0.1,
            side: THREE.FrontSide, transparent: false, opacity: 1,
            vertexColors: hasColors
        });
        const mesh = new THREE.Mesh(geometry, material);
        meshGroup.add(mesh);

        // Update toggle state based on whether colors exist
        const vcToggle = document.getElementById('vertexcolor-toggle');
        if (vcToggle) vcToggle.checked = hasColors;
    }

    if (geometry) {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Centre the group
        meshGroup.position.sub(center);

        // Fit camera
        geometry.computeBoundingSphere();
        fitCamera(geometry.boundingSphere.radius);
    }

    scene.add(meshGroup);
    hideLoading();
}

function fitCamera(radius) {
    const fovRad  = camera.fov * Math.PI / 180;
    const dist    = (radius / Math.sin(fovRad / 2)) * 1.4;
    camera.position.set(dist * 0.6, dist * 0.4, dist);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
    // Store for reset
    initialCamPos    = camera.position.clone();
    initialCamTarget = controls.target.clone();
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
function initKeyboard() {
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 's') {
            measureState = MEASURE.WAITING_END;
            measurePoints = [];
            dotStart.classList.add('hidden');
            dotEnd.classList.add('hidden');
            measureResult.classList.add('hidden');
            if (measureCtx) measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
        } else if (key === 'e' && measureState === MEASURE.WAITING_END) {
            // "End" is handled on the next click
        } else if (e.key === 'Escape') {
            clearMeasurement();
        }
    });
}

// ─── Mouse interaction for measurement ───────────────────────────────────────
function initMouseMeasure() {
    renderer.domElement.addEventListener('click', (e) => {
        if (measureState === MEASURE.IDLE) return;
        e.stopPropagation();

        const pt = pickPoint(e);
        if (!pt) return;

        if (measurePoints.length === 0) {
            // First point (S)
            measurePoints.push(pt);
            positionDot(dotStart, worldToScreen(pt).x, worldToScreen(pt).y);
        } else if (measurePoints.length === 1) {
            // Second point (E)
            measurePoints.push(pt);
            positionDot(dotEnd, worldToScreen(pt).x, worldToScreen(pt).y);

            // Draw 3D line
            const geo  = new THREE.BufferGeometry().setFromPoints(measurePoints);
            const mat2 = new THREE.LineBasicMaterial({ color: 0xffcb05, linewidth: 2 });
            if (measureLineObj) scene.remove(measureLineObj);
            measureLineObj = new THREE.Line(geo, mat2);
            scene.add(measureLineObj);

            displayDistance(measurePoints[0], measurePoints[1]);
            measureState = MEASURE.IDLE;
        }
    });
}

// ─── Settings panel wiring ────────────────────────────────────────────────────
function initSettingsPanel() {
    // Background swatches
    document.querySelectorAll('.swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            const col = sw.dataset.color;
            scene.background = new THREE.Color(col);
            document.body.style.background = col;
        });
    });

    // Opacity slider
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityVal    = document.getElementById('opacity-val');
    opacitySlider.addEventListener('input', () => {
        const v = parseFloat(opacitySlider.value) / 100;
        opacityVal.textContent = Math.round(v * 100) + '%';
        getAllMaterials().forEach(m => {
            m.transparent = v < 1;
            m.opacity = v;
            m.needsUpdate = true;
        });
    });

    // Ambient light slider
    const ambientSlider = document.getElementById('ambient-slider');
    const ambientVal    = document.getElementById('ambient-val');
    ambientSlider.addEventListener('input', () => {
        const v = parseFloat(ambientSlider.value) / 100;
        ambientVal.textContent = Math.round(v * 100) + '%';
        ambientLight.intensity = v;
    });

    // Directional light slider
    const dirSlider = document.getElementById('dir-slider');
    const dirVal    = document.getElementById('dir-val');
    dirSlider.addEventListener('input', () => {
        const v = parseFloat(dirSlider.value) / 100;
        dirVal.textContent = Math.round(v * 100) + '%';
        dirLight1.intensity = v;
        dirLight2.intensity = v * 0.35;
    });

    // Wireframe toggle
    document.getElementById('wireframe-toggle').addEventListener('change', (e) => {
        getAllMaterials().forEach(m => {
            m.wireframe = e.target.checked;
            m.needsUpdate = true;
        });
    });

    // Double-sided toggle
    document.getElementById('doubleside-toggle').addEventListener('change', (e) => {
        getAllMaterials().forEach(m => {
            m.side = e.target.checked ? THREE.DoubleSide : THREE.FrontSide;
            m.needsUpdate = true;
        });
    });

    // Vertex color toggle
    document.getElementById('vertexcolor-toggle').addEventListener('change', (e) => {
        const useColors = e.target.checked;
        getAllMaterials().forEach(m => {
            m.vertexColors = useColors;
            m.color.setHex(useColors ? 0xffffff : 0xcccccc);
            m.needsUpdate = true;
        });
    });

    // Reset camera
    document.getElementById('reset-camera-btn').addEventListener('click', () => {
        if (!initialCamPos) return;
        camera.position.copy(initialCamPos);
        controls.target.copy(initialCamTarget);
        controls.update();
    });

    // Download model
    document.getElementById('download-btn').addEventListener('click', () => {
        if (modelUrl) window.open(modelUrl, '_blank');
    });

    // Clear measurement button
    document.getElementById('clear-measure-btn').addEventListener('click', clearMeasurement);
}

// ─── Entry point ──────────────────────────────────────────────────────────────
function main() {
    // Grab DOM refs
    dotStart      = document.getElementById('dot-start');
    dotEnd        = document.getElementById('dot-end');
    measureResult = document.getElementById('measure-result');
    measureDistEl = document.getElementById('measure-distance');

    // Ensure double-sided toggle is off by default (user enables if needed)
    const dsToggle = document.getElementById('doubleside-toggle');
    if (dsToggle) dsToggle.checked = false;

    // Set model title
    document.getElementById('model-title-label').textContent = displayTitle;


    if (!modelUrl) {
        showError('No 3D model URL specified. Pass ?url=... in the query string.');
        return;
    }

    initThree();
    initKeyboard();
    initMouseMeasure();
    initSettingsPanel();
    loadModel(modelUrl);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
