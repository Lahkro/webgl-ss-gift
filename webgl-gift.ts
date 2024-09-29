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
// import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
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

export { santee };

// SCENE & MODEL OPTIONS //
const CONFIG = {
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
	boxTexture: './textures/wrap.webp',
	floorTexture: './textures/floor.webp',
	tagTexture: './textures/tag.webp',
	burstTexture: './textures/sunburst.webp',
	raysTexture: './textures/sunrays.webp',
	outlineColor: new THREE.Color(0x000000),
	ribbonColor: new THREE.Color(0xFF9C00),
	lidColor: new THREE.Color(0x13370a),
	boxColor: new THREE.Color(0x0D2207),
	insideColor: new THREE.Color(0xFFFFFF),
	effectColor: new THREE.Color(0xFFC94A),
	beamColor: new THREE.Color(0xFFC94A),

	// Text Options
	fontPath: './fonts/christmas_bell_regular.otf',
	fontSize: 0.5,
	textColor: new THREE.Color('black'),
	textPosition: new THREE.Vector3(0, 0.01, -0.4).toArray(),
	textRotation: new THREE.Vector3(-1.5708, 0, 1.5708).toArray(),
	maxWidth: 2.5,
	maxHeight: 1.3,

	// Audio Options
	dropSoundPath: './audio/drop.ogg',
	openSoundPath: './audio/open.ogg',
	volume: 1,

	// Post Processing Options
	highlightColor: new THREE.Color('white'),
	bloomParams: {
		threshold: 0.7,
		strength: 0.15,
		radius: 0,
		exposure: 1
	},
}

class WebGLGift {
	// These are defined from the GLTF models.
	private boxOpeningClips = [ // Clips to play from 'allClips' when clicking to open box
		'BoxOpen',
		'TopOpen',
		'ExplosionScale',
		'ExplosionKey',
		'ChargeEffect',
		'LootBeam',
		'SanteeTag'
	];
	
	private selectableObjs = [ // Objects that can be highlighted and clicked on
		'Present_Box',
		'Present_Top',
		'Box_Tie_A',
		'Box_Tie_B',
		'Ribbon_Bow',
		'Ribbon_End_L',
		'Ribbon_End_R',
		'Ribbon_Knot'
	]
	
	private window: Window;

	// Window Sizes
	private container: HTMLElement;
	private containerWidth: number | undefined;
	private containerHeight: number | undefined;
	private containerAspectRatio: number | undefined;
	
	// Rendering
	private scene: THREE.Scene;
	private renderer: THREE.WebGLRenderer;
	private camera: THREE.PerspectiveCamera;
	private controls: OrbitControls | undefined;
	
	// Mouse Pointer & Raycaster
	private pointer: THREE.Vector2;
	private raycaster: THREE.Raycaster;
	private opened: boolean = false;
	
	// Loaders
	private gltfLoader: GLTFLoader;
	private textureLoader: THREE.TextureLoader;
	private loadingManager: THREE.LoadingManager;
	
	private materials: any;
	
	// Animations
	private clock: THREE.Clock;
	private mixer: THREE.AnimationMixer;
	private allClips: THREE.AnimationClip[] = [];
	private initAction: THREE.AnimationAction | undefined;
	
	private effectObjs: THREE.Group | undefined;
	
	// Text
	private tagText: Text;
	
	// Audio
	private audioLoader: THREE.AudioLoader;
	private audioSource_open: THREE.Audio | undefined;
	private audioSource_drop: THREE.Audio | undefined;
	private listener: THREE.AudioListener;
	
	// Effects & Post Processing
	private composer: EffectComposer;
	private outlinePass: OutlinePass | undefined;
	private outlinedObjects: THREE.Object3D[] = [];
	
	private name: string;

	get santeeName() {
		return this.name;
	}

	set santeeName(value: string) {
		this.name = value;
		this.setText(this.tagText, value);
	}

	private onPlayCallback: (() => void) | undefined;

