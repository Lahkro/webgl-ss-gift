/**
 * WebGL Secret Santa Gift Box Reveal
 * Author: Lahkro
 * 
 * An interactive "loot box" type animation showing a user's santee using the three.js(https://threejs.org/) (r168) WebGL library.
 * This was created for use in tadmozeltov's (https://git.tadmozeltov.com/tadmozeltov/secret-santa) 
 * Secret Santa "Meowmas" web application (https://santa.tadmozeltov.com/)
 * 
 */

import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import WebGL from "three/addons/capabilities/WebGL.js";

// SCENE & MODEL OPTIONS //
const options = {
	// Scene Options
	backgroundColor: new THREE.Color(0x0A0E10),
	ambientColor: new THREE.Color('gray'),
	lightColor: new THREE.Color(0xFFFFFF),
	lightIntensity: 200,
	lightPosition: [3.04, 4.213, 4.948],
	lightShadows: true,
	cameraPosition: [12.546, 4.350, 6.371],
	cameraRotation: [-0.534, 1.037, 0.471],
	cameraFOV: 39.59,
	cameraPath: './public/models/camera.glb',

	// Model Options
	presentModelPath: './public/models/present.glb',
	effectsModelPath: './public/models/effects.glb',
	outlineColor: new THREE.Color(0x000000),
	ribbonColor: new THREE.Color(0xFF9C00),
	lidColor: new THREE.Color(0x13370a),
	boxColor: new THREE.Color(0x0D2207),
	insideColor: new THREE.Color(0xFFFFFF),
	effectColor: new THREE.Color(0xFFC94A),
	boxTexture: './public/textures/octad_xmas_wrapping_paper.webp',
}

const boxOpeningClips = [ // Clips to play from 'allClips' when clicking to open box
	'BoxOpen',
	'TopPhysics',
	'ExplosionScale',
	'ExplosionKey',
	'ChargeEffect'
]

let windowWidth, windowHeight, windowAspectRatio, scale;
let clock, scene, renderer, effect, camera, loader, loadingManager;
let pointer, raycaster, opened;
let mixer, allClips, initAction, controls;

// Checks for WebGL support
if (WebGL.isWebGL2Available()) {

	// var stats = new Stats();
	// document.body.appendChild(stats.dom);

	loadingManager = new THREE.LoadingManager();

	// loadingManager.onStart = function (url, item, total) {

	// }

	const progressBar = document.getElementById('progress-bar');
	loadingManager.onProgress = function (url, loaded, total) {
		progressBar.value = (loaded / total) * 100;
	}

	const progressBarContainer = document.querySelector('.progress-bar-container');
	loadingManager.onLoad = function () {
		progressBarContainer.style.display = 'none';
		initAction.play(); // Play the box dropping animation
	}

	loadingManager.onError = function (url) {
		console.error(`Error Loading: ${url}`);
	}

	init();

} else {

	const warning = WebGL.getWebGLErrorMessage();
	document.getElementById('container').appendChild(warning);

}

// Setup renderer & scene objects
function init() {

	windowWidth = window.visualViewport.width;
	windowHeight = window.visualViewport.height;
	windowAspectRatio = windowWidth / windowHeight
	scale = windowHeight;

	clock = new THREE.Clock();
	scene = new THREE.Scene();

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(windowWidth, windowHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.shadowMap.enabled = true;
	renderer.setAnimationLoop(animate);
	document.body.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize);
	window.addEventListener('mousemove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);

	camera = new THREE.PerspectiveCamera(options.cameraFOV, windowAspectRatio, 0.1, 100);
	controls = new OrbitControls(camera, renderer.domElement);

	pointer = new THREE.Vector2();
	raycaster = new THREE.Raycaster();
	opened = false;

	// Provide a DRACOLoader instance to decode compressed mesh data
	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath('./node_modules/three/examples/jsm/libs/draco/');
	dracoLoader.preload();
	loader.setDRACOLoader(dracoLoader);

	// Environment, camera, and light settings
	scene.background = options.backgroundColor;

	camera.position.set(...options.cameraPosition);
	camera.rotation.set(...options.cameraRotation);
	controls.update();

	const ambientLight = new THREE.AmbientLight(options.ambientColor);
	scene.add(ambientLight);

	const light = new THREE.PointLight(options.lightColor, options.lightIntensity, 100);
	light.position.set(...options.lightPosition);
	light.castShadow = options.lightShadows;
	light.shadow.mapSize.width = 2048;
	light.shadow.mapSize.height = 2048;
	light.shadow.bias = -0.0001;
	light.shadow.radius = -0.0001;
	scene.add(light);

	effect = new OutlineEffect(renderer);

	mixer = new THREE.AnimationMixer(scene);
	allClips = new Array();

	// Import/Load Present GLTF
	loadModel(options.presentModelPath);
	loadModel(options.effectsModelPath);

	console.table(options);
}

function animate() {

	const delta = clock.getDelta();

	mixer.update(delta);

	controls.update();

	effect.render(scene, camera);

}

// Updates scene render size to always fit window
function onWindowResize() {
	windowWidth = window.visualViewport.width;
	windowHeight = window.visualViewport.height;

	camera.aspect = windowWidth / windowHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(windowWidth, windowHeight);
	effect.setSize(windowWidth, windowHeight);
}

function onPointerMove(event) {

	pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
	pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

	checkIntersection();
}

function onPointerUp(event) {
	checkIntersection(true);
}

function checkIntersection(clicked = false) {

	raycaster.setFromCamera(pointer, camera);

	const intersects = raycaster.intersectObject(scene, true);

	// If pointer is over the box
	if (intersects.length > 0 && (intersects[0].object.parent.name == 'Present_Box' || 'Present_Top')) {

		const selectedObject = intersects[0].object;

		// If pointer has clicked & wasn't already opened
		if (clicked && !opened) {
			opened = true;
			playSelectedClips(allClips, boxOpeningClips);
		}

	} else {

		// Do some effect to indicate hovering over box

	}

}

function loadModel(modelPath) {
	loader.load(modelPath, function (gltf) {

		// Traverse model for overrides
		gltf.scene.traverse((obj) => {

			// Override Materials with Toon Shading
			if (obj.material) {

				if (obj.material.name == 'Effect') { // Effect or particle objects
					obj.material = materialConvert(new THREE.MeshBasicMaterial(), obj.material, options.effectColor);
					obj.material.side = THREE.DoubleSide;

				} else { // Non Effect Objects

					if (obj.material.name == 'Ribbon') {
						obj.material = materialConvert(new THREE.MeshToonMaterial(), obj.material, options.ribbonColor);
					}

					if (obj.material.name == 'Box Wrapping Top') {
						obj.material = materialConvert(new THREE.MeshToonMaterial(), obj.material, options.lidColor);
					}

					if (obj.material.name == "Box Wrapping") {
						obj.material = materialConvert(new THREE.MeshToonMaterial(), obj.material, null, loadTexture(options.boxTexture));
					}

					if (obj.material.name == "Box Inside") {
						obj.material = materialConvert(new THREE.MeshBasicMaterial(), obj.material, options.insideColor);
					}

					obj.castShadow = true;
					obj.receiveShadow = true;
				}
			}
		});

		allClips.push(...gltf.animations);

		// Setup box dropping animation to play after scene initially loads
		const clip = THREE.AnimationClip.findByName(allClips, 'BoxDrop');
		if (clip) {
			initAction = mixer.clipAction(clip);
			initAction.clampWhenFinished = true;
			initAction.setLoop(THREE.LoopOnce);
		}

		scene.add(gltf.scene);

	}, function (xhr) { // Load Progress

		console.log((xhr.loaded / xhr.total * 100) + '% loaded');

	}, function (error) { // Load Error

		console.error('Error', error);

	}
	);
}

/**
 * Loads texture from given path, sets formatting, and returns texture.
 *
 * @param {String} path - path to texture.
 * @param {THREE.NoColorSpace|THREE.SRGBColorSpace|THREE.LinearSRGBColorSpace} colorSpace - defines texture color space.
 * @param {THREE.RepeatWrapping|THREE.ClampToEdgeWrapping|THREE.MirroredRepeatWrapping} wrapS - defines how the texture is wrapped in U direction.
 * @param {THREE.RepeatWrapping|THREE.ClampToEdgeWrapping|THREE.MirroredRepeatWrapping} wrapT - defines how the texture is wrapped in V direction.
 * @param {Array<Number>} repeat - times the texture is repeated in each direction U and V.
 * @returns {THREE.Texture}
 */
function loadTexture(path, colorSpace = THREE.SRGBColorSpace, wrapS = THREE.RepeatWrapping, wrapT = THREE.RepeatWrapping, repeat = [1, 1]) {

	const texture = new THREE.TextureLoader(loadingManager).load(path);
	texture.colorSpace = colorSpace;
	texture.wrapS = wrapS;
	texture.wrapT = wrapT;
	texture.repeat.set(...repeat);
	texture.flipY = false;

	return texture;
}

/**
 * Converts one material to another and returns the converted material.
 *
 * @param {THREE.Material} material - material to convert to.
 * @param {THREE.Material} original - original material.
 * @param {THREE.Color} color - new color override.
 * @param {THREE.Texture} map - new map override.
 * @returns {THREE.Material}
 */
function materialConvert(material = new THREE.MeshToonMaterial(), original, color = null, map = null) {
	material.copy(original);

	if (color) material.color.set(color);
	if (map) material.map = map;

	material.shadowSide = THREE.FrontSide;

	return material;
}

/**
 * Plays selected clips
 *
 * @param {Array<THREE.AnimationClip>} clips - material to convert to.
 * @param {Array<string>} selection - original material.
 */
function playSelectedClips(clips, selection) {
	clips.forEach(clip => { // Play all of the clips defined in selection for box opening
		if (selection.some(name => clip.name.includes(name))) {
			THREE.AnimationUtils.makeClipAdditive(clip);
			const action = mixer.clipAction(clip);
			action.blendMode = THREE.AdditiveAnimationBlendMode;
			action.clampWhenFinished = true;
			action.setLoop(THREE.LoopOnce);
			action.play();
		}
	});
}
