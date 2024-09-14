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

// Loaders
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Controls (only used for development)
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Post Processing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// troika-three-text
import { Text } from 'troika-three-text';
import { preloadFont } from 'troika-three-text';

import WebGL from 'three/addons/capabilities/WebGL.js';

const santee = {
	name: 'Tad Mozeltov',

	get getName() {
		return this.name;
	},

	set setName(newName: string) {
		this.name = newName;
	}
};

// SCENE & MODEL OPTIONS //
const options = {
	// Scene Options
	backgroundColor: new THREE.Color(0x0A0E10),
	ambientColor: new THREE.Color('gray'),
	lightColor: new THREE.Color(0xFFFFFF),
	lightIntensity: 200,
	lightPosition: new THREE.Vector3(3.04, 4.213, 4.948).toArray(),
	lightShadows: true,
	cameraPosition: new THREE.Vector3(12.546, 4.350, 6.371).toArray(),
	cameraRotation: new THREE.Vector3(-0.534, 1.037, 0.471).toArray(),
	cameraFOV: 39.59,
	controlsOn: false,
	aspectRatio: 4 / 3,

	// Model Options
	presentModelPath: './models/present.glb',
	effectsModelPath: './models/effects.glb',
	raysModelPath: './models/rays.glb',
	outlineColor: new THREE.Color(0x000000),
	ribbonColor: new THREE.Color(0xFF9C00),
	lidColor: new THREE.Color(0x13370a),
	boxColor: new THREE.Color(0x0D2207),
	insideColor: new THREE.Color(0xFFFFFF),
	effectColor: new THREE.Color(0xFFC94A),
	beamColor: new THREE.Color(0xFFC94A),
	boxTexture: './textures/wrap.webp',
	floorTexture: './textures/floor.webp',
	tagTexture: './textures/tag.webp',
	burstTexture: './textures/sunburst.webp',
	raysTexture: './textures/sunrays.webp',

	// Text Options
	fontPath: './fonts/christmas_bell_regular.otf',
	fontSize: 0.5,
	textColor: new THREE.Color('black'),
	textPosition: new THREE.Vector3(0, 0.01, -0.4).toArray(),
	textRotation: new THREE.Vector3(-1.5708, 0, 1.5708).toArray(),
	maxWidth: 2.5,

	// Post Processing Options
	highlightColor: new THREE.Color('white'),
	bloomParams: {
		threshold: 0.7,
		strength: 0.15,
		radius: 0,
		exposure: 1
	},
}

// These are defined in the GLTF models.
const boxOpeningClips = [ // Clips to play from 'allClips' when clicking to open box
	'BoxOpen',
	'TopOpen',
	'ExplosionScale',
	'ExplosionKey',
	'ChargeEffect',
	'LootBeam',
	'SanteeTag'
];

const selectableObjs = [ // Objects that can be highlighted and clicked on
	'Present_Box',
	'Present_Top',
	'Box_Tie_A',
	'Box_Tie_B',
	'Ribbon_Bow',
	'Ribbon_End_L',
	'Ribbon_End_R',
	'Ribbon_Knot'
]

// Window Sizes
let containerWidth: number, containerHeight: number, containerAspectRatio: number, container: HTMLElement;

// Rendering
let scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, controls: OrbitControls;

// Mouse Pointer & Raycaster
let pointer: THREE.Vector2, raycaster: THREE.Raycaster, opened: boolean;

// Loaders
let gltfLoader: GLTFLoader, textureLoader: THREE.TextureLoader, loadingManager: THREE.LoadingManager;
let materials: any;

// Animations
let clock: THREE.Clock, mixer: THREE.AnimationMixer, allClips: THREE.AnimationClip[], initAction: THREE.AnimationAction;
let effectObjs: THREE.Group | null;

// Text
let tagText: Text;

// Effects & Post Processing
let composer: EffectComposer, outlinePass: OutlinePass, outlinedObjects: THREE.Object3D[];

