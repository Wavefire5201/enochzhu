<script lang="ts">
	import { T, useTask, useThrelte } from "@threlte/core";
	import { interactivity } from "@threlte/extras";
	import { onDestroy, untrack } from "svelte";
	import type { Mesh as ThreeMesh, Object3D, Texture } from "three";
	import {
		Box3,
		BufferGeometry,
		CanvasTexture,
		CircleGeometry,
		RingGeometry,
		Color,
		DoubleSide,
		Mesh,
		MeshBasicMaterial,
		MeshPhysicalMaterial,
		PlaneGeometry,
		PMREMGenerator,
		Scene as ThreeScene,
		EquirectangularReflectionMapping,
		FloatType,
		SRGBColorSpace,
		TextureLoader,
		Vector2,
		Vector3,
		AgXToneMapping,
	} from "three";
	import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
	import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
	import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
	import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
	import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
	import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
	import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
	import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
	import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
	import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
	import type { CdAlbum } from "./albums";
	import CdCase from "./CdCase.svelte";
	import type { PreviewPlayer } from "./preview-player.svelte";
	import {
		createDiscMaps,
		DEFAULT_HALFTONE_OPTIONS,
		type DiscMaps,
		type DiscStyle,
		type HalftoneOptions,
		pickDiscStyle,
		type DitherDiscOptions,
		DEFAULT_DITHER_DISC_OPTIONS,
	} from "./disc-art";
	import { albumIndexAt, poolSize } from "./layout";
	import {
		BOOKLET_RECT,
		CASE_MODEL_HUB,
		DEFAULT_CD_CASE_SCENE,
		type JewelCaseModel,
	} from "./models";
	import type { WallScroll } from "./scroll";
	import { createCoverCache } from "./textures";
	import { createVideoCache } from "./video-textures";

	interface Props {
		albums: CdAlbum[];
		scroll: WallScroll;
		openedSlot: number | null;
		onopen: (slot: number | null) => void;
		onhover: (album: CdAlbum | null, slot?: number) => void;
		onready?: () => void;
		onfail: () => void;
		caseYaw?: number;
		casePitch?: number;
		caseRoll?: number;
		openAngle?: number;
		presentYaw?: number;
		presentPitch?: number;
		presentRoll?: number;
		presentScale?: number;
		/** where an opened case settles — negative x parks it left, clearing room */
		presentX?: number;
		presentY?: number;
		preview?: boolean;
		/** use the proto's perspective viewing geometry while retaining the wall pool */
		perspectiveWall?: boolean;
		caseModel?: JewelCaseModel;
		/** proto disc-face exploration: what to print on the CD */
		discStyle?: DiscStyle;
		halftoneOptions?: HalftoneOptions;
		hdriPath?: string | null;
		/** independent yaw offset before inspection rotates model + room together */
		hdriRotation?: number;
		backgroundIntensity?: number;
		backgroundBlurriness?: number;
		/** proto only: show the HDRI itself behind the case, not just its light */
		showBackground?: boolean;
		/** desaturate HDR lighting to keep reflections neutral */
		environmentDesaturation?: number;
		/** proto only: use the authored lightbox for lighting/reflections */
		lightboxEnabled?: boolean;
		/**
		 * proto only: render the authored rig as visible objects — a grey studio
		 * backdrop plus the emitters themselves. Without this the built-in
		 * lightbox lights the case from a room you cannot see, and the case floats
		 * on black; the reference renders get half their character from the room.
		 */
		showRig?: boolean;
		/** the authored lightbox: emitters we design rather than photograph */
		keyIntensity?: number;
		/**
		 * Scales the three broad softboxes. This is the dial that decides whether
		 * you see a light SHAPE or a veil: a mirror reflects an emitter at its
		 * angular size, and the key panel is 10x4 — from the cover's point of view
		 * that fills most of the sky, so its reflection covers the whole cover.
		 * Shrink it and the same light becomes a highlight with edges.
		 */
		softboxScale?: number;
		fillIntensity?: number;
		rimIntensity?: number;
		/** overhead ceiling run — the source of long raking streaks */
		stripCount?: number;
		stripIntensity?: number;
		stripWidth?: number;
		stripLength?: number;
		stripSpacing?: number;
		stripHeight?: number;
		/** how far in FRONT of the case the strips hang (0 = level with it) */
		stripDistance?: number;
		/** mirror-glint strength: the strip's SHAPE reflected in the glass */
		stripSpecular?: number;
		/** how mirror-like the disc is — high roughness smears a glint into a glow */
		discRoughness?: number;
		/** rad/sec the disc turns while a case is open — the reveal's turntable */
		discSpin?: number;
		/** thin-film rainbow on the bare mirror disc (0 = off, 1 = full) */
		discIridescence?: number;
		/** film-thickness range (nm) that sets the iridescent hue sweep */
		discThicknessLo?: number;
		discThicknessHi?: number;
		/** how far the disc lifts toward the viewer as a case opens (world units) */
		discLift?: number;
		glassRoughness?: number;
		glassTransmission?: number;
		glassClearcoat?: number;
		glassClearcoatRoughness?: number;
		/** how hard the environment shows in the glass — the white streaks */
		glassReflectivity?: number;
		environmentIntensity?: number;
		exposure?: number;
		/**
		 * Bloom. The reference renders read as LIGHT because their highlights
		 * bleed past their own edges; without it a bright emitter is just a white
		 * shape. Proto-only: bloom needs a manual render pipeline, and the live
		 * wall's canvas is composited over the page.
		 */
		bloomStrength?: number;
		bloomRadius?: number;
		bloomThreshold?: number;
		ditherOptions?: DitherDiscOptions;
		player?: PreviewPlayer;
	}

	const {
		albums,
		scroll,
		openedSlot,
		onopen,
		onhover,
		onready = () => {},
		onfail,
		caseYaw: configuredYaw = 1,
		casePitch: configuredPitch = 0.45,
		caseRoll: configuredRoll = 0,
		// -1.55 rad (~ -89°) lays the lid flat on the open side; the presented
		// pose squares the case to camera and grows it by a third
		openAngle = -1.55,
		presentYaw = 0,
		presentPitch = 0,
		presentRoll = 0,
		presentScale = 0.35,
		presentX = 0,
		presentY = 0,
		preview = false,
		perspectiveWall = false,
		caseModel = DEFAULT_CD_CASE_SCENE.caseModel,
		discStyle = "mirror",
		halftoneOptions = DEFAULT_HALFTONE_OPTIONS,
		hdriPath = DEFAULT_CD_CASE_SCENE.hdriPath,
		hdriRotation = DEFAULT_CD_CASE_SCENE.hdriRotation,
		backgroundIntensity = DEFAULT_CD_CASE_SCENE.backgroundIntensity,
		backgroundBlurriness = DEFAULT_CD_CASE_SCENE.backgroundBlurriness,
		showBackground = DEFAULT_CD_CASE_SCENE.showBackground,
		lightboxEnabled = DEFAULT_CD_CASE_SCENE.lightboxEnabled,
		environmentDesaturation = DEFAULT_CD_CASE_SCENE.environmentDesaturation,
		showRig = false,
		// Tuned in /proto/cd-case against the Sketchfab reference. The through-line:
		// SMALL, BRIGHT emitters. A big dim panel reflects as a veil over the whole
		// cover; a small bright one reflects as a shape with edges.
		keyIntensity = DEFAULT_CD_CASE_SCENE.keyIntensity,
		softboxScale = DEFAULT_CD_CASE_SCENE.softboxScale,
		fillIntensity = DEFAULT_CD_CASE_SCENE.fillIntensity,
		rimIntensity = DEFAULT_CD_CASE_SCENE.rimIntensity,
		stripCount = DEFAULT_CD_CASE_SCENE.stripCount,
		stripIntensity = DEFAULT_CD_CASE_SCENE.stripIntensity,
		stripWidth = DEFAULT_CD_CASE_SCENE.stripWidth,
		stripLength = DEFAULT_CD_CASE_SCENE.stripLength,
		stripSpacing = DEFAULT_CD_CASE_SCENE.stripSpacing,
		stripHeight = DEFAULT_CD_CASE_SCENE.stripHeight,
		// negative: the tubes hang in the room BEHIND the case, where they read as
		// part of the studio instead of blocking the lens
		stripDistance = DEFAULT_CD_CASE_SCENE.stripDistance,
		stripSpecular = DEFAULT_CD_CASE_SCENE.stripSpecular,
		discRoughness = DEFAULT_CD_CASE_SCENE.discRoughness,
		discSpin = 0.8,
		discIridescence = 1,
		discThicknessLo = 320,
		discThicknessHi = 720,
		discLift = 0.06,
		glassRoughness = DEFAULT_CD_CASE_SCENE.glassRoughness,
		glassTransmission = DEFAULT_CD_CASE_SCENE.glassTransmission,
		glassClearcoat = DEFAULT_CD_CASE_SCENE.glassClearcoat,
		glassClearcoatRoughness = DEFAULT_CD_CASE_SCENE.glassClearcoatRoughness,
		glassReflectivity = DEFAULT_CD_CASE_SCENE.glassReflectivity,
		environmentIntensity = DEFAULT_CD_CASE_SCENE.environmentIntensity,
		exposure = DEFAULT_CD_CASE_SCENE.exposure,
		bloomStrength = DEFAULT_CD_CASE_SCENE.bloomStrength,
		bloomRadius = DEFAULT_CD_CASE_SCENE.bloomRadius,
		bloomThreshold = DEFAULT_CD_CASE_SCENE.bloomThreshold,
		ditherOptions = DEFAULT_DITHER_DISC_OPTIONS,
		player,
	}: Props = $props();

	// closest hit only: a case is several stacked meshes and unfiltered
	// raycasts dispatch once per mesh — a tap would open the album link
	// multiple times
	interactivity({ filter: (hits) => hits.slice(0, 1) });

	const { renderer, scene, size, camera, autoRender, renderStage } =
		useThrelte();
	// Transmission is a screen-space pass. Keep the wall at the same supersampled
	// resolution as the single-case lab so environment streaks stay visible on
	// the smaller pooled cases instead of softening into their cover art.
	renderer.transmissionResolutionScale = 1.5;

	// RectAreaLight renders black without its LTC lookup tables. One-time, global.
	RectAreaLightUniformsLib.init();

	// The glass reflects the PMREM'd HDRI. The exposed CD face is assigned the
	// original 4K equirectangular map once it loads: this keeps its mirror detail
	// above PMREM's filtered resolution while retaining physically softened glass.

	// ——— bloom (proto + perspective wall) ———
	// A bright emitter without bloom is just a white shape; bloom is what makes
	// it read as LIGHT, bleeding past its own edges the way the reference
	// renders do. It needs the render loop taken over by an EffectComposer, so
	// Threlte's autoRender is switched off and the render stage driven by hand.
	// Both modes are fixed for the lifetime of a mount, so reading them once
	// here is deliberate — untrack says so out loud.
	if (untrack(() => preview || perspectiveWall)) {
		const composer = new EffectComposer(renderer);
		const renderPass = new RenderPass(scene, camera.current);
		const bloomPass = new UnrealBloomPass(new Vector2(1, 1), 0, 0.4, 0.85);
		composer.addPass(renderPass);
		composer.addPass(bloomPass);
		// OutputPass LAST, and it must stay last: it is what tone-maps and encodes
		// to sRGB. Put anything after it and that pass renders an already-encoded
		// image to the canvas, which encodes it a second time — double sRGB, which
		// looks like lifted blacks and washed-out colour.
		//
		// Bloom therefore sees LINEAR HDR, where a lit room sits at 5-20, not 0-1.
		// bloomThreshold is in those units: 1 is not "near-white", it is "dimmer
		// than most of the scene", which is why a low threshold fogs everything.
		composer.addPass(new OutputPass());
		autoRender.set(false);

		$effect(() => {
			bloomPass.strength = bloomStrength;
			bloomPass.radius = bloomRadius;
			bloomPass.threshold = bloomThreshold;
		});
		$effect(() => {
			composer.setSize($size.width, $size.height);
			composer.setPixelRatio(renderer.getPixelRatio());
		});

		useTask(
			() => {
				renderPass.camera = camera.current;
				composer.render();
			},
			{ stage: renderStage, autoInvalidate: false },
		);

		onDestroy(() => composer.dispose());
	}

	// jewel case proportions (≈142×125mm real), width normalized
	const CASE_W = 1.45;
	const CASE_H = 1.31;
	const CASE_D = 0.1;
	const LID_GAP = 0.02;
	const CASE_BEVEL = 0.04;
	// A panorama has no parallax: sliding a row beneath a fixed HDRI cannot
	// change its reflections. Turn the single room a little as the row moves,
	// equivalent to orbiting the viewer around the display, so attic's skylights
	// sweep across the differently posed cases.
	const HDRI_SCROLL_ROTATION = 0.7;
	// generous air between neighbors; with the sideways parting on inspect,
	// a full 360° turn never clips the row
	const SPACING = 1.3;

	// Gallery pose: dead upright (no pitch, no roll — a tipped case reads as
	// carelessness at this size), turned hard enough that the cover and a
	// slab of the spine both read.
	// Keep the row centered now that the floor mirror is gone.
	const ROW_Y = 0;

	// A little extra vertical air keeps the top edge of the case inside the
	// canvas, including when the lid is open or the case is pitched.
	const zoom = $derived($size.height * 0.44);
	const pool = $derived(preview ? 1 : poolSize($size.width / zoom, SPACING));
	$effect(() => {
		scroll.worldPerPixel = 1 / zoom;
	});

	// Opening a case hands the row to it: the offset that puts slot j at x=0 is
	// exactly j * SPACING, so parking there centers the opened case while the
	// scroll lock (focusTarget) holds it. Clearing it frees the row again. The
	// proto is a single fixed case and never scrolls, so this is wall-only.
	$effect(() => {
		if (preview) return;
		scroll.focusTarget = openedSlot !== null ? openedSlot * SPACING : null;
	});

	const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
	const covers = createCoverCache(anisotropy);
	const videos = createVideoCache(anisotropy);

	// ——— geometry ———
	// Procedural fallback renders instantly; the real modeled cases stream in
	// and swap seamlessly. The build script (scripts/models/) already oriented
	// every part into one canonical frame — front on +Z, hinge on -X — and
	// split the fused clear shell into a hinged Lid and a stationary Base, so
	// the loader's only job is to scale/center the WHOLE assembly. Parts are
	// never recentered individually: that would destroy the artist's
	// alignment and pull the tray's disc hub away from where the disc sits.
	const fallbackTray = new RoundedBoxGeometry(
		CASE_W,
		CASE_H,
		CASE_D,
		4,
		CASE_BEVEL,
	);
	const fallbackLid = new PlaneGeometry(CASE_W * 0.97, CASE_H * 0.97);
	const fallbackDisc = new RingGeometry((CASE_W * 0.42) * 0.12, CASE_W * 0.42, 64);
	// the fallback booklet is SQUARE — album art must never stretch
	const ART = Math.min(CASE_W, CASE_H) * 0.92;
	const fallbackArt = new PlaneGeometry(ART, ART);
	fallbackArt.translate(0.045, 0, 0); // breathing room for the spine hinge

	// The modeled booklet uses the rectangle the source model itself provides
	// (its "Insert Paper" mesh): slightly wider than tall, hugging the right
	// lip. Square album art cover-crops vertically — never stretches.
	const modeledArt = new PlaneGeometry(BOOKLET_RECT.w, BOOKLET_RECT.h);
	{
		const uv = modeledArt.getAttribute("uv");
		const crop = (1 - BOOKLET_RECT.h / BOOKLET_RECT.w) / 2;
		for (let i = 0; i < uv.count; i++)
			uv.setY(i, crop + uv.getY(i) * (1 - 2 * crop));
	}
	modeledArt.translate(BOOKLET_RECT.x, BOOKLET_RECT.y, 0);

	type ModelGeometry = {
		tray: BufferGeometry;
		lid: BufferGeometry;
		base: BufferGeometry;
		/** the printed tray card behind the perforated tray (detailed only) */
		card: BufferGeometry | null;
		caseDepth: number;
		lidFrontZ: number;
	};

	let modelGeometry = $state<Partial<Record<JewelCaseModel, ModelGeometry>>>(
		{},
	);
	let modeledDisc = $state<BufferGeometry | null>(null);

	function normalized(
		source: BufferGeometry,
		targetWidth: number,
	): { geometry: BufferGeometry; depth: number } {
		const geometry = source.clone();
		const sizeOf = () => {
			geometry.computeBoundingBox();
			const v = new Vector3();
			(geometry.boundingBox as Box3).getSize(v);
			return v;
		};
		let dims = sizeOf();
		// thin axis → Z (the piece faces the camera)
		if (dims.x <= dims.y && dims.x <= dims.z) geometry.rotateY(-Math.PI / 2);
		else if (dims.y <= dims.x && dims.y <= dims.z)
			geometry.rotateX(Math.PI / 2);
		dims = sizeOf();
		// wide axis → X (a jewel case is wider than tall)
		if (dims.y > dims.x) geometry.rotateZ(Math.PI / 2);
		dims = sizeOf();
		const s = targetWidth / dims.x;
		geometry.scale(s, s, s);
		geometry.center();
		dims = sizeOf();
		return { geometry, depth: dims.z };
	}

	/**
	 * Blender exports a named part as either a Mesh or a Group of primitive
	 * meshes. Flatten it into one geometry in world space so normalization is
	 * independent of the exporter's node layout.
	 */
	function partGeometry(root: Object3D, name: string) {
		root.updateMatrixWorld(true);
		const part = root.getObjectByName(name);
		if (!part) return null;
		const pieces: BufferGeometry[] = [];
		part.traverse((node) => {
			const mesh = node as ThreeMesh;
			if (!mesh.isMesh) return;
			pieces.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
		});
		if (pieces.length === 0) return null;
		if (pieces.length === 1) return pieces[0];
		const merged = mergeGeometries(pieces, false);
		for (const piece of pieces) piece.dispose();
		return merged;
	}

	function loadCaseModel(model: JewelCaseModel) {
		new GLTFLoader().load(
			`/models/jewel-case-${model}.glb`,
			(gltf) => {
				const lid = partGeometry(gltf.scene, "Lid");
				const base = partGeometry(gltf.scene, "Base");
				const tray = partGeometry(gltf.scene, "Tray");
				const card = partGeometry(gltf.scene, "Card");
				if (!lid || !base || !tray) {
					lid?.dispose();
					base?.dispose();
					tray?.dispose();
					card?.dispose();
					return;
				}

				// One shared transform for the whole assembly, derived from the
				// clear shell: scale to the physical width and center. The tray is
				// carried by the SAME transform, so its disc hub stays exactly where
				// the artist put it relative to the shell.
				lid.computeBoundingBox();
				base.computeBoundingBox();
				const shell = (lid.boundingBox as Box3)
					.clone()
					.union(base.boundingBox as Box3);
				const size = new Vector3();
				shell.getSize(size);
				const center = new Vector3();
				shell.getCenter(center);
				const s = CASE_W / size.x;
				for (const geometry of [lid, base, tray, card]) {
					if (!geometry) continue;
					geometry.translate(-center.x, -center.y, -center.z);
					geometry.scale(s, s, s);
				}

				modelGeometry = {
					...modelGeometry,
					[model]: {
						tray,
						lid,
						base,
						card,
						caseDepth: size.z * s,
						lidFrontZ: (shell.max.z - center.z) * s,
					},
				};
			},
			undefined,
			() => {
				// The procedural case remains visible if either optional asset fails.
			},
		);
	}

	loadCaseModel("detailed");
	loadCaseModel("charcoal");

	// Keep the modeled disc from the earlier hand-separated GLB. The new source
	// bundles contain cases only, so this remains the best disc geometry.
	new GLTFLoader().load("/models/cd-case.glb", (gltf) => {
		let cd: ThreeMesh | null = null;
		gltf.scene.traverse((node) => {
			if ((node as ThreeMesh).isMesh && node.name.toLowerCase().includes("cd"))
				cd = node as ThreeMesh;
		});
		if (!cd) return;
		modeledDisc = normalized(
			(cd as ThreeMesh).geometry,
			CASE_W * 0.845,
		).geometry;
	});

	const selectedModel = $derived(modelGeometry[caseModel] ?? null);
	const trayGeometry = $derived(selectedModel?.tray ?? fallbackTray);
	const baseGeometry = $derived(selectedModel?.base ?? null);
	const cardGeometry = $derived(selectedModel?.card ?? null);
	const lidGeometry = $derived(selectedModel?.lid ?? fallbackLid);
	const artGeometry = $derived(selectedModel ? modeledArt : fallbackArt);
	// The disc face is a proto exploration AND the live wall's payoff. The proto
	// drives it directly from the `discStyle` control; the live wall assigns a
	// per-album face (hybrid: explicit override or a hash-picked pool) to whatever
	// case is currently open. Only the opened case reveals its disc, so a single
	// shared material/geometry keyed on the opened album is enough.
	const openedAlbum = $derived(
		openedSlot !== null && albums.length
			? albums[albumIndexAt(openedSlot, albums.length)]
			: null,
	);
	const activeStyle = $derived<DiscStyle>(
		preview ? discStyle : openedAlbum ? "dither" : "mirror",
	);
	// Reduced motion: the case still opens and music still fades, but the disc
	// holds still and flat — no spin, no lift.
	let prefersReduced = $state(false);
	$effect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		prefersReduced = mq.matches;
		const on = () => (prefersReduced = mq.matches);
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	});
	// The live wall keeps the disc gentle so its printed title stays readable at a
	// glance while still visibly turning; the proto sets its own spin.
	const effectiveSpin = $derived(
		prefersReduced ? 0 : preview ? discSpin : 0.25,
	);
	const effectiveLift = $derived(prefersReduced ? 0 : discLift);
	// The extracted legacy disc mesh is excellent for the bare mirror, but its
	// UV island only covers the hub area. Printed label systems need a full,
	// predictable radial UV layout, so any styled face uses the procedural disc.
	const discGeometry = $derived(
		activeStyle !== "mirror" ? fallbackDisc : (modeledDisc ?? fallbackDisc),
	);
	const caseDepth = $derived(selectedModel?.caseDepth ?? CASE_D);
	// Modeled parts already sit at their assembly positions (lidZ 0); only the
	// flat inserts need placing: the booklet just inside the lid's front
	// panel, the disc just behind the booklet, seated on the tray hub.
	const lidZ = $derived(selectedModel ? 0 : CASE_D / 2 + 0.014 + LID_GAP);
	const artZ = $derived(
		selectedModel ? selectedModel.lidFrontZ - 0.02 : CASE_D / 2 + 0.009,
	);
	const discZ = $derived(selectedModel ? artZ - 0.012 : CASE_D / 2 + 0.003);
	const hub = $derived(
		selectedModel ? CASE_MODEL_HUB[caseModel] : { x: 0, y: 0 },
	);

	// ——— materials ———
	const caseMaterial = new MeshPhysicalMaterial({
		color: "#0e1110",
		roughness: 0.6,
		clearcoat: 0.4,
		clearcoatRoughness: 0.4,
		metalness: 0,
	});

	// Real PBR transmission — the lid bends light, picks up the envmap, and
	// reveals the cover art behind it.
	const lidMaterial = new MeshPhysicalMaterial({
		color: "#ffffff",
		metalness: 0,
		roughness: 0.015, // near-zero: the art behind must stay crisp
		transmission: 1,
		thickness: 0.02,
		ior: 1.49,
		attenuationColor: "#ffffff",
		attenuationDistance: 1.2,
		clearcoat: 1,
		clearcoatRoughness: 0.04,
		envMapIntensity: 1.4,
	});
	$effect(() => {
		// A printed disc style flips the disc from bare iridescent metal to a
		// matte label with shiny clamp/edge rings; the map textures are applied in
		// the async effect below, these are the scalar counterparts. mirror = the
		// original bare disc.
		// Set the CD material properties to be identical to the bare iridescent CD face (mirror)
		discMaterial.roughness = discRoughness;
		discMaterial.metalness = 0.9;
		discMaterial.iridescence = discIridescence;
		discMaterial.iridescenceThicknessRange = [discThicknessLo, discThicknessHi];
		discMaterial.color.set("#e2e2de");
		discMaterial.emissive.set("#000000");
		discMaterial.emissiveIntensity = 0;
		// The raw 4K equirectangular source is used for the shiny CD face reflections
		discMaterial.envMap = hdriSource;
		const charcoal = caseModel === "charcoal";
		// Preserve each folder's tray MTL profile. Both variants deliberately use
		// the same clean glass below—there is no fingerprint roughness texture.
		caseMaterial.roughness = charcoal ? 0.08 : 0.6;
		caseMaterial.metalness = charcoal ? 0.33 : 0;
		caseMaterial.clearcoat = charcoal ? 0.8 : 0.4;
		lidMaterial.roughness = glassRoughness;
		lidMaterial.transmission = glassTransmission;
		lidMaterial.clearcoat = glassClearcoat;
		lidMaterial.clearcoatRoughness = glassClearcoatRoughness;
		lidMaterial.envMapIntensity = glassReflectivity;
		caseMaterial.envMapIntensity = environmentIntensity;
		
		discMaterial.envMapIntensity = environmentIntensity * 1.5;
		scene.environmentIntensity = environmentIntensity;
		// Glass and disc both read scene.environment (the PMREM'd HDRI) — the exact
		// path the proto is tuned on, so the wall matches it.
		scene.environmentRotation.set(0, hdriRotation, 0);
		// The wall can now show its HDRI backdrop as well as the preview. Both
		// need the same display transform or the EXR renders almost black on the
		// live page even though it is lighting the cases correctly.
		renderer.toneMapping = AgXToneMapping;
		renderer.toneMappingExposure = exposure;
	});

	// thin-film iridescence — a real CD's rainbow
	const discMaterial = new MeshPhysicalMaterial({
		color: "#e2e2de",
		metalness: 0.9,
		roughness: 0.12,
		iridescence: 1,
		iridescenceIOR: 1.35,
		iridescenceThicknessRange: [320, 720],
		envMapIntensity: 2.2,
	});
	// The label sits above the reflective substrate only for the proto's printed
	// styles. It is deliberately unlit: physical ink must stay legible under a
	// bright HDR window, while the disc underneath still supplies metal/glass.
	const discPrintMaterial = new MeshBasicMaterial({
		transparent: true,
		depthWrite: false,
		toneMapped: true,
	});

	// Build the disc maps for whichever face is active: the proto's single album,
	// or (on the live wall) the album of the currently-open case. Only the opened
	// disc is ever visible, so one shared material is enough. "art"/"halftone"
	// load the cover, so this is async; the scalar props live in the effect above.
	const discMapsCache = new Map<string, DiscMaps>();
	onDestroy(() => {
		for (const maps of discMapsCache.values()) {
			maps.dispose();
		}
		discMapsCache.clear();
	});

	let discMaps: DiscMaps | null = null;
	function clearDiscMaps() {
		discMaterial.map = null;
		discMaterial.emissiveMap = null;
		discMaterial.metalnessMap = null;
		discMaterial.roughnessMap = null;
		discMaterial.needsUpdate = true;
		discPrintMaterial.map = null;
		discPrintMaterial.needsUpdate = true;
		discMaps = null;
	}
	$effect(() => {
		const style = activeStyle;
		const album = preview ? albums[0] : openedAlbum;
		// Read each tuner field inside the effect. The face builder is async, so
		// passing the options object alone would only track its identity and a
		// slider move would not necessarily rebuild the canvas texture.
		const options: HalftoneOptions = {
			density: halftoneOptions.density,
			dotScale: halftoneOptions.dotScale,
			contrast: halftoneOptions.contrast,
			inkOpacity: halftoneOptions.inkOpacity,
		};
		const ditherOpts: DitherDiscOptions = {
			density: preview ? ditherOptions.density : 256,
			colorMode: preview ? ditherOptions.colorMode : "bw",
			contrast: preview ? ditherOptions.contrast : ditherOptions.contrast,
		};
		if (style === "mirror" || !album) {
			clearDiscMaps();
			return;
		}
		let cancelled = false;

		const cacheKey = `${style}_${album.id}_${ditherOpts.density}_${ditherOpts.colorMode}`;
		if (discMapsCache.has(cacheKey)) {
			const maps = discMapsCache.get(cacheKey)!;
			discMaps = maps;
			discMaterial.map = null;
			discMaterial.emissiveMap = null;
			discMaterial.metalnessMap = null;
			discMaterial.roughnessMap = null;
			discMaterial.needsUpdate = true;
			discPrintMaterial.map = maps.map;
			discPrintMaterial.needsUpdate = true;
			return;
		}

		createDiscMaps(style, album, options, ditherOpts)
			.then((maps) => {
				if (cancelled) {
					maps.dispose();
					return;
				}
				discMapsCache.set(cacheKey, maps);
				discMaps = maps;
				discMaterial.map = null;
				discMaterial.emissiveMap = null;
				discMaterial.metalnessMap = null;
				discMaterial.roughnessMap = null;
				discMaterial.needsUpdate = true;
				discPrintMaterial.map = maps.map;
				discPrintMaterial.needsUpdate = true;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		// Pre-warm dither maps cache for all albums
		if (preview) return;
		for (const album of albums) {
			const cacheKey = `dither_${album.id}_256_bw`;
			if (!discMapsCache.has(cacheKey)) {
				createDiscMaps("dither", album, halftoneOptions, {
					density: 256,
					colorMode: "bw",
					contrast: ditherOptions.contrast ?? 1.0,
				}).then((maps) => {
					if (!discMapsCache.has(cacheKey)) {
						discMapsCache.set(cacheKey, maps);
					} else {
						maps.dispose();
					}
				}).catch(() => {});
			}
		}
	});

	// Lightbox environment: a black studio with softbox strips, built in code
	// and PMREM'd — no HDR asset. This is where the shine lives: the glass lids
	// and case edges pick up long white streak reflections that sweep as the
	// cases turn, product-photography style. Every emitter is authored here
	// rather than photographed, so the reflections are designed, not found.
	const lightbox = new ThreeScene();
	const softboxes: Mesh[] = [];

	function clearLightbox() {
		for (const mesh of softboxes) {
			lightbox.remove(mesh);
			mesh.geometry.dispose();
			(mesh.material as MeshBasicMaterial).dispose();
		}
		softboxes.length = 0;
	}

	// Strip lights — a run of fluorescents hung IN FRONT of the case, angled back
	// at it. This placement is the whole point: a case squared up to camera
	// mirrors whatever sits behind the camera, so ceiling lights pointing
	// straight down never show up in it.
	//
	// Each strip is emitted TWICE, on purpose:
	//   - as a plane in the PMREM lightbox, which lights the case but is
	//     prefiltered (read: blurred) into a soft wash — no visible shape;
	//   - as a RectAreaLight in the real scene, which reflects as an actual
	//     rectangle with edges, so you see the light SOURCE slide across the
	//     glass instead of the whole cover just brightening.
	// The env map does the lighting, the area lights do the glints.
	const strips = $derived(
		Array.from({ length: stripCount }, (_, i) => ({
			x: -((stripCount - 1) * stripSpacing) / 2 + i * stripSpacing,
			y: stripHeight,
			z: stripDistance,
		})),
	);

	/**
	 * Every emitter in the rig, as plain data. One list, two consumers: it is
	 * baked into the PMREM environment (which lights the case) AND, when the rig
	 * is shown, rendered as visible meshes in the real scene (which is what you
	 * actually see reflected, and what bloom makes glow). Describing them once
	 * means the thing you see behind the case is provably the thing lighting it.
	 *
	 * `rotation: null` means "aim at the case" — resolved with lookAt, so moving
	 * an emitter can never leave it facing into the void.
	 */
	const emitters = $derived([
		// key: broad overhead panel — the long horizontal streak on the lids
		{
			w: 10 * softboxScale,
			h: 4 * softboxScale,
			intensity: keyIntensity,
			position: [0, 5, 2] as [number, number, number],
			rotation: [-Math.PI / 2.6, 0, 0] as [number, number, number] | null,
		},
		// fill: tall narrow strip camera-left — the vertical edge highlight
		{
			w: 1.6 * softboxScale,
			h: 9 * softboxScale,
			intensity: fillIntensity,
			position: [-6, 0, 3] as [number, number, number],
			rotation: [0, Math.PI / 2.6, 0] as [number, number, number] | null,
		},
		// rim: faint strip camera-right, separates spines from the void
		{
			w: 1.2 * softboxScale,
			h: 8 * softboxScale,
			intensity: rimIntensity,
			position: [6.5, 0, 1] as [number, number, number],
			rotation: [0, -Math.PI / 2.4, 0] as [number, number, number] | null,
		},
		// the strip run
		...strips.map((strip) => ({
			w: stripWidth,
			h: stripLength,
			intensity: stripIntensity,
			position: [strip.x, strip.y, strip.z] as [number, number, number],
			rotation: null as [number, number, number] | null,
		})),
	]);

	function buildLightbox() {
		clearLightbox();
		for (const e of emitters) {
			const mesh = new Mesh(
				new PlaneGeometry(e.w, e.h),
				new MeshBasicMaterial({
					color: new Color(e.intensity, e.intensity, e.intensity),
				}),
			);
			mesh.position.set(...e.position);
			if (e.rotation) mesh.rotation.set(...e.rotation);
			else mesh.lookAt(0, 0, 0);
			lightbox.add(mesh);
			softboxes.push(mesh);
		}
	}

	// The studio backdrop: a vertical grey gradient, the seamless "infinity cove"
	// every product shoot is lit against. Painted rather than modelled — at this
	// camera there is no parallax to give it away.
	function studioGradient() {
		const canvas = document.createElement("canvas");
		canvas.width = 4;
		canvas.height = 256;
		const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
		const grad = ctx.createLinearGradient(0, 0, 0, 256);
		grad.addColorStop(0, "#2b2e30"); // dark above, so the lights read bright
		grad.addColorStop(0.55, "#8d9295");
		grad.addColorStop(1, "#c8ccce"); // pale floor
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, 4, 256);
		return new CanvasTexture(canvas);
	}
	const backdropTexture = studioGradient();

	const pmrem = new PMREMGenerator(renderer);
	let lightboxEnvironment: ReturnType<typeof pmrem.fromScene> | null = null;
	let hdriEnvironment: ReturnType<typeof pmrem.fromEquirectangular> | null =
		null;
	// Two handles to the same texture, on purpose. The template needs a reactive
	// one to show the backdrop; the loader effect needs to dispose the previous
	// texture WITHOUT reading the reactive one — reading it there would make it
	// a dependency, so the load callback writing it would retrigger the load in
	// an infinite refetch loop.
	let hdriSource = $state<Texture | null>(null);
	let hdriDisposable: Texture | null = null;
	// A tonemapped JPG sibling of the HDRI (same basename, .jpg) is preferred
	// for the VISIBLE backdrop: lighting only needs a 4K EXR, but a camera
	// FOV of 32° shows barely a tenth of the panorama, so the backdrop wants
	// far more pixels than the light does. An 8K JPG is 3.5 MB; an 8K EXR
	// would be tens.
	let hdriBackground = $state<Texture | null>(null);
	let hdriBackgroundDisposable: Texture | null = null;
	let hdriRequest = 0;
	scene.background = null;

	// Process an LDR panorama on a canvas before it becomes a GPU texture: cap it
	// at maxWidth (an 8K source uploads ~130MB and stalls decode) and desaturate
	// toward luminance to neutralize a colored cast — the pine attic reads warm
	// and yellow otherwise. Returns a fresh CanvasTexture, disposing the source.
	function processLdr(
		texture: Texture,
		maxWidth: number,
		desaturate: number,
	): Texture {
		const image = texture.image as
			{ width?: number; height?: number } | undefined;
		const width = image?.width ?? 0;
		const height = image?.height ?? 0;
		if (!width || !height) return texture;
		const scale = width > maxWidth ? maxWidth / width : 1;
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return texture;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(image as HTMLImageElement, 0, 0, canvas.width, canvas.height);
		const amount = Math.min(1, Math.max(0, desaturate));
		if (amount > 0) {
			const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const data = frame.data;
			for (let i = 0; i < data.length; i += 4) {
				const luminance =
					0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
				data[i] += (luminance - data[i]) * amount;
				data[i + 1] += (luminance - data[i + 1]) * amount;
				data[i + 2] += (luminance - data[i + 2]) * amount;
			}
			ctx.putImageData(frame, 0, 0);
		}
		texture.dispose();
		const processed = new CanvasTexture(canvas);
		processed.colorSpace = SRGBColorSpace;
		return processed;
	}

	// rebuilds whenever any lightbox dial moves. A loaded HDRI takes precedence,
	// so this only ever drives the built-in environment.
	$effect(() => {
		buildLightbox();
		lightboxEnvironment?.dispose();
		lightboxEnvironment = pmrem.fromScene(lightbox, 0.02);
		if (!hdriEnvironment)
			scene.environment = lightboxEnabled ? lightboxEnvironment.texture : null;
	});

	// On the live site an HDRI lights the case but is never shown: the page has
	// to stay visible behind it. The proto can reveal it (showBackground) to
	// judge the glass against the light that is actually reflecting in it.
	$effect(() => {
		const path = hdriPath;
		const request = ++hdriRequest;
		if (hdriEnvironment) {
			hdriEnvironment.dispose();
			hdriEnvironment = null;
		}
		// dispose through the plain handles; see the declaration above for why
		// this must never read hdriSource
		hdriDisposable?.dispose();
		hdriDisposable = null;
		hdriSource = null;
		discMaterial.envMap = null;
		discMaterial.needsUpdate = true;
		hdriBackgroundDisposable?.dispose();
		hdriBackgroundDisposable = null;
		hdriBackground = null;
		scene.background = null;
		if (lightboxEnvironment)
			scene.environment = lightboxEnabled ? lightboxEnvironment.texture : null;
		if (!path) return;

		const lowerPath = path.toLowerCase();
		const isLdrImage = /\.(jpe?g|png)$/i.test(lowerPath);
		const loader = lowerPath.endsWith(".exr")
			? new EXRLoader()
			: lowerPath.endsWith(".hdr")
				? new RGBELoader()
				: new TextureLoader();
		if (loader instanceof EXRLoader) loader.type = FloatType;

		function neutralizeEnvironment(texture: Texture) {
			if (environmentDesaturation <= 0 || isLdrImage) return;
			const image = texture.image as {
				data?: Float32Array;
				width?: number;
				height?: number;
			};
			const data = image.data;
			if (!data || !image.width || !image.height) return;
			const channels = data.length / (image.width * image.height);
			if (channels < 3 || !Number.isInteger(channels)) return;
			const amount = Math.min(1, Math.max(0, environmentDesaturation));
			for (let i = 0; i < data.length; i += channels) {
				const r = Math.max(0, data[i]);
				const g = Math.max(0, data[i + 1]);
				const b = Math.max(0, data[i + 2]);
				const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
				data[i] = Math.max(0, r + (luminance - r) * amount);
				data[i + 1] = Math.max(0, g + (luminance - g) * amount);
				data[i + 2] = Math.max(0, b + (luminance - b) * amount);
			}
			texture.needsUpdate = true;
		}
		loader.load(
			path,
			(texture) => {
				if (request !== hdriRequest) {
					texture.dispose();
					return;
				}
				let source: Texture = texture;
				if (isLdrImage) {
					texture.colorSpace = SRGBColorSpace;
					// Cap an oversized LDR panorama (proto's jpgs) and desaturate it
					// here — LDR data can't run through neutralizeEnvironment's float
					// path. The production wall uses a real HDR EXR, not this branch.
					source = processLdr(texture, 4096, environmentDesaturation);
				} else {
					neutralizeEnvironment(texture);
				}
				hdriEnvironment = pmrem.fromEquirectangular(source);
				scene.environment = hdriEnvironment.texture;
				onready();
				// the raw equirect is kept only so it can be shown as a backdrop;
				// lighting always comes from the PMREM'd version
				source.mapping = EquirectangularReflectionMapping;
				hdriDisposable = source;
				hdriSource = source;
				// A disc is effectively a near-mirror. Sampling the original panorama
				// here retains the source's 4K detail instead of magnifying PMREM's
				// filtered reflection into visible blocks on a focused case.
				discMaterial.envMap = source;
				discMaterial.needsUpdate = true;
				// A selected JPG is already the authored visible panorama. Reuse it
				// instead of loading the same file a second time as its own sibling.
				if (isLdrImage) hdriBackground = source;
			},
			undefined,
			() => {
				// Keep the built-in lightbox if the file is missing or unsupported.
				onready();
			},
		);
		// A JPG sibling is only useful for the visible proto backdrop. The live
		// wall intentionally hides its HDRI, so probing for a nonexistent sibling
		// there creates a needless 404 on every visit.
		if (!isLdrImage && showBackground) {
			new TextureLoader().load(
				path.replace(/\.(exr|hdr)$/i, ".jpg"),
				(texture) => {
					if (request !== hdriRequest) {
						texture.dispose();
						return;
					}
					texture.mapping = EquirectangularReflectionMapping;
					texture.colorSpace = SRGBColorSpace;
					hdriBackgroundDisposable = texture;
					hdriBackground = texture;
				},
				undefined,
				() => {
					// No JPG sibling: the backdrop falls back to the EXR itself.
				},
			);
		}
	});

	// Use Three's real equirectangular background, not a plane with panorama
	// pixels pasted onto it. This surrounds the orthographic camera as a room,
	// so backgroundRotation and environmentRotation describe the same 3D space.
	$effect(() => {
		scene.background = showBackground ? (hdriBackground ?? hdriSource) : null;
		scene.backgroundIntensity = backgroundIntensity;
		scene.backgroundBlurriness = backgroundBlurriness;
	});

	// Inspection rotates the object under a fixed camera. Rotating the room by
	// the same transform makes that operation equivalent to orbiting the camera
	// around a stationary product: the panorama moves in view and its light
	// shapes sweep across the glass together instead of drifting out of sync.
	function syncEnvironmentRotation(x: number, y: number, z: number) {
		const roomYaw = y + hdriRotation;
		scene.environmentRotation.set(x, roomYaw, z);
		scene.backgroundRotation.copy(scene.environmentRotation);
	}

	const backdropWidth = $derived(($size.width / zoom) * 1.2);
	const backdropHeight = $derived(($size.height / zoom) * 1.2);

	// a lost context can't be recovered mid-scroll — hand over to the DOM strip
	const handleContextLost = () => onfail();
	renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

	useTask((delta) => {
		scroll.update(delta, performance.now());
		// pause animated covers whose album scrolled out of the pool this frame
		videos.sweep();
		if (!preview) {
			const roomYaw = hdriRotation + scroll.offset * HDRI_SCROLL_ROTATION;
			scene.environmentRotation.set(0, roomYaw, 0);
			scene.backgroundRotation.copy(scene.environmentRotation);
		}
	});

	onDestroy(() => {
		renderer.domElement.removeEventListener(
			"webglcontextlost",
			handleContextLost,
		);
		scene.environment = null;
		hdriEnvironment?.dispose();
		hdriDisposable?.dispose();
		hdriBackgroundDisposable?.dispose();
		backdropTexture.dispose();
		lightboxEnvironment?.dispose();
		clearLightbox();
		pmrem.dispose();
		covers.dispose();
		videos.dispose();
		fallbackTray.dispose();
		fallbackLid.dispose();
		fallbackDisc.dispose();
		fallbackArt.dispose();
		modeledArt.dispose();
		for (const geometry of Object.values(modelGeometry)) {
			geometry?.tray.dispose();
			geometry?.lid.dispose();
			geometry?.base.dispose();
			geometry?.card?.dispose();
		}
		modeledDisc?.dispose();
		caseMaterial.dispose();
		lidMaterial.dispose();
		discMaterial.dispose();
		discPrintMaterial.dispose();
		discMaps?.dispose();
	});
</script>

{#if preview || perspectiveWall}
	<!-- The target is a product-viewer shot: perspective foreshortening plus an
	     equirectangular room that fully surrounds the camera. Three's background
     cube is finite under an orthographic projection (it appeared as a small
	     rectangle), so both the lab and the wall use this camera geometry. The
	     wall simply parks the camera farther back to keep its pooled row framed. -->
	<T.PerspectiveCamera
		makeDefault
		fov={32}
		position={[0, 0, preview ? 5 : 5.8]}
	/>
{:else}
	<!-- The horizontal wall still needs an orthographic camera so every album
	     stays the same size across the viewport. Its HDRI is lighting-only. -->
	<T.OrthographicCamera makeDefault {zoom} position={[0, 0, 6]} />
{/if}

{#if lightboxEnabled}
	<!-- Invisible front-of-case area lights create discrete specular shapes. The
	     visible studio fixtures remain behind the case as part of the room. -->
	{#each strips as strip, i (i)}
		<T.RectAreaLight
			intensity={stripSpecular}
			width={stripWidth}
			height={stripLength}
			position={[strip.x, strip.y, Math.abs(strip.z)]}
			oncreate={(ref) => {
				ref.lookAt(0, 0, 0);
			}}
		/>
	{/each}
{/if}

{#if showRig}
	<!-- the studio the case is standing in: a grey cove behind it, and the rig's
	     own emitters made visible. These are the SAME emitters that are baked
	     into the environment map, so what you see is what is lighting the case —
	     and being real geometry, bloom makes them glow. -->
	<T.Mesh position.z={-3} renderOrder={-1}>
		<T.PlaneGeometry args={[backdropWidth, backdropHeight]} />
		<T.MeshBasicMaterial map={backdropTexture} />
	</T.Mesh>
	{#each emitters as emitter, i (i)}
		<T.Mesh
			position={emitter.position}
			oncreate={(ref) => {
				if (emitter.rotation) ref.rotation.set(...emitter.rotation);
				else ref.lookAt(0, 0, 0);
			}}
		>
			<T.PlaneGeometry args={[emitter.w, emitter.h]} />
			<!-- intensity > 1 on purpose: that is what clears the bloom threshold.
			     DoubleSide is required: every emitter is aimed AT the case, so its
			     front faces away from a camera sitting behind the viewer and a
			     single-sided plane would be back-face culled into invisibility.
			     (In the PMREM bake the camera is at the origin, so it sees the
			     front — which is why they light correctly but render as nothing.) -->
			<T.MeshBasicMaterial
				side={DoubleSide}
				color={new Color(
					emitter.intensity,
					emitter.intensity,
					emitter.intensity,
				)}
			/>
		</T.Mesh>
	{/each}
{/if}

{#if !preview && !hdriPath}
	<!-- Fallback fill only when the wall has no HDRI. Once an HDRI is selected it
	     is the entire light plan; extra ambient/direct fill flattens reflections. -->
	<T.DirectionalLight position={[-2.5, 3, 4]} intensity={1.1} />
	<T.AmbientLight intensity={0.3} />
{/if}

<T.Group position.y={ROW_Y}>
	{#each Array.from({ length: pool }, (_, k) => k) as i (i)}
		<CdCase
			index={i}
			{pool}
			spacing={SPACING}
			{albums}
			{scroll}
			{covers}
			{videos}
			caseGeometry={trayGeometry}
			{baseGeometry}
			{cardGeometry}
			{artGeometry}
			{lidGeometry}
			{discGeometry}
			{caseMaterial}
			{lidMaterial}
			{discMaterial}
			discPrintMaterial={activeStyle !== "mirror" ? discPrintMaterial : null}
			discPrintVisible={activeStyle !== "mirror"}
			caseYaw={configuredYaw}
			casePitch={configuredPitch}
			caseRoll={configuredRoll}
			reactiveLighting={!preview}
			{openAngle}
			{presentYaw}
			{presentPitch}
			{presentRoll}
			{presentScale}
			{presentX}
			{presentY}
			discSpin={effectiveSpin}
			discLift={effectiveLift}
			caseWidth={CASE_W}
			{caseDepth}
			discX={hub.x}
			discY={hub.y}
			{discZ}
			{artZ}
			{lidZ}
			{openedSlot}
			{onopen}
			{onhover}
			onrotation={preview ? syncEnvironmentRotation : undefined}
			discStyle={activeStyle}
			{ditherOptions}
			{player}
		/>
	{/each}
</T.Group>