	constructor(container: HTMLElement, window: Window, name: string = 'Unknown', onPlay?: (() => void)) {
		this.window = window;

		this.container = container;
		this.containerWidth = this.container.clientWidth;
		this.containerHeight = this.container.clientHeight;
		this.containerAspectRatio = this.containerWidth / this.containerHeight;
		
		this.name = name;
		this.onPlayCallback = onPlay;

		if (!WebGL.isWebGL2Available()) {
			throw 'WebGL is not available';
		}

		this.scene = new THREE.Scene();

		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setSize(this.containerWidth, this.containerHeight);
		this.renderer.setPixelRatio(this.window.devicePixelRatio);
		this.renderer.shadowMap.enabled = true;
		this.renderer.setAnimationLoop(() => this.animate());

		this.renderer.domElement.style.setProperty('opacity', '0.0');
		this.renderer.domElement.style.setProperty('transition', 'opacity 1s');

		this.container.appendChild(this.renderer.domElement);

		this.loadingManager = new THREE.LoadingManager();

		// Camera Setup
		this.camera = new THREE.PerspectiveCamera(CONFIG.cameraFOV, this.containerAspectRatio, 0.1, 100);
		this.camera.position.set(...CONFIG.cameraPosition);
		this.camera.rotation.set(...CONFIG.cameraRotation);
	
		if (CONFIG.controlsOn) {
			this.controls = new OrbitControls(this.camera, this.renderer.domElement);
			this.controls.update();
		}
	
		// Audio Setup
		this.listener = new THREE.AudioListener();
		this.camera.add(this.listener);
		
		this.audioLoader = new THREE.AudioLoader(this.loadingManager);
	
		// Mouse/Pointer setup
		this.pointer = new THREE.Vector2();
		this.raycaster = new THREE.Raycaster();
		this.opened = false;
	
		// Animations setup
		this.clock = new THREE.Clock();
		this.mixer = new THREE.AnimationMixer(this.scene);
		this.allClips = new Array();
	
		this.mixer.addEventListener('finished', (e) => this.onAnimationFinish(e));
	
		// Scene setup
		this.scene.background = CONFIG.backgroundColor;
	
		const ambientLight = new THREE.AmbientLight(CONFIG.ambientColor);
		this.scene.add(ambientLight);
	
		// Lighting for the box
		const light = new THREE.PointLight(CONFIG.lightColor, CONFIG.lightIntensity, 100);
		light.position.set(...CONFIG.lightPosition);
		light.castShadow = CONFIG.lightShadows;
		light.shadow.mapSize.width = 2048;
		light.shadow.mapSize.height = 2048;
		light.shadow.bias = -0.0001;
		light.shadow.radius = -0.0001;
		this.scene.add(light);
	
		// Lighting for the tag
		// const tagLight = new THREE.PointLight(options.lightColor, 20, 20);
		// tagLight.position.set(...options.cameraPosition);
		// scene.add(tagLight);
	
		// Loaders setup
		this.gltfLoader = new GLTFLoader(this.loadingManager);
		// Use DRACOLoader to decode compressed mesh data <=== [REMOVED CUS ANNOYING]
		// const dracoLoader = new DRACOLoader(loadingManager);
		// dracoLoader.setDecoderPath('./node_modules/three/examples/jsm/libs/draco/');
		// dracoLoader.preload();
		// loader.setDRACOLoader(dracoLoader);
	
		this.textureLoader = new THREE.TextureLoader(this.loadingManager);

		this.composer = new EffectComposer(this.renderer);
	}
	
