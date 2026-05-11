// Híbrid 3D Viewer for Specify7+
// Switches between Three.js (STL, OBJ, GLTF) and 3DHOP (NXS, NXZ, PLY)

import * as THREE from '../../lib/three/three.module.js';
import { OrbitControls } from '../../lib/three/jsm/OrbitControls.js';
import { STLLoader } from '../../lib/three/jsm/STLLoader.js';
import { OBJLoader } from '../../lib/three/jsm/OBJLoader.js';
import { PLYLoader } from '../../lib/three/jsm/PLYLoader.js';
// import { GLTFLoader } from '../../lib/three/jsm/GLTFLoader.js';

function showError(message) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const errorMsg = document.getElementById('error-message');

    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
    if (errorMsg) errorMsg.textContent = message;
}

const urlParams = new URLSearchParams(window.location.search);
const modelUrl = urlParams.get('url');
const modelTitle = urlParams.get('title');
const modelFilename = urlParams.get('filename');
const modelName = urlParams.get('name');
const displayTitle = modelTitle || modelFilename || modelName || '3D Model';

let threeScene, threeCamera, threeRenderer, threeControls, threeMesh;
let hopPresenter = null;

/**
 * Detect engine based on file extension
 */
function getEngineType(url) {
    if (!url) return null;
    const ext = url.split('.').pop().toLowerCase().split('?')[0];
    if (['nxs', 'nxz', 'ply'].includes(ext)) {
        return '3dhop';
    }
    if (['stl', 'obj', 'gltf', 'glb'].includes(ext)) {
        return 'threejs';
    }
    return 'threejs'; // Fallback
}

/**
 * Initialize the appropriate engine
 */
async function init() {
    if (!modelUrl) {
        showError('No 3D model URL specified');
        return;
    }

    document.getElementById('model-title').textContent = displayTitle;
    document.getElementById('download-btn').addEventListener('click', () => {
        window.open(modelUrl, '_blank');
    });

    const engineType = getEngineType(modelUrl);
    console.log('Specify7+: Using engine:', engineType);

    if (engineType === '3dhop') {
        init3DHOP();
    } else {
        initThreeJS();
    }
}

/**
 * 3DHOP ENGINE
 */
function init3DHOP() {
    document.getElementById('3dhop').style.display = 'block';
    document.getElementById('threejs-container').style.display = 'none';

    // 3DHOP initialization logic
    // We use the globally available Presenter from hop.js (loaded via script tag)
    if (typeof Presenter === 'undefined') {
        showError('3DHOP library not loaded correctly');
        return;
    }

    hopPresenter = new Presenter("draw-canvas");

    hopPresenter.setScene({
        meshes: {
            "MainMesh": { url: modelUrl }
        },
        modelInstances: {
            "MainModel": { mesh: "MainMesh" }
        },
        trackball: {
            type: SphereTrackball,
            trackOptions: {
                startPhi: 35.0,
                startTheta: 45.0,
                startDistance: 2.5,
                minMaxPhi: [-90, 90],
                minMaxDist: [0.1, 10.0]
            }
        }
    });

    // Setup 3DHOP toolbar
    window.actionsToolbar = (action) => {
        if(action=='home') hopPresenter.resetTrackball();
        else if(action=='zoomin') hopPresenter.zoomIn();
        else if(action=='zoomout') hopPresenter.zoomOut();
        else if(action=='light') { 
            hopPresenter.enableLightTrackball(!hopPresenter.isLightTrackballEnabled()); 
            // lightSwitch(); // Optional visual feedback
        }
        else if(action=='full') fullscreenSwitch();
    };

    // 3DHOP handles loading state internally, but we can hide our spinner
    // once the scene is ready. 3DHOP doesn't have a simple "onLoad" for the whole scene,
    // but Nexus models stream.
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
    }, 1000);
}

/**
 * THREE.JS ENGINE
 */
function initThreeJS() {
    document.getElementById('3dhop').style.display = 'none';
    const container = document.getElementById('threejs-container');
    container.style.display = 'block';

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x1a1a1a);

    threeCamera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    threeCamera.position.set(5, 5, 5);

    threeRenderer = new THREE.WebGLRenderer({ antialias: true });
    threeRenderer.setSize(container.clientWidth, container.clientHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(threeRenderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    threeScene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 10, 10);
    threeScene.add(dirLight);

    threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;

    loadThreeModel(modelUrl);

    window.addEventListener('resize', () => {
        threeCamera.aspect = container.clientWidth / container.clientHeight;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(container.clientWidth, container.clientHeight);
    });

    function animate() {
        requestAnimationFrame(animate);
        threeControls.update();
        threeRenderer.render(threeScene, threeCamera);
    }
    animate();
}

function loadThreeModel(url) {
    const ext = url.split('.').pop().toLowerCase().split('?')[0];
    let loader;

    if (ext === 'stl') loader = new STLLoader();
    else if (ext === 'obj') loader = new OBJLoader();
    else if (ext === 'ply') loader = new PLYLoader();
    else {
        showError('Unsupported format for Three.js engine: ' + ext);
        return;
    }

    loader.load(url, (result) => {
        let geometry = result.isBufferGeometry ? result : null;
        
        if (ext === 'obj') {
            threeMesh = result;
            result.traverse(child => {
                if (child.isMesh) geometry = child.geometry;
            });
        } else {
            const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide });
            threeMesh = new THREE.Mesh(geometry, material);
        }

        if (geometry) {
            geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            geometry.boundingBox.getCenter(center);
            if (ext === 'obj') threeMesh.position.sub(center);
            else geometry.translate(-center.x, -center.y, -center.z);
            
            fitThreeCamera(geometry);
        }

        threeScene.add(threeMesh);
        document.getElementById('loading').classList.add('hidden');
    }, undefined, (err) => {
        console.error(err);
        showError('Error loading model in Three.js');
    });
}

function fitThreeCamera(geometry) {
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere.radius;
    const fov = threeCamera.fov * (Math.PI / 180);
    let distance = radius / Math.sin(fov / 2);
    distance *= 1.5;
    threeCamera.position.set(distance, distance, distance);
    threeCamera.lookAt(0, 0, 0);
    threeControls.target.set(0, 0, 0);
    threeControls.update();
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