// Checks for WebGL support
if (WebGL.isWebGL2Available()) {

	// var stats = new Stats();
	// document.body.appendChild(stats.dom);

	loadingManager = new THREE.LoadingManager();

	const progressBar = document.getElementById('progress-bar')! as HTMLProgressElement;
	loadingManager.onProgress = function (_url, loaded, total) {
		progressBar.value = (loaded / total) * 100;
	}

	const progressBarContainer: HTMLElement = document.querySelector('.progress-bar-container')!;
	loadingManager.onLoad = function () {
		setTimeout(() => { // Play the box dropping animation
			progressBarContainer.style.display = 'none';
			initAction.play();
			playSelectedClips(allClips, ['RaysRotation']);
			raysToTag();
		}, 50); // Short delay to make sure animation is played properly.

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

	container = document.getElementById('container')!;
	containerWidth = container.clientWidth;
	containerHeight = container.clientHeight;
	containerAspectRatio = containerWidth / containerHeight;

	renderer = new THREE.WebGLRenderer();
	renderer.setSize(containerWidth, containerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.shadowMap.enabled = true;
	renderer.setAnimationLoop(animate);
	container.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize);
	window.addEventListener('mousemove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);

	scene = new THREE.Scene();

	// Camera Setup
	camera = new THREE.PerspectiveCamera(options.cameraFOV, containerAspectRatio, 0.1, 100);
	camera.position.set(...options.cameraPosition);
	camera.rotation.set(...options.cameraRotation);

	if (options.controlsOn) {
		controls = new OrbitControls(camera, renderer.domElement);
		controls.update();
	}

	// Mouse/Pointer setup
	pointer = new THREE.Vector2();
	raycaster = new THREE.Raycaster();
	opened = false;

	// Animations setup
	clock = new THREE.Clock();
	mixer = new THREE.AnimationMixer(scene);
	allClips = new Array();

	mixer.addEventListener('finished', onAnimationFinish);

	// Scene setup
	scene.background = options.backgroundColor;

	const ambientLight = new THREE.AmbientLight(options.ambientColor);
	scene.add(ambientLight);

	// Lighting for the box
	const light = new THREE.PointLight(options.lightColor, options.lightIntensity, 100);
	light.position.set(...options.lightPosition);
	light.castShadow = options.lightShadows;
	light.shadow.mapSize.width = 2048;
	light.shadow.mapSize.height = 2048;
	light.shadow.bias = -0.0001;
	light.shadow.radius = -0.0001;
	scene.add(light);

	// Lighting for the tag
	// const tagLight = new THREE.PointLight(options.lightColor, 20, 20);
	// tagLight.position.set(...options.cameraPosition);
	// scene.add(tagLight);

	// Loaders setup
	gltfLoader = new GLTFLoader(loadingManager);
	// Use DRACOLoader to decode compressed mesh data <=== [REMOVED CUS ANNOYING]
	// const dracoLoader = new DRACOLoader(loadingManager);
	// dracoLoader.setDecoderPath('./node_modules/three/examples/jsm/libs/draco/');
	// dracoLoader.preload();
	// loader.setDRACOLoader(dracoLoader);

	textureLoader = new THREE.TextureLoader(loadingManager);

	// Import/Load GLTF models
	const boxTex = loadTexture(options.boxTexture, [3, 3]);
	const floorTex = loadTexture(options.floorTexture);
	floorTex.premultiplyAlpha = true;
	const tagTex = loadTexture(options.tagTexture);
	const burstTex = loadTexture(options.burstTexture);
	const raysTex = loadTexture(options.raysTexture);

	materials = { // Material overrides
		effect: new THREE.MeshBasicMaterial({ color: options.effectColor, transparent: true, opacity: 0.7 }),
		beam: new THREE.MeshBasicMaterial({ color: options.beamColor }),
		ribbon: new THREE.MeshToonMaterial({ color: options.ribbonColor }),
		lid: new THREE.MeshToonMaterial({ color: options.lidColor }),
		box: new THREE.MeshToonMaterial({ map: boxTex }),
		inside: new THREE.MeshBasicMaterial({ color: options.insideColor }),
		outline: new THREE.MeshBasicMaterial({ color: options.outlineColor }),
		floor: new THREE.MeshToonMaterial({ map: floorTex, transparent: true, opacity: 0.9 }),
		tag: new THREE.MeshBasicMaterial({ map: tagTex }),
		sunburst: new THREE.MeshBasicMaterial({ map: burstTex, transparent: true, opacity: 0.25 }),
		sunrays: new THREE.MeshBasicMaterial({ map: raysTex, transparent: true, opacity: 0.25 }),
	};

	loadModel(options.presentModelPath);
	loadModel(options.effectsModelPath);
	loadModel(options.raysModelPath);

	// Post processing setup
	composer = new EffectComposer(renderer);

	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);

	outlinePass = new OutlinePass(new THREE.Vector2(containerWidth, containerHeight), scene, camera);
	outlinedObjects = new Array();
	outlinePass.visibleEdgeColor.set(options.highlightColor);
	outlinePass.hiddenEdgeColor.set(options.highlightColor);
	composer.addPass(outlinePass);

	const bloomPass = new UnrealBloomPass(
		new THREE.Vector2(containerWidth, containerHeight),
		options.bloomParams.strength,
		options.bloomParams.radius,
		options.bloomParams.threshold
	);
	composer.addPass(bloomPass);

	const smaaPass = new SMAAPass(containerWidth * renderer.getPixelRatio(), containerHeight * renderer.getPixelRatio());
	composer.addPass(smaaPass);

	const outputPass = new OutputPass();
	composer.addPass(outputPass);

	onWindowResize();
	// console.table(options);
}

function animate() {

	const delta = clock.getDelta();

	mixer.update(delta);
	raysToTag();

	if (options.controlsOn) controls.update();

	composer.render();
}

// Updates scene render size to always fit container
function onWindowResize() {
	containerWidth = container.clientWidth;
	containerHeight = container.clientHeight;

	// Calculate the new width and height while maintaining the desired aspect ratio
	let newWidth = containerWidth;
	let newHeight = newWidth / options.aspectRatio;

	if (newHeight > containerHeight) {
		newHeight = containerHeight;
		newWidth = newHeight * options.aspectRatio;
	}

	camera.aspect = options.aspectRatio;
	camera.updateProjectionMatrix();

	renderer.setSize(newWidth, newHeight);
	composer.setSize(newWidth, newHeight);
}

function onPointerMove(event: { clientX: number; clientY: number; }) {

	// Get the bounding box of the container to...
	const rect = container.getBoundingClientRect();

	// ... calculate mouse position relative to container
	pointer.x = ((event.clientX - rect.left) / containerWidth) * 2 - 1;
	pointer.y = - ((event.clientY - rect.top) / containerHeight) * 2 + 1;

	checkIntersection();
}

function onPointerUp(_event: any) {
	checkIntersection(true);
}

function checkIntersection(clicked = false) {

	raycaster.setFromCamera(pointer, camera);

	const intersects = raycaster.intersectObject(scene, true);

	// If pointer is over the box
	if (intersects.length > 0 && selectableObjs.includes(intersects[0].object.parent!.name)) {

		// const selectedObject = intersects[0].object;
		outlinePass.selectedObjects = outlinedObjects;

		// If pointer has clicked & wasn't already opened
		if (clicked && !opened) {
			const info = document.getElementById('info')!;
			info.style.display = 'none';

			playSelectedClips(allClips, boxOpeningClips, true);
			setText(santee.getName); // setText in case santeeName has been changed since scene initialized.
			outlinePass.selectedObjects = outlinedObjects = [];

			opened = true;
		}

	} else {

		outlinePass.selectedObjects = [];

	}

}

function onAnimationFinish(event: { action: THREE.AnimationAction; direction: number; }) {
	switch (event.action.getClip().name) {
		case 'ChargeEffect': // Dispose of charge effect objects when animation is finished.
			effectObjs?.traverse((obj) => {
				scene.remove(obj);
				if (obj instanceof THREE.Mesh && obj.geometry) {
					obj.geometry.dispose();
				}
			});

			effectObjs = null;
			materials.effect.dispose();
			break;
	}
}

function loadModel(modelPath: string) {
	gltfLoader.load(modelPath,

		function (gltf) { // onLoad

			if (modelPath == options.effectsModelPath) {
				effectObjs = gltf.scene;
			}

			gltf.scene.traverse((obj) => { // Traverse model for overrides

				// Override Materials with custom three.js Toon or Basic Materials
				if (obj instanceof THREE.Mesh && obj.material) {

					switch (obj.material.name) {
						case 'Effect':
							obj.material = materials.effect;
							break;
						case 'BeamEffect':
							obj.material = materials.beam;
							break;
						case 'Ribbon':
							obj.material = materials.ribbon;
							outlineAndShadow(obj);
							break;
						case 'Box Wrapping Top':
							obj.material = materials.lid;
							outlineAndShadow(obj);
							break;
						case 'Box Wrapping':
							obj.material = materials.box;
							outlineAndShadow(obj);
							break;
						case 'Box Inside':
							obj.material = materials.inside;
							outlineAndShadow(obj);
							break;
						case 'Outline':
							obj.material = materials.outline;
							outlinedObjects.push(obj);
							break;
						case 'Floor':
							obj.material = materials.floor;
							obj.receiveShadow = true;
							break;
						case 'Tag':
							obj.material = materials.tag;
							attachText(obj, santee.getName);
							break;
						case 'Sunburst':
							obj.material = materials.sunburst;
							break;
						case 'Sunrays':
							obj.material = materials.sunrays;
							break;
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
			renderer.compile(gltf.scene, camera);

		}, function (xhr) { // onProgress

			// console.log('[MODEL] ' + (xhr.loaded / xhr.total * 100) + '% loaded');

		}, function (err) { // onError

			console.error('[Model Error]', err);

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
	repeat: [number, number] = [1, 1],
	wrapS: THREE.Wrapping = THREE.RepeatWrapping,
	wrapT: THREE.Wrapping = THREE.RepeatWrapping,
	colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace

): THREE.Texture {

	const texture = textureLoader.load(path,

		function (texture) {
			texture.repeat.set(...repeat);
			texture.wrapS = wrapS;
			texture.wrapT = wrapT;
			texture.colorSpace = colorSpace;
			texture.flipY = false;
		},

		undefined,

		function (err) {
			console.error('[Texture Error]', err);
		}
	);

	return texture;
}

/**
 * Generates and attaches text geometry to passed obj.
 *
 * @param {THREE.Object3D} obj - obj to attach to.
 * @param {string} text - text to write.
 * @param {string} font - path to font.
 * @param {number} size - size of text.
 * @param {THREE.Vector3Tuple} position - position of text.
 * @param {THREE.Vector3Tuple} rotation - rotation of text.
 * @param {number} maxWidth - maximum width before wrapping.
 */
function attachText(
	obj: THREE.Object3D,
	text: string,
	font: string = options.fontPath,
	size: number = options.fontSize,
	position: THREE.Vector3Tuple = options.textPosition,
	rotation: THREE.Vector3Tuple = options.textRotation,
	maxWidth: number = options.maxWidth
) {
	preloadFont(
		{
			font: font,
			characters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`1234567890-=[];,./~!@#$%^&*()_+{}|:<>?\'\"',
			sdfGlyphSize: undefined as unknown as number,
		},
		() => {
			const thisText = new Text();
			thisText.text = '(' + text + ')';
			thisText.font = font;
			thisText.fontSize = size;
			thisText.material = new THREE.MeshBasicMaterial({ color: options.textColor });

			thisText.anchorX = 'center' as unknown as number;
			thisText.anchorY = 'middle' as unknown as number;
			thisText.position.set(...position);
			thisText.rotation.set(...rotation);

			thisText.maxWidth = maxWidth;
			thisText.overflowWrap = 'break-word';


			thisText.frustumCulled = false;

			thisText.sync();

			obj.add(thisText as unknown as THREE.Object3D);

			tagText = thisText;
		}
	)
}

function setText(text: string) {
	tagText.text = '(' + text + ')';
	tagText.sync();
}

/**
 * Plays selected clips
 *
 * @param {Array<THREE.AnimationClip>} clips - material to convert to.
 * @param {Array<string>} selection - original material.
 */
function playSelectedClips(
	clips: Array<THREE.AnimationClip>,
	selection: Array<string>,
	loopOnce?: boolean,
) {
	clips.forEach(clip => { // Play all of the clips defined in selection for box opening
		if (selection.some(name => clip.name.includes(name))) {
			THREE.AnimationUtils.makeClipAdditive(clip);
			const action = mixer.clipAction(clip);
			action.blendMode = THREE.AdditiveAnimationBlendMode;
			action.clampWhenFinished = true;
			if (loopOnce) action.setLoop(THREE.LoopOnce, 0);
			action.play();
		}
	});
}

function outlineAndShadow(obj: THREE.Object3D) {
	outlinedObjects.push(obj);
	obj.castShadow = true;
	obj.receiveShadow = true;
	((obj as THREE.Mesh).material as THREE.Material).shadowSide = THREE.FrontSide;
}

function raysToTag() {
	const tag = scene.getObjectByName('SanteeTag');
	const sunburst = scene.getObjectByName('Sunburst');
	const sunrays = scene.getObjectByName('Sunrays');

	if (tag && sunburst && sunrays) {
		if (tag.children.length == 0) {
			const intermediaryChild = new THREE.Object3D();

			tag.add(intermediaryChild);
		}

		sunburst.position.setFromMatrixPosition(tag.children[0].matrixWorld);
		sunrays.position.setFromMatrixPosition(tag.children[0].matrixWorld);
	}
}