	// Setup renderer & scene objects
	start() {
		if (this.containerWidth === undefined || this.containerHeight === undefined) { return; }

		this.loadingManager.onLoad = () => {
			// Hide progress bar container and play initial animations & audio.
			setTimeout(() => {
				if (this.audioSource_drop === undefined || this.initAction === undefined) { return; }

				this.renderer.domElement.style.setProperty('opacity', '1.0'); // Has a transition applied, so it fades in
				this.audioSource_drop.play(); // Only works after user interacts with page in some way due to autoplay policy.
				this.initAction.play();
				this.playSelectedClips(this.allClips, ['RaysRotation']);
				this.raysToTag();
			}, 1000); // Short delay to make sure animation is played properly.
		};
	
		this.loadingManager.onError = (url) => {
			console.error(`Error Loading: ${url}`);
		};
	
		this.audioSource_drop = new THREE.Audio(this.listener);
		this.audioSource_open = new THREE.Audio(this.listener);

		this.loadAudio(CONFIG.dropSoundPath, this.audioSource_drop, CONFIG.volume);
		this.loadAudio(CONFIG.openSoundPath, this.audioSource_open, CONFIG.volume);

		// Load GLTF models & textures
		const boxTex = this.loadTexture(CONFIG.boxTexture, [3, 3]);
		const floorTex = this.loadTexture(CONFIG.floorTexture);
		floorTex.premultiplyAlpha = true;
		const tagTex = this.loadTexture(CONFIG.tagTexture);
		const burstTex = this.loadTexture(CONFIG.burstTexture);
		const raysTex = this.loadTexture(CONFIG.raysTexture);
	
		this.materials = { // Create material overrides
			effect: new THREE.MeshBasicMaterial({ color: CONFIG.effectColor, transparent: true, opacity: 0.7 }),
			beam: new THREE.MeshBasicMaterial({ color: CONFIG.beamColor }),
			ribbon: new THREE.MeshToonMaterial({ color: CONFIG.ribbonColor }),
			lid: new THREE.MeshToonMaterial({ color: CONFIG.lidColor }),
			box: new THREE.MeshToonMaterial({ map: boxTex }),
			inside: new THREE.MeshBasicMaterial({ color: CONFIG.insideColor }),
			outline: new THREE.MeshBasicMaterial({ color: CONFIG.outlineColor }),
			floor: new THREE.MeshToonMaterial({ map: floorTex, transparent: true, opacity: 0.9 }),
			tag: new THREE.MeshBasicMaterial({ map: tagTex }),
			sunburst: new THREE.MeshBasicMaterial({ map: burstTex, transparent: true, opacity: 0.25 }),
			sunrays: new THREE.MeshBasicMaterial({ map: raysTex, transparent: true, opacity: 0.25 }),
		};
	
		this.loadModel(CONFIG.presentModelPath);
		this.loadModel(CONFIG.effectsModelPath);
		this.loadModel(CONFIG.raysModelPath);
	
		// Post processing setup
		const renderPass = new RenderPass(this.scene, this.camera);
		this.composer.addPass(renderPass);
	
		this.outlinePass = new OutlinePass(new THREE.Vector2(this.containerWidth, this.containerHeight), this.scene, this.camera);
		this.outlinePass.visibleEdgeColor.set(CONFIG.highlightColor);
		this.outlinePass.hiddenEdgeColor.set(CONFIG.highlightColor);
		this.composer.addPass(this.outlinePass);
	
		const bloomPass = new UnrealBloomPass(
			new THREE.Vector2(this.containerWidth, this.containerHeight),
			CONFIG.bloomParams.strength,
			CONFIG.bloomParams.radius,
			CONFIG.bloomParams.threshold
		);
		this.composer.addPass(bloomPass);
	
		const smaaPass = new SMAAPass(this.containerWidth * this.renderer.getPixelRatio(), this.containerHeight * this.renderer.getPixelRatio());
		this.composer.addPass(smaaPass);
	
		const outputPass = new OutputPass();
		this.composer.addPass(outputPass);

		this.window.addEventListener('resize', () => this.onWindowResize());
		this.window.addEventListener('mousemove', (e) => this.onPointerMove(e));
		this.window.addEventListener('pointerup', (e) => this.onPointerUp(e));

		this.onWindowResize();
	}
	
	private animate() {
		const delta = this.clock.getDelta();
	
		this.mixer.update(delta);
		this.raysToTag();
	
		if (CONFIG.controlsOn && this.controls !== undefined) this.controls.update();
	
		this.composer.render();
	}
	
