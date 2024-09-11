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

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import WebGL from "three/addons/capabilities/WebGL.js";

// SCENE & MODEL OPTIONS //
const options = {
	// Scene Options
	backgroundColor: new THREE.Color(0x0A0E10),
	ambientColor: new THREE.Color('gray'),
	lightColor: new THREE.Color(0xFFFFFF),
	lightIntensity: 200,
	lightPosition: [3.04, 4.213, 4.948] as [number, number, number],
	lightShadows: true,
	cameraPosition: [12.546, 4.350, 6.371] as [number, number, number],
	cameraRotation: [-0.534, 1.037, 0.471] as [number, number, number],
	cameraFOV: 39.59,
	cameraPath: './public/models/camera.glb',

	// Model Options
	presentModelPath: '/models/present.glb',
	effectsModelPath: '/models/effects.glb',
	outlineColor: new THREE.Color(0x000000),
	ribbonColor: new THREE.Color(0xFF9C00),
	lidColor: new THREE.Color(0x13370a),
	boxColor: new THREE.Color(0x0D2207),
	insideColor: new THREE.Color(0xFFFFFF),
	effectColor: new THREE.Color(0xFFC94A),
	boxTexture: '/textures/octad_xmas_wrapping_paper.webp',

	// Post Processing Options
	highlightColor: new THREE.Color('white'),
	bloomParams: {
		threshold: 0.7,
		strength: 0.15,
		radius: 0,
		exposure: 1
	},
}

const boxOpeningClips = [ // Clips to play from 'allClips' when clicking to open box
	'BoxOpen',
	'TopPhysics',
	'ExplosionScale',
	'ExplosionKey',
	'ChargeEffect'
];

// Window Sizes
let windowWidth: number, windowHeight: number, windowAspectRatio: number, scale: number;

// Rendering
let scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, controls: OrbitControls;

// Mouse Pointer & Raycaster
let pointer: THREE.Vector2, raycaster: THREE.Raycaster, opened: boolean;

// Loaders
let loader: GLTFLoader, loadingManager: THREE.LoadingManager;

// Animations
let clock: THREE.Clock, mixer: THREE.AnimationMixer, allClips: THREE.AnimationClip[], initAction: THREE.AnimationAction;

// Effects & Post Processing
let effect: OutlineEffect, composer: EffectComposer, outlinePass: OutlinePass, outlinedObjects: THREE.Object3D[];

// Checks for WebGL support
if (WebGL.isWebGL2Available()) {

	// var stats = new Stats();
	// document.body.appendChild(stats.dom);

	loadingManager = new THREE.LoadingManager();

	const progressBar = document.getElementById('progress-bar') as HTMLProgressElement;
	loadingManager.onProgress = function (_url, loaded, total) {
		progressBar.value = (loaded / total) * 100;
	}

	const progressBarContainer = document.querySelector('.progress-bar-container') as HTMLProgressElement;
	loadingManager.onLoad = function () {
		progressBarContainer.style.display = 'none';
		initAction.play(); // Play the box dropping animation
	}

	loadingManager.onError = function (url) {
		console.error(`Error Loading: ${url}`);
	}

	init();

} else {

	const warning = WebGL.getWebGL2ErrorMessage();
	document.getElementById('container')!.appendChild(warning);

}

