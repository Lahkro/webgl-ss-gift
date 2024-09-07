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
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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
	boxModelPath: './public/models/present_combined.glb',
	outlineColor: new THREE.Color(0x000000),
	ribbonColor: new THREE.Color(0xFF9C00),
	lidColor: new THREE.Color(0x0D2207),
	insideColor: new THREE.Color(0xFFFFFF),
	trailColor: new THREE.Color(0xFFC94A),
	boxTexture: './public/textures/octad_xmas_wrapping_paper.png',
}

// EFFECT OPTIONS //
const bloomParams = {
	threshold: 0.9,
	strength: 0.2,
	radius: 0,
	exposure: 1
};

let windowWidth, windowHeight, windowAspectRatio, scale;
let clock, scene, renderer, composer, camera, loader, mixer, controls;


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

	renderer = new THREE.WebGLRenderer();
	renderer.setSize(windowWidth, windowHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	document.body.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize);

	camera = new THREE.PerspectiveCamera(options.cameraFOV, windowAspectRatio, 0.1, 1000);
	mixer;

	loader = new GLTFLoader();

	//Provide a DRACOLoader instance to decode compressed mesh data
	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath('three/addons/loaders/libs/draco/');
	loader.setDRACOLoader(dracoLoader);

	controls = new OrbitControls(camera, renderer.domElement);
	composer = new EffectComposer(renderer);

	// Environment, camera, and light settings
	scene.background = options.backgroundColor;

	camera.position.set(...options.cameraPosition);
	camera.rotation.set(...options.cameraRotation);
	controls.update();

	const light = new THREE.PointLight(options.lightColor, options.lightIntensity, 100);
	light.position.set(...options.lightPosition);
	light.castShadow = true;
	scene.add(light);

	// Render Passes
	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);

	const outlinePass = new OutlinePass(new THREE.Vector2(windowWidth, windowHeight), scene, camera);
	outlinePass.visibleEdgeColor.set(options.outlineColor);
	outlinePass.overlayMaterial.blending = THREE.CustomBlending;
	composer.addPass(outlinePass);

	const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
	bloomPass.threshold = bloomParams.threshold;
	bloomPass.strength = bloomParams.strength;
	bloomPass.radius = bloomParams.radius;
	composer.addPass(bloomPass);

	const smaaPass = new SMAAPass(windowWidth * renderer.getPixelRatio(), windowHeight * renderer.getPixelRatio());
	composer.addPass(smaaPass);

	const outputPass = new OutputPass();
	composer.addPass(outputPass);

	// Import/Load Present GLTF
	loader.load(options.boxModelPath, function (gltf) {

		const lightTrails = new THREE.MeshBasicMaterial({
			color: options.trailColor
		});

		let outlinedObjects = [];

		// Traverse model for overrides
		gltf.scene.traverse((obj) => {

			obj.castShadow = true;
			obj.receiveShadow = true;

			// Override Materials with Toon Shading
			if (obj.material) {
				if (obj.material.name == 'Ribbon') {
					obj.material = materialConvert(new THREE.MeshToonMaterial(), obj.material, options.ribbonColor);
				}

				if (obj.material.name == 'Box Wrapping Top') {
					obj.material = materialConvert(new THREE.MeshToonMaterial(), obj.material, options.lidColor);
				}

				if (obj.material.name == "Box Wrapping") {
					obj.material = materialConvert(new THREE.MeshToonMaterial(), obj.material);
				}

				if (obj.material.name == 'Light Trails') {
					obj.material = materialConvert(new THREE.MeshBasicMaterial(), obj.material, options.trailColor);

				} else if (obj.material.name == 'Light Particles') {
					obj.material = materialConvert(new THREE.MeshBasicMaterial(), obj.material, options.trailColor);

				} else if (obj.material) { // Only outline objects that are not particle effects
					outlinedObjects.push(obj)
				}
			}
		});

		outlinePass.selectedObjects = outlinedObjects;

		console.log(gltf.scene);
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

	// controls.update();

	composer.render(scene, camera);

}

// Updates scene render size to always fit window
function onWindowResize() {
	windowWidth = window.visualViewport.width;
	windowHeight = window.visualViewport.height;

	camera.aspect = windowWidth / windowHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(windowWidth, windowHeight);
	composer.setSize(windowWidth, windowHeight);
}

/**
 * Returns custom shader material for particles
 *
 * @param {THREE.Material} original - material to be copied.
 * @param {THREE.Color} color - material to be copied.
 * @param {THREE.Texture} map - material to be copied.
 * @returns {THREE.MeshToonMaterial}
 */
function materialConvert(material = new THREE.MeshToonMaterial(), original, color = null, map = null) {
	material.copy(original);

	if (color) material.color.set(color);
	if (map) material.color.set(map);

	return material;
}