	// Callback. Updates scene render size to always fit container
	private onWindowResize() {
		this.containerWidth = this.container.clientWidth;
		this.containerHeight = this.container.clientHeight;
	
		// Calculate the new width and height while maintaining the desired aspect ratio
		let newWidth = this.containerWidth;
		let newHeight = newWidth / CONFIG.aspectRatio;
	
		if (newHeight > this.containerHeight) {
			newHeight = this.containerHeight;
			newWidth = newHeight * CONFIG.aspectRatio;
		}
	
		this.camera.aspect = CONFIG.aspectRatio;
		this.camera.updateProjectionMatrix();
	
		this.renderer.setSize(newWidth, newHeight);
		this.composer.setSize(newWidth, newHeight);
	}
	
	/**
	 * Callback
	 */
	private onPointerMove(event: { clientX: number; clientY: number; }) {
		if (this.containerWidth === undefined || this.containerHeight === undefined) { return; }

		// Get the bounding box of the container to...
		const rect = this.container.getBoundingClientRect();
	
		// ... calculate mouse position relative to container
		this.pointer.x = ((event.clientX - rect.left) / this.containerWidth) * 2 - 1;
		this.pointer.y = - ((event.clientY - rect.top) / this.containerHeight) * 2 + 1;
	
		this.checkIntersection(false);
	}
	
	/**
	 * Callback
	 */
	private onPointerUp(_event: any) {
		this.checkIntersection(true);
	}
	
	private checkIntersection(clicked: boolean) {
		if (this.outlinePass === undefined || this.audioSource_open === undefined) { return; }

		this.raycaster.setFromCamera(this.pointer, this.camera);
	
		const intersects = this.raycaster.intersectObject(this.scene, true);
	
		// If pointer is over the box
		if (intersects.length > 0 && this.selectableObjs.includes(intersects[0].object.parent!.name)) {
			// const selectedObject = intersects[0].object;
			this.outlinePass.selectedObjects = this.outlinedObjects;
		
			// If pointer has clicked, wasn't already opened, and scene is fully loaded
			// if (clicked && !this.opened && progressBarContainer.style.display == 'none') {
			if (clicked && !this.opened) {
				this.audioSource_open.play();
	
				if (this.onPlayCallback !== undefined) this.onPlayCallback();
	
				this.playSelectedClips(this.allClips, this.boxOpeningClips, true);
				this.outlinePass.selectedObjects = this.outlinedObjects = [];
	
				this.opened = true;
			}
		} else {
			this.outlinePass.selectedObjects = [];
		}
	}
	
	/**
	 * Callback
	 */
	private onAnimationFinish(event: { action: THREE.AnimationAction; direction: number; }) {
		switch (event.action.getClip().name) {
			case 'ChargeEffect': // Dispose of charge effect objects when animation is finished.
				this.effectObjs?.traverse((obj) => {
					this.scene.remove(obj);
					if (obj instanceof THREE.Mesh && obj.geometry) {
						obj.geometry.dispose();
					}
				});
	
				this.effectObjs = undefined;
				this.materials.effect.dispose();
				break;
		}
	}
	
	/**
	 * Loads model and sets material overrides.
	 */
	private loadModel(modelPath: string) {
		this.gltfLoader.load(modelPath,
	
			(gltf) => { // onLoad
	
				if (modelPath == CONFIG.effectsModelPath) {
					this.effectObjs = gltf.scene;
				}
	
				gltf.scene.traverse((obj) => { // Traverse model for overrides
	
					// Override Materials with custom three.js Toon or Basic Materials
					if (obj instanceof THREE.Mesh && obj.material) {
	
						switch (obj.material.name) {
							case 'Effect':
								obj.material = this.materials.effect;
								break;
							case 'BeamEffect':
								obj.material = this.materials.beam;
								break;
							case 'Ribbon':
								obj.material = this.materials.ribbon;
								this.outlineAndShadow(obj);
								break;
							case 'Box Wrapping Top':
								obj.material = this.materials.lid;
								this.outlineAndShadow(obj);
								break;
							case 'Box Wrapping':
								obj.material = this.materials.box;
								this.outlineAndShadow(obj);
								break;
							case 'Box Inside':
								obj.material = this.materials.inside;
								this.outlineAndShadow(obj);
								break;
							case 'Outline':
								obj.material = this.materials.outline;
								this.outlinedObjects.push(obj);
								break;
							case 'Floor':
								obj.material = this.materials.floor;
								obj.receiveShadow = true;
								break;
							case 'Tag':
								obj.material = this.materials.tag;
								this.attachText(obj, this.name);
								break;
							case 'Sunburst':
								obj.material = this.materials.sunburst;
								break;
							case 'Sunrays':
								obj.material = this.materials.sunrays;
								break;
						}
					}
				});
	
				this.allClips.push(...gltf.animations);
	
				// Setup box dropping animation to play after scene initially loads
				const clip = THREE.AnimationClip.findByName(this.allClips, 'BoxDrop');
				if (clip) {
					this.initAction = this.mixer.clipAction(clip);
					this.initAction.clampWhenFinished = true;
					this.initAction.setLoop(THREE.LoopOnce, 1);
				}
	
				this.scene.add(gltf.scene);
				this.renderer.compile(gltf.scene, this.camera);
	
			}, (xhr) => { // onProgress
	
				// console.log('[MODEL] ' + (xhr.loaded / xhr.total * 100) + '% loaded');
	
			}, (err) => { // onError
	
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
	private loadTexture(
		path: string,
		repeat: [number, number] = [1, 1],
		wrapS: THREE.Wrapping = THREE.RepeatWrapping,
		wrapT: THREE.Wrapping = THREE.RepeatWrapping,
		colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace
	
	): THREE.Texture {
		const texture = this.textureLoader.load(path,
	
			(texture) => {
				texture.repeat.set(...repeat);
				texture.wrapS = wrapS;
				texture.wrapT = wrapT;
				texture.colorSpace = colorSpace;
				texture.flipY = false;
			},
	
			undefined,
	
			(err) => {
				console.error('[Texture Error]', err);
			}
		);
	
		return texture;
	}
	
	/**
	 * Loads audio from given path.
	 *
	 * @param {String} path - path to audio.
	 * @param {THREE.Audio} source - audio source to play from.
	 * @param {number} volume - volume to play audio.
	 * @param {boolean} loop - whether to loop audio.
	 */
	private loadAudio(path: string, source: THREE.Audio, volume: number = 1.0, loop: boolean = false) {
		this.audioLoader.load(path,
	
			(buffer) => {
				source.setBuffer(buffer);
				source.setLoop(loop);
				source.setVolume(volume);

			}, (xhr) => {
				// console.log('[AUDIO] ' + (xhr.loaded / xhr.total * 100) + '% loaded');
			}, (err) => {

				console.error('[Audio Error]', err);

			}
		);
	}
	
	/**
	 * Generates and attaches text geometry to passed obj.
	 *
	 * @param {THREE.Object3D} obj - obj to attach to.
	 * @param {string} name - name to write.
	 * @param {string} font - path to font.
	 * @param {number} size - size of text.
	 * @param {THREE.Vector3Tuple} position - position of text.
	 * @param {THREE.Vector3Tuple} rotation - rotation of text.
	 * @param {number} maxWidth - maximum width before wrapping.
	 */
	private attachText(
		obj: THREE.Object3D,
		name: string,
		font: string = CONFIG.fontPath,
		size: number = CONFIG.fontSize,
		position: THREE.Vector3Tuple = CONFIG.textPosition,
		rotation: THREE.Vector3Tuple = CONFIG.textRotation,
		maxWidth: number = CONFIG.maxWidth
	) {
		preloadFont(
			{
				font: font,
				characters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`1234567890-=[];,./~!@#$%^&*()_+{}|:<>?\'\"',
				sdfGlyphSize: 64,
			},
			() => {
				const thisText = new Text();
				thisText.text = `(${name})`;
				thisText.font = font;
				thisText.fontSize = size;
				thisText.material = new THREE.MeshBasicMaterial({ color: CONFIG.textColor });
	
				thisText.anchorX = 'center';
				thisText.anchorY = 'middle';
				thisText.position.set(...position);
				thisText.rotation.set(...rotation);
	
				thisText.maxWidth = maxWidth;
	
				// After sync completes, adjust size to fit
				thisText.sync(() => { this.adjustFontSize(thisText); })
	
				thisText.frustumCulled = false;
				if (thisText instanceof THREE.Object3D) obj.add(thisText);
	
				this.tagText = thisText;
			}
		)
	}
	
	/**
	 * Updates the Text to passed string.
	 * @param {Text} text - Text object.
	 * @param {string} string - string to set.
	 */
	private setText(text: Text, string: string) {
		text.text = `(${string})`;
		text.sync(() => { this.adjustFontSize(text); })
	}
	
	/**
	 * Recursively adjusts the Text font size until it fits within
	 * the maxWidth/maxHeight bounds.
	 * @param {Text} text - Text object.
	 * @param {string} tries - number of tries for recursion.
	 */
	private adjustFontSize(text: Text, tries: number = 20) {
		const textInfo = text.textRenderInfo;
	
		if (textInfo) {
			const width = textInfo.blockBounds[2] - textInfo.blockBounds[0];
			const height = textInfo.blockBounds[3] - textInfo.blockBounds[1];
	
			if (tries <= 0) { // If name is way too long, show error on tag
				text.text = '[ERROR]\nToo Long';
				text.fontSize = CONFIG.fontSize;
				text.sync();
	
			} else if (width > CONFIG.maxWidth || height > CONFIG.maxHeight) {
				text.fontSize *= 0.9;
				text.sync(() => this.adjustFontSize(text, --tries));
			}
		}
	}
	
	/**
	 * Plays selected clips
	 *
	 * @param {Array<THREE.AnimationClip>} clips - material to convert to.
	 * @param {Array<string>} selection - original material.
	 */
	private playSelectedClips(
		clips: Array<THREE.AnimationClip>,
		selection: Array<string>,
		loopOnce?: boolean,
	) {
		clips.forEach(clip => { // Play all of the clips defined in selection for box opening
			if (selection.some(name => clip.name.includes(name))) {
				THREE.AnimationUtils.makeClipAdditive(clip);
				const action = this.mixer.clipAction(clip);
				action.blendMode = THREE.AdditiveAnimationBlendMode;
				action.clampWhenFinished = true;
				if (loopOnce) action.setLoop(THREE.LoopOnce, 0);
				action.play();
			}
		});
	}
	
	/**
	 * Allows object to be used for OutlinePass and enables shadows.
	 */
	private outlineAndShadow(obj: THREE.Object3D) {
		this.outlinedObjects.push(obj);
		obj.castShadow = true;
		obj.receiveShadow = true;
		if (obj instanceof THREE.Mesh) obj.material.shadowSide = THREE.FrontSide;
	}
	
	/**
	 * Moves the ray objects with the tag object without changing their rotation.
	 */
	private raysToTag() {
		const tag = this.scene.getObjectByName('SanteeTag');
		const sunburst = this.scene.getObjectByName('Sunburst');
		const sunrays = this.scene.getObjectByName('Sunrays');
	
		if (tag && sunburst && sunrays) {
			if (tag.children.length == 0) {
				const intermediaryChild = new THREE.Object3D();
	
				tag.add(intermediaryChild);
			}
	
			sunburst.position.setFromMatrixPosition(tag.children[0].matrixWorld);
			sunrays.position.setFromMatrixPosition(tag.children[0].matrixWorld);
		}
	}
}

// Just for convenience
class Santee {
	private gift: WebGLGift;

	constructor(webglGift: WebGLGift) {
		this.gift = webglGift;
	}

	getName() {
		return webglGift.santeeName;
	}

	setName(name: string) {
		this.gift.santeeName = name;
	}
}

const webglGift = new WebGLGift(document.getElementById('container')!, window, 'tadmozeltov', () => {
	const info = document.getElementById('info');
				
	if (info) info.style.display = 'none';
});
const santee = new Santee(webglGift);

webglGift.start();
