import { TilesRenderer } from '3d-tiles-renderer';
import { DebugTilesPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
	Scene,
	WebGLRenderer,
	PerspectiveCamera,
	DirectionalLight,
	AmbientLight,
	Sphere,
	BoxGeometry,
	MeshBasicMaterial,
	Mesh,
	Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let camera, controls, scene, renderer, tiles;

const params = {
	enableDebug: true,
	displayBoxBounds: true,
	displaySphereBounds: true,
	errorTarget: 6,
	maxDepth: 15,
};

init();
animate();

function init() {
	// Initialize three.js scene
	scene = new Scene();
	camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
	renderer = new WebGLRenderer({ antialias: true });

	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x263238);
	document.body.appendChild(renderer.domElement);

	// Add lighting
	const dirLight = new DirectionalLight(0xffffff, 1);
	dirLight.position.set(1, 2, 3);
	scene.add(dirLight);

	const ambLight = new AmbientLight(0xffffff, 0.4);
	scene.add(ambLight);

	// Add basic controls (rotation and pan only)
	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableZoom = false; // Disable OrbitControls zoom - we'll handle it ourselves
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	
	// Custom Potree-style zoom implementation
	let zoomSpeed = 0;
	
	const handleWheel = (event) => {
		event.preventDefault();
		
		// Get camera's forward direction (where it's looking)
		const direction = camera.getWorldDirection(new Vector3());
		
		// Calculate zoom speed based on distance to scene center, not target
		const sceneCenter = new Vector3(0, 0, 0);
		const distanceToScene = camera.position.distanceTo(sceneCenter);
		
		// Slower, more controlled zoom speed
		const zoomFactor = event.deltaY > 0 ? 1.05 : 0.95;
		const maxZoomSpeed = Math.max(0.01, distanceToScene * 0.02); // Reduced from 0.1 to 0.02
		const zoomAmount = (event.deltaY > 0 ? maxZoomSpeed : -maxZoomSpeed);
		
		// Move camera forward/backward along view direction
		const offset = direction.clone().multiplyScalar(zoomAmount);
		camera.position.add(offset);
		
		// Update controls target to follow camera movement
		const newTarget = camera.position.clone().add(direction.clone().multiplyScalar(distanceToScene * 0.5));
		controls.target.copy(newTarget);
		
		// Very aggressive near/far plane settings
		camera.near = 0.001;
		camera.far = 2000000;
		camera.updateProjectionMatrix();
		
		console.log(`Pos: [${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}], Distance to scene: ${distanceToScene.toFixed(2)}`);
	};
	
	renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

	// Test cube removed - it was blocking navigation

	// Initialize tiles
	loadTiles();

	// Handle window resize
	window.addEventListener('resize', onWindowResize);
}

function loadTiles() {
	// Get dataset URL from query parameter, fallback to default
	const urlParams = new URLSearchParams(window.location.search);
	const url = urlParams.get('dataset') || './3dtiles2/tileset.json';
	console.log('Loading tileset from:', url);

	// Initialize tiles renderer
	tiles = new TilesRenderer(url);
	tiles.registerPlugin(new DebugTilesPlugin());
	
	// Add DRACO decompression support
	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath('https://unpkg.com/three@0.170.0/examples/jsm/libs/draco/gltf/');
	
	tiles.registerPlugin(new GLTFExtensionsPlugin({
		dracoLoader: dracoLoader,
	}));
	
	// Set camera and resolution
	tiles.setCamera(camera);
	tiles.setResolutionFromRenderer(camera, renderer);

	// Add event listeners
	tiles.addEventListener('load-tile-set', () => {
		console.log('*** TILESET LOADED ***');
		console.log('Root tile:', tiles.root);
		
		// Center the tiles using bounding sphere
		const sphere = new Sphere();
		if (tiles.getBoundingSphere(sphere)) {
			console.log('Bounding sphere:', sphere);
			tiles.group.position.copy(sphere.center).multiplyScalar(-1);
			
			// Position camera appropriately
			const distance = sphere.radius * 2;
			camera.position.set(distance, distance, distance);
			camera.lookAt(0, 0, 0);
			controls.update();
			
			console.log('Camera positioned at distance:', distance);
		}
	});

	tiles.addEventListener('load-model', () => {
		console.log('*** MODEL LOADED ***');
	});

	tiles.addEventListener('load-error', (event) => {
		console.error('*** LOAD ERROR ***', event);
	});

	// Add tiles to scene
	scene.add(tiles.group);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	if (tiles) {
		tiles.setResolutionFromRenderer(camera, renderer);
	}
}

function animate() {
	requestAnimationFrame(animate);

	// Update controls damping
	controls.update();

	if (tiles) {
		// Update tiles properties
		tiles.errorTarget = params.errorTarget;
		tiles.maxDepth = params.maxDepth;

		// Update debug plugin
		const plugin = tiles.getPluginByName('DEBUG_TILES_PLUGIN');
		if (plugin) {
			plugin.enabled = params.enableDebug;
			plugin.displayBoxBounds = params.displayBoxBounds;
			plugin.displaySphereBounds = params.displaySphereBounds;
		}

		// Update tiles - camera matrix must be up to date
		camera.updateMatrixWorld();
		tiles.update();
	}

	renderer.render(scene, camera);
}