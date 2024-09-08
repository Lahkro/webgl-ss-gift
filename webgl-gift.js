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
	lightColor: new THREE.Color(0xFFFFFF),
	lightIntensity: 200,
	lightPosition: [3.04, 4.213, 4.948],
	cameraPosition: [12.546, 4.350, 6.371],
	cameraRotation: [-0.534, 1.037, 0.471],
	cameraFOV: 39.59,
	cameraPath: './public/models/camera.glb',

	// Model Options
	presentModelPath: './public/models/present_compressed.glb',
	outlineColor: new THREE.Color(0x000000),
	ribbonColor: new THREE.Color(0xFF9C00),
	lidColor: new THREE.Color(0x13370a),
	boxColor: new THREE.Color(0x0D2207),
	insideColor: new THREE.Color(0xFFFFFF),
	effectColor: new THREE.Color(0xFFC94A),
	boxTexture: './public/textures/octad_xmas_wrapping_paper.webp',
}

let windowWidth, windowHeight, windowAspectRatio, scale;
let clock, scene, renderer, effect, camera, loader, mixer, controls;


// Checks for WebGL support
if (WebGL.isWebGL2Available()) {

	// var stats = new Stats();
	// document.body.appendChild(stats.dom);

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
	document.body.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize);

	camera = new THREE.PerspectiveCamera(options.cameraFOV, windowAspectRatio, 0.1, 100);

	loader = new GLTFLoader();

	// Provide a DRACOLoader instance to decode compressed mesh data
	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath('/node_modules/three/examples/jsm/libs/draco/');
	dracoLoader.preload();
	loader.setDRACOLoader(dracoLoader);

	// 
	controls = new OrbitControls(camera, renderer.domElement);

	// Environment, camera, and light settings
	scene.background = options.backgroundColor;

	camera.position.set(...options.cameraPosition);
	camera.rotation.set(...options.cameraRotation);
	controls.update();

	const ambientLight = new THREE.AmbientLight(new THREE.Color('gray'));
	scene.add(ambientLight);

	const light = new THREE.PointLight(options.lightColor, options.lightIntensity, 100);
	light.position.set(...options.lightPosition);
	light.castShadow = true;
	light.shadow.mapSize.width = 2048; // default
	light.shadow.mapSize.height = 2048; // default
	light.shadow.bias = -0.0001;
	light.shadow.radius = -0.0001;
	scene.add(light);

	effect = new OutlineEffect(renderer);

	// Import/Load Present GLTF
	loader.load(options.presentModelPath, function (gltf) {

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

		mixer = new THREE.AnimationMixer(gltf.scene);
		const clips = gltf.animations;
		const clip = THREE.AnimationClip.findByName(clips, 'Animation');
		if (clip) {
			const action = mixer.clipAction(clip);
			// action.clampWhenFinished = true;
			// action.setLoop(THREE.LoopOnce);
			action.stop().play();
		}

		scene.add(gltf.scene);
		renderer.setAnimationLoop(animate);

	}, function (xhr) { // Load Progress

		console.log((xhr.loaded / xhr.total * 100) + '% loaded');

	}, function (error) { // Load Error

		console.log('Error', error);

	}
	);

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

	const texture = new THREE.TextureLoader().load(path);
	texture.colorSpace = colorSpace;
	texture.wrapS = wrapS;
	texture.wrapT = wrapT;
	texture.repeat.set(...repeat);
	texture.flipY = false;

	return texture;
}