// Setup renderer & scene objects
function init() {

	windowWidth = window.visualViewport!.width;
	windowHeight = window.visualViewport!.height;
	windowAspectRatio = windowWidth / windowHeight
	scale = windowHeight;

	renderer = new THREE.WebGLRenderer();
	renderer.setSize(windowWidth, windowHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.shadowMap.enabled = true;
	renderer.setAnimationLoop(animate);
	document.body.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize);
	window.addEventListener('mousemove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(options.cameraFOV, windowAspectRatio, 0.1, 100);
	camera.position.set(...options.cameraPosition);
	camera.rotation.set(...options.cameraRotation);
	camera.layers.enable(0); // enabled by default
	camera.layers.enable(1);

	controls = new OrbitControls(camera, renderer.domElement);
	controls.update();

	pointer = new THREE.Vector2();
	raycaster = new THREE.Raycaster();
	opened = false;

	// Use DRACOLoader to decode compressed mesh data
	loader = new GLTFLoader(loadingManager);
	const dracoLoader = new DRACOLoader(loadingManager);
	dracoLoader.setDecoderPath('/node_modules/three/examples/jsm/libs/draco/');
	dracoLoader.preload();
	loader.setDRACOLoader(dracoLoader);

	// Scene setup
	clock = new THREE.Clock();
	mixer = new THREE.AnimationMixer(scene);

	allClips = new Array();

	scene.background = options.backgroundColor;

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

	// Import/Load GLTF models
	loadModel(options.presentModelPath);
	loadModel(options.effectsModelPath);

	// Configure Post Processing
	effect = new OutlineEffect(renderer, { defaultThickness: 0.005 });

	// OutlinePass setup
	// Extends RenderPass to override render method to use OutlineEffect's renderer.
	// A workaround to use both OutlineEffect and PostProcessing together.
	class OutlineEffectRenderPass extends RenderPass {
		effect: OutlineEffect;
		constructor(
			effect: OutlineEffect,
			scene: THREE.Scene,
			camera: THREE.Camera,
			overrideMaterial = null,
			clearColor = null,
			clearAlpha = null
		) {
			super(scene, camera, overrideMaterial, clearColor, clearAlpha);
			this.effect = effect;
		}

		render(_renderer: THREE.WebGLRenderer, writeBuffer: any, readBuffer: any) {
			super.render(this.effect as unknown as THREE.WebGLRenderer, writeBuffer, readBuffer, 0, true);
		}
	}

	composer = new EffectComposer(renderer);
	composer.addPass(new OutlineEffectRenderPass(effect, scene, camera));

	outlinePass = new OutlinePass(new THREE.Vector2(windowWidth, windowHeight), scene, camera);
	outlinedObjects = new Array();
	outlinePass.visibleEdgeColor.set(options.highlightColor);
	composer.addPass(outlinePass);

	const bloomPass = new UnrealBloomPass(
		new THREE.Vector2(window.innerWidth, window.innerHeight),
		options.bloomParams.strength,
		options.bloomParams.radius,
		options.bloomParams.threshold
	);

	composer.addPass(bloomPass);

	const smaaPass = new SMAAPass(windowWidth * renderer.getPixelRatio(), windowHeight * renderer.getPixelRatio());
	composer.addPass(smaaPass);

	const outputPass = new OutputPass();
	composer.addPass(outputPass);

	// console.table(options);
}

function animate() {

	const delta = clock.getDelta();

	mixer.update(delta);

	controls.update();

	// effect.render(scene, camera);
	// composer.render(scene, camera);
	composer.render();

}

// Updates scene render size to always fit window
function onWindowResize() {
	windowWidth = window.visualViewport!.width;
	windowHeight = window.visualViewport!.height;

	camera.aspect = windowWidth / windowHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(windowWidth, windowHeight);
	effect.setSize(windowWidth, windowHeight);
}

function onPointerMove(event: { clientX: number; clientY: number; }) {

	pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
	pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

	checkIntersection();
}

function onPointerUp(_event: any) {
	checkIntersection(true);
}

function checkIntersection(clicked = false) {

	raycaster.setFromCamera(pointer, camera);

	const intersects = raycaster.intersectObject(scene, true);

	// If pointer is over the box
	if (intersects.length > 0 && (intersects[0].object.parent?.name == 'Present_Box' || 'Present_Top')) {

		// const selectedObject = intersects[0].object;
		outlinePass.selectedObjects = outlinedObjects;

		// If pointer has clicked & wasn't already opened
		if (clicked && !opened) {
			opened = true;
			playSelectedClips(allClips, boxOpeningClips);
			outlinedObjects = [];
		}

	} else {

		outlinePass.selectedObjects = [];

	}

}

function loadModel(modelPath: string) {
	loader.load(modelPath, function (gltf) {

		// Traverse model for overrides
		gltf.scene.traverse((obj) => {

			// Override Materials with Toon Shading
			if (obj instanceof THREE.Mesh && obj.material) {

				if (obj.material.name == 'Effect') { // Effect or particle objects
					obj.material = materialConvert(new THREE.MeshBasicMaterial(), obj.material, options.effectColor);
					obj.material.side = THREE.DoubleSide;

				} else { // Non Effect Objects

					outlinedObjects.push(obj);

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
			initAction.setLoop(THREE.LoopOnce, 1);
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
 * @param {THREE.ColorSpace} colorSpace - defines texture color space.
 * @param {THREE.Wrapping} wrapS - defines how the texture is wrapped in U direction.
 * @param {THREE.Wrapping} wrapT - defines how the texture is wrapped in V direction.
 * @param {[number, number]} repeat - times the texture is repeated in each direction U and V.
 * @returns {THREE.Texture}
 */
function loadTexture(
	path: string,
	colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
	wrapS: THREE.Wrapping = THREE.RepeatWrapping,
	wrapT: THREE.Wrapping = THREE.RepeatWrapping,
	repeat: [number, number] = [3, 3]
): THREE.Texture {

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
function materialConvert(
	material: any = new THREE.MeshToonMaterial(),
	original: THREE.Material,
	color: THREE.Color | null = null,
	map: THREE.Texture | null = null
): THREE.Material {
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
function playSelectedClips(clips: Array<THREE.AnimationClip>, selection: Array<string>) {
	clips.forEach(clip => { // Play all of the clips defined in selection for box opening
		if (selection.some(name => clip.name.includes(name))) {
			THREE.AnimationUtils.makeClipAdditive(clip);
			const action = mixer.clipAction(clip);
			action.blendMode = THREE.AdditiveAnimationBlendMode;
			action.clampWhenFinished = true;
			action.setLoop(THREE.LoopOnce, 1);
			action.play();
		}
	});
}