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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import WebGL from "three/addons/capabilities/WebGL.js";

// OPTIONS CONFIGURATION //
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
	outlineColor: new THREE.Color(0xFFFFFF),
	ribbonColor: new THREE.Color(0xFF9C00),
	lidColor: new THREE.Color(0x0D2207),
	insideColor: new THREE.Color(0xFFFFFF),
	boxTexture: 'empty',
}

// Checks for WebGL support
if (WebGL.isWebGL2Available()) {

	var windowWidth = window.visualViewport.width;
	var windowHeight = window.visualViewport.height;
	var windowAspectRatio = windowWidth / windowHeight
	var scale = windowHeight;

	var scene = new THREE.Scene();
	var renderer = new THREE.WebGLRenderer({ antialias: true });
	var camera = new THREE.PerspectiveCamera(options.cameraFOV, windowAspectRatio, 0.1, 1000);
	var mixer = new THREE.AnimationMixer(scene);


	var loader = new GLTFLoader();
	var controls = new OrbitControls(camera, renderer.domElement);
	var effect = new OutlineEffect(renderer);

	// var stats = new Stats();
	// document.body.appendChild(stats.dom);

	init();
	render();

} else {

	const warning = WebGL.getWebGLErrorMessage();
	document.getElementById('container').appendChild(warning);

}

// Initialize renderer
function init() {

	renderer.setSize(windowWidth, windowHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	document.body.appendChild(renderer.domElement);
	window.addEventListener('resize', onWindowResize);

	// Environment, camera, and light settings
	scene.background = options.backgroundColor;

	camera.position.set(...options.cameraPosition);
	camera.rotation.set(...options.cameraRotation);
	controls.update();

	const light = new THREE.PointLight(options.lightColor, options.lightIntensity, 100);
	light.position.set(...options.lightPosition);
	light.castShadow = true;
	scene.add(light);

	// Import/Load Present GLTF
	loader.load(options.boxModelPath, function (gltf) {

		// Create new override materials
		const toonRibbon = new THREE.MeshToonMaterial({
			color: options.ribbonColor
		});

		const toonLid = new THREE.MeshToonMaterial({
			color: options.lidColor
		});

		const toonBox =

			// Traverse model for overrides
			gltf.scene.traverse((obj) => {

				obj.castShadow = true;
				obj.receiveShadow = true;

				if (obj.material && obj.material.name == 'Ribbon') {
					obj.material = toonRibbon;
				}

				if (obj.material && obj.material.name == 'Box Wrapping Top') {
					obj.material = toonLid;
				}

				if (obj.animations.length != 0) {
					const clips = obj.animations;
					const clip = THREE.AnimationClip.findByName(clips, 'BoxDrop');
					if (clip) {
						const action = mixer.clipAction(clip);
						console.log("action", action);
						action.clampWhenFinished = true;
						action.setLoop(THREE.LoopOnce);
						action.stop().play();
					}
				}
			});

		scene.add(gltf.scene);

	}, undefined, function (error) {
		console.error(error);
	});

	console.table(options);
}

function render() {

	const clock = new THREE.Clock();
	const tick = () => // Update Loop
	{
		// stats.update();

		const time = clock.getElapsedTime();

		requestAnimationFrame(tick);

		if (mixer) mixer.update(time);

		// renderer.render(scene, camera);
		effect.render(scene, camera);
	}

	tick();
}

/**
 * Returns custom shader material for particles
 *
 * @param {float} size - particle size.
 * @param {Three.Texture} sprite - particle sprite texture.
 * @returns {THREE.ShaderMaterial}
 */
function newParticleMaterial(size, sprite) {

}

// Updates scene render size to always fit window
function onWindowResize() {
	windowWidth = window.visualViewport.width;
	windowHeight = window.visualViewport.height;

	// Update particle scale attribute based on window height
	scale = windowHeight;

	// for (let i = 0; i < scene.children.length; i++) {
	// 	const child = scene.children[i];
	// 	const scales = new Float32Array(child.geometry.getAttribute('position').count).fill(scale);
	// 	child.geometry.setAttribute('scale', new THREE.Float32BufferAttribute(scales, 1));
	// }

	camera.aspect = windowWidth / windowHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(windowWidth, windowHeight);
}