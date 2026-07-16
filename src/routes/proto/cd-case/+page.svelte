<script lang="ts">
	import { onMount } from "svelte";
	import type { Component } from "svelte";
	import type { CdAlbum } from "$lib/cd-wall/albums";
	import { DISC_STYLES, type DiscStyle } from "$lib/cd-wall/disc-art";
	import {
		DEFAULT_CD_CASE_SCENE,
		DEFAULT_WALL_HDRI_FILE,
		JEWEL_CASE_MODELS,
		type JewelCaseModel,
	} from "$lib/cd-wall/models";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	type Preview = Component<{
		album: CdAlbum;
		yaw: number;
		pitch: number;
		roll: number;
		openAngle: number;
		presentYaw: number;
		presentPitch: number;
		presentRoll: number;
		presentScale: number;
		presentX: number;
		presentY: number;
		caseModel: JewelCaseModel;
		discStyle: DiscStyle;
		onopenchange?: (open: boolean) => void;
		hdriPath: string | null;
		hdriRotation: number;
		backgroundIntensity: number;
		backgroundBlurriness: number;
		showBackground: boolean;
		lightboxEnabled: boolean;
		showRig: boolean;
		keyIntensity: number;
		softboxScale: number;
		fillIntensity: number;
		rimIntensity: number;
		stripCount: number;
		stripIntensity: number;
		stripWidth: number;
		stripLength: number;
		stripSpacing: number;
		stripHeight: number;
		stripDistance: number;
		stripSpecular: number;
		discRoughness: number;
		glassRoughness: number;
		glassTransmission: number;
		glassClearcoat: number;
		glassClearcoatRoughness: number;
		glassReflectivity: number;
		environmentIntensity: number;
		exposure: number;
		bloomStrength: number;
		bloomRadius: number;
		bloomThreshold: number;
	}>;

	let CdCasePreview = $state<Preview | null>(null);
	let selectedAlbumId = $state("kin");
	let selectedAlbum = $derived(
		data.albums.find((album) => album.id === selectedAlbumId) ??
			data.albums[0]!,
	);
	let yaw = $state(1);
	let pitch = $state(0.45);
	let roll = $state(0);
	let caseModel = $state<JewelCaseModel>(DEFAULT_CD_CASE_SCENE.caseModel);
	let discStyle = $state<DiscStyle>("mirror");
	let hdriFile = $state<string>(DEFAULT_WALL_HDRI_FILE);
	let hdriPath = $state<string | null>(DEFAULT_CD_CASE_SCENE.hdriPath);
	let hdriRotation = $state<number>(DEFAULT_CD_CASE_SCENE.hdriRotation);
	let backgroundIntensity = $state<number>(
		DEFAULT_CD_CASE_SCENE.backgroundIntensity,
	);
	let backgroundBlurriness = $state<number>(
		DEFAULT_CD_CASE_SCENE.backgroundBlurriness,
	);
	let showBackground = $state<boolean>(DEFAULT_CD_CASE_SCENE.showBackground);
	let lightboxEnabled = $state<boolean>(DEFAULT_CD_CASE_SCENE.lightboxEnabled);
	let showRig = $state(false);
	let lightBackground = $state(true);
	let glassRoughness = $state<number>(DEFAULT_CD_CASE_SCENE.glassRoughness);
	let glassTransmission = $state<number>(
		DEFAULT_CD_CASE_SCENE.glassTransmission,
	);
	let glassClearcoat = $state<number>(DEFAULT_CD_CASE_SCENE.glassClearcoat);
	let glassClearcoatRoughness = $state<number>(
		DEFAULT_CD_CASE_SCENE.glassClearcoatRoughness,
	);
	let glassReflectivity = $state<number>(
		DEFAULT_CD_CASE_SCENE.glassReflectivity,
	);
	let environmentIntensity = $state<number>(
		DEFAULT_CD_CASE_SCENE.environmentIntensity,
	);
	let exposure = $state<number>(DEFAULT_CD_CASE_SCENE.exposure);
	let bloomStrength = $state<number>(DEFAULT_CD_CASE_SCENE.bloomStrength);
	let bloomRadius = $state<number>(DEFAULT_CD_CASE_SCENE.bloomRadius);
	let bloomThreshold = $state<number>(DEFAULT_CD_CASE_SCENE.bloomThreshold);
	let copied = $state(false);

	// the opened state: how far the lid swings, and the pose the case settles
	// into as it turns to face the viewer. Grouped in one object so the sliders
	// stay a plain list instead of another parallel if-chain.
	const open = $state({
		angle: -1.55,
		yaw: 0,
		pitch: 0,
		roll: 0,
		scale: 0.35,
		x: 0,
		y: 0,
	});

	/** true while a case is presented — the info panel rides on this */
	let opened = $state(false);
	type OpenKey = keyof typeof open;

	const openControls: {
		key: OpenKey;
		label: string;
		min: number;
		max: number;
		step: number;
		/** rad = angle, mult = ×scale, world = raw world units */
		unit: "rad" | "mult" | "world";
	}[] = [
		{
			key: "angle",
			label: "lid open angle",
			min: -3.14,
			max: 0,
			step: 0.01,
			unit: "rad",
		},
		{
			key: "pitch",
			label: "present pitch",
			min: -1.57,
			max: 1.57,
			step: 0.01,
			unit: "rad",
		},
		{
			key: "yaw",
			label: "present yaw",
			min: -3.14,
			max: 3.14,
			step: 0.01,
			unit: "rad",
		},
		{
			key: "roll",
			label: "present roll",
			min: -3.14,
			max: 3.14,
			step: 0.01,
			unit: "rad",
		},
		{
			key: "scale",
			label: "present scale",
			min: 0,
			max: 1.5,
			step: 0.05,
			unit: "mult",
		},
		{
			key: "x",
			label: "present offset x",
			min: -2,
			max: 2,
			step: 0.05,
			unit: "world",
		},
		{
			key: "y",
			label: "present offset y",
			min: -2,
			max: 2,
			step: 0.05,
			unit: "world",
		},
	];

	function setOpenValue(key: OpenKey, event: Event) {
		open[key] = Number((event.currentTarget as HTMLInputElement).value);
	}

	// The authored lightbox. These emitters ARE the reflections: rather than
	// hunting for an HDRI that happens to have the right overhead lights, the
	// rig is built in code and tuned here. stripCount 0 = the original look.
	const light = $state({
		keyIntensity: 5,
		softboxScale: 0.3,
		fillIntensity: 2,
		rimIntensity: 1,
		stripCount: 2,
		stripIntensity: 10,
		stripWidth: 0.15,
		stripLength: 8,
		stripSpacing: 2.2,
		stripHeight: 1.25,
		stripDistance: -2.5,
		stripSpecular: 18,
		discRoughness: 0.02,
	});
	type LightKey = keyof typeof light;

	const lightControls: {
		key: LightKey;
		label: string;
		min: number;
		max: number;
		step: number;
	}[] = [
		{ key: "keyIntensity", label: "key panel", min: 0, max: 20, step: 0.1 },
		{
			key: "softboxScale",
			label: "softbox size (shape vs veil)",
			min: 0.05,
			max: 1.5,
			step: 0.05,
		},
		{ key: "fillIntensity", label: "fill (left)", min: 0, max: 20, step: 0.1 },
		{ key: "rimIntensity", label: "rim (right)", min: 0, max: 20, step: 0.1 },
		{ key: "stripCount", label: "overhead strips", min: 0, max: 8, step: 1 },
		{
			key: "stripIntensity",
			label: "strip brightness",
			min: 0,
			max: 30,
			step: 0.5,
		},
		{ key: "stripWidth", label: "strip width", min: 0.05, max: 2, step: 0.05 },
		{ key: "stripLength", label: "strip length", min: 1, max: 20, step: 0.5 },
		{
			key: "stripSpacing",
			label: "strip spacing",
			min: 0.2,
			max: 5,
			step: 0.1,
		},
		{
			key: "stripHeight",
			label: "rig height",
			min: -6,
			max: 10,
			step: 0.25,
		},
		{
			// Signed: POSITIVE hangs the strips in front of the case (toward the
			// viewer), which is where they must be to glint off a face-on cover —
			// but with the rig visible they then sit between the lens and the case
			// and block the shot, exactly as a real light in front of the camera
			// would. NEGATIVE puts them in the room behind, where you can see them.
			key: "stripDistance",
			label: "rig distance (+front / -behind)",
			min: -8,
			max: 8,
			step: 0.25,
		},
		{
			key: "stripSpecular",
			label: "strip glint (shape on glass)",
			min: 0,
			max: 30,
			step: 0.5,
		},
		{
			key: "discRoughness",
			label: "disc roughness (low = mirror)",
			min: 0.005,
			max: 0.4,
			step: 0.005,
		},
	];

	function setLightValue(key: LightKey, event: Event) {
		light[key] = Number((event.currentTarget as HTMLInputElement).value);
	}

	onMount(async () => {
		CdCasePreview = (await import("$lib/cd-wall/CdCasePreview.svelte")).default;
	});

	const controls = [
		{ key: "yaw", label: "yaw", min: -3.14, max: 3.14, step: 0.01 },
		{ key: "pitch", label: "pitch", min: -1.57, max: 1.57, step: 0.01 },
		{ key: "roll", label: "roll", min: -3.14, max: 3.14, step: 0.01 },
	] as const;

	type GlassKey =
		| "glassRoughness"
		| "glassTransmission"
		| "glassClearcoat"
		| "glassClearcoatRoughness"
		| "glassReflectivity"
		| "environmentIntensity"
		| "exposure"
		| "bloomStrength"
		| "bloomRadius"
		| "bloomThreshold";

	const glassControls: {
		key: GlassKey;
		label: string;
		min: number;
		max: number;
		step: number;
	}[] = [
		{
			key: "glassRoughness",
			label: "glass roughness",
			min: 0,
			max: 0.25,
			step: 0.005,
		},
		{
			key: "glassTransmission",
			label: "transmission",
			min: 0,
			max: 1,
			step: 0.01,
		},
		{ key: "glassClearcoat", label: "clearcoat", min: 0, max: 1, step: 0.01 },
		{
			key: "glassClearcoatRoughness",
			label: "clearcoat roughness",
			min: 0,
			max: 0.3,
			step: 0.005,
		},
		{
			// envMapIntensity on the glass alone — cranks the white streaks the
			// environment paints on the lid without brightening the whole scene
			key: "glassReflectivity",
			label: "glass reflectivity (white pop)",
			min: 0,
			max: 5,
			step: 0.1,
		},
		{
			key: "environmentIntensity",
			label: "environment intensity",
			min: 0,
			max: 3,
			step: 0.05,
		},
		{ key: "exposure", label: "exposure", min: 0.5, max: 2, step: 0.05 },
		// bloom is what turns a bright emitter into something that reads as light
		{ key: "bloomStrength", label: "bloom", min: 0, max: 3, step: 0.05 },
		{ key: "bloomRadius", label: "bloom radius", min: 0, max: 1, step: 0.05 },
		{
			// Linear HDR radiance, NOT 0-1. Measured on studio-tubes.exr: the room
			// sits around 1-10 while the lamps peak at ~1413. A threshold in the
			// 0-1 range therefore blooms literally everything into fog; the lamps
			// only separate from the room somewhere north of ~20.
			key: "bloomThreshold",
			label: "bloom threshold (HDR)",
			min: 0,
			max: 200,
			step: 1,
		},
	];

	function degrees(value: number) {
		return ((value * 180) / Math.PI).toFixed(1);
	}

	function radiansObject() {
		return {
			caseModel,
			hdriRotation: Number(hdriRotation.toFixed(2)),
			backgroundIntensity: Number(backgroundIntensity.toFixed(2)),
			backgroundBlurriness: Number(backgroundBlurriness.toFixed(2)),
			caseYaw: Number(yaw.toFixed(2)),
			casePitch: Number(pitch.toFixed(2)),
			caseRoll: Number(roll.toFixed(2)),
			openAngle: Number(open.angle.toFixed(2)),
			presentYaw: Number(open.yaw.toFixed(2)),
			presentPitch: Number(open.pitch.toFixed(2)),
			presentRoll: Number(open.roll.toFixed(2)),
			presentScale: Number(open.scale.toFixed(2)),
			...$state.snapshot(light),
		};
	}

	function valueFor(key: (typeof controls)[number]["key"]) {
		return key === "yaw" ? yaw : key === "pitch" ? pitch : roll;
	}

	function setValue(key: (typeof controls)[number]["key"], event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (key === "yaw") yaw = value;
		else if (key === "pitch") pitch = value;
		else roll = value;
	}

	function glassValue(key: GlassKey) {
		return {
			glassRoughness,
			glassTransmission,
			glassClearcoat,
			glassClearcoatRoughness,
			glassReflectivity,
			environmentIntensity,
			exposure,
			bloomStrength,
			bloomRadius,
			bloomThreshold,
		}[key];
	}

	function setGlassValue(key: GlassKey, event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (key === "glassRoughness") glassRoughness = value;
		else if (key === "glassTransmission") glassTransmission = value;
		else if (key === "glassClearcoat") glassClearcoat = value;
		else if (key === "glassClearcoatRoughness") glassClearcoatRoughness = value;
		else if (key === "glassReflectivity") glassReflectivity = value;
		else if (key === "environmentIntensity") environmentIntensity = value;
		else if (key === "exposure") exposure = value;
		else if (key === "bloomStrength") bloomStrength = value;
		else if (key === "bloomRadius") bloomRadius = value;
		else bloomThreshold = value;
	}

	function loadHdri() {
		hdriPath = hdriFile ? `/hdri/${encodeURIComponent(hdriFile)}` : null;
	}

	async function copyValues() {
		await navigator.clipboard.writeText(
			JSON.stringify(radiansObject(), null, 2),
		);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}
</script>

<svelte:head>
	<title>proto/cd-case</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="min-h-screen bg-bg px-6 py-10 transition-colors sm:px-10 sm:py-16"
	class:proto-light={lightBackground}
>
	<div class="mx-auto max-w-7xl">
		<div class="flex flex-wrap items-baseline justify-between gap-3">
			<h1 class="font-mono text-sm text-muted">proto/cd-case — testing</h1>
			<a href="/" class="font-mono text-xs text-ember">back home</a>
		</div>

		<!-- preview left, dials right: the case stays pinned in view while the
		     control column scrolls, so you can watch a slider take effect -->
		<div class="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
			<div
				class="relative overflow-hidden rounded border border-line bg-black/10 lg:sticky lg:top-8"
			>
				<!-- the payoff: open a case and its details arrive beside it. The case
				     itself is parked left by presentX, so this is filling a gap that
				     the 3D scene deliberately left, not covering the artwork. -->
				{#if opened}
					<!-- the panel has to stay legible over BOTH environments: the dark
					     lightbox and a blown-out white studio. A scrim carries it. -->
					<div
						class="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-1/2 flex-col justify-center gap-3 bg-linear-to-l from-black/70 via-black/40 to-transparent p-8 text-white sm:p-12"
					>
						<p
							class="font-mono text-[0.65rem] tracking-widest text-white/60 uppercase"
						>
							Now showing
						</p>
						<h2 class="text-2xl leading-tight font-semibold sm:text-3xl">
							{selectedAlbum.title}
						</h2>
						<p class="font-mono text-sm text-white/70">
							{selectedAlbum.artist ?? "Unknown artist"}
						</p>
						<p class="max-w-xs text-sm leading-relaxed text-white/60">
							{selectedAlbum.note ?? "Selected from the album collection."}
						</p>
					</div>
				{/if}
				{#if CdCasePreview}
					<CdCasePreview
						album={selectedAlbum}
						{caseModel}
						{discStyle}
						{yaw}
						{pitch}
						{roll}
						openAngle={open.angle}
						presentYaw={open.yaw}
						presentPitch={open.pitch}
						presentRoll={open.roll}
						presentScale={open.scale}
						presentX={open.x}
						presentY={open.y}
						onopenchange={(v) => (opened = v)}
						{hdriPath}
						{hdriRotation}
						{backgroundIntensity}
						{backgroundBlurriness}
						{showBackground}
						{lightboxEnabled}
						{showRig}
						keyIntensity={light.keyIntensity}
						softboxScale={light.softboxScale}
						fillIntensity={light.fillIntensity}
						rimIntensity={light.rimIntensity}
						stripCount={light.stripCount}
						stripIntensity={light.stripIntensity}
						stripWidth={light.stripWidth}
						stripLength={light.stripLength}
						stripSpacing={light.stripSpacing}
						stripHeight={light.stripHeight}
						stripDistance={light.stripDistance}
						stripSpecular={light.stripSpecular}
						discRoughness={light.discRoughness}
						{glassRoughness}
						{glassTransmission}
						{glassClearcoat}
						{glassClearcoatRoughness}
						{glassReflectivity}
						{environmentIntensity}
						{exposure}
						{bloomStrength}
						{bloomRadius}
						{bloomThreshold}
					/>
				{:else}
					<div class="h-[min(70vh,36rem)] min-h-104"></div>
				{/if}
			</div>

			<section class="min-w-0">
				<!-- environment first: which light you are in decides everything below -->
				<div class="mb-8 border-b border-line pb-6">
					<label class="mb-6 block font-mono text-xs">
						<span class="mb-2 block text-muted">album cover</span>
						<select
							bind:value={selectedAlbumId}
							class="w-full rounded border border-line bg-surface px-2 py-2 text-fg"
						>
							{#each data.albums as album (album.id)}
								<option value={album.id}>
									{album.title}{album.artist ? ` — ${album.artist}` : ""}
								</option>
							{/each}
						</select>
					</label>
					<fieldset class="mb-6">
						<legend class="mb-2 font-mono text-xs text-muted">
							jewel case model
						</legend>
						<div class="grid grid-cols-2 gap-2">
							{#each JEWEL_CASE_MODELS as model (model.value)}
								<button
									type="button"
									class="rounded border px-3 py-2 font-mono text-xs transition-colors {caseModel ===
									model.value
										? 'border-ember text-ember'
										: 'border-line text-fg hover:border-ember hover:text-ember'}"
									aria-pressed={caseModel === model.value}
									onclick={() => (caseModel = model.value)}
								>
									{model.label}
								</button>
							{/each}
						</div>
						<p class="mt-2 font-mono text-[0.65rem] leading-relaxed text-muted">
							{JEWEL_CASE_MODELS.find((model) => model.value === caseModel)
								?.description}
						</p>
					</fieldset>
					<fieldset class="mb-6">
						<legend class="mb-2 font-mono text-xs text-muted">
							disc face
						</legend>
						<div class="grid grid-cols-2 gap-2">
							{#each DISC_STYLES as style (style.value)}
								<button
									type="button"
									class="rounded border px-3 py-2 font-mono text-xs transition-colors {discStyle ===
									style.value
										? 'border-ember text-ember'
										: 'border-line text-fg hover:border-ember hover:text-ember'}"
									aria-pressed={discStyle === style.value}
									onclick={() => (discStyle = style.value)}
								>
									{style.label}
								</button>
							{/each}
						</div>
						<p class="mt-2 font-mono text-[0.65rem] leading-relaxed text-muted">
							{DISC_STYLES.find((style) => style.value === discStyle)?.hint}
						</p>
					</fieldset>
					<label class="mb-3 block font-mono text-xs">
						<span class="mb-2 block text-muted">HDRI file</span>
						<select
							bind:value={hdriFile}
							onchange={loadHdri}
							class="w-full rounded border border-line bg-surface px-2 py-1 text-fg"
						>
							<option value="">built-in lightbox</option>
							{#each data.hdris as file (file)}
								<option value={file}>{file}</option>
							{/each}
						</select>
						<span class="mt-1 block text-[0.65rem] leading-relaxed text-muted">
							Drop .hdr, .exr, or .jpg files in static/hdri; they appear here
							automatically. An HDRI always lights the case — the toggle only
							decides whether you also SEE it behind the case.
						</span>
					</label>
					<label class="mb-3 block font-mono text-xs">
						<span class="mb-2 flex justify-between gap-3 text-muted">
							<span>HDRI yaw</span>
							<span class="whitespace-nowrap text-fg">
								{hdriRotation.toFixed(2)} / {degrees(hdriRotation)}°
							</span>
						</span>
						<input
							type="range"
							min="-3.14"
							max="3.14"
							step="0.01"
							bind:value={hdriRotation}
							class="w-full accent-ember"
						/>
						<span class="mt-1 block text-[0.65rem] leading-relaxed text-muted">
							Offsets the room around the case; inspection then rotates the case
							and room together like a camera orbit.
						</span>
					</label>
					<div class="mb-3 grid grid-cols-2 gap-4">
						<label class="block font-mono text-xs">
							<span class="mb-2 flex justify-between gap-2 text-muted">
								<span>backdrop light</span>
								<span class="text-fg">{backgroundIntensity.toFixed(2)}</span>
							</span>
							<input
								type="range"
								min="0"
								max="2"
								step="0.01"
								bind:value={backgroundIntensity}
								class="w-full accent-ember"
							/>
						</label>
						<label class="block font-mono text-xs">
							<span class="mb-2 flex justify-between gap-2 text-muted">
								<span>backdrop blur</span>
								<span class="text-fg">{backgroundBlurriness.toFixed(2)}</span>
							</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.01"
								bind:value={backgroundBlurriness}
								class="w-full accent-ember"
							/>
						</label>
					</div>
					<button
						class="w-full rounded border px-3 py-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 {showBackground
							? 'border-ember text-ember'
							: 'border-line text-fg hover:border-ember hover:text-ember'}"
						aria-pressed={showBackground}
						disabled={!hdriPath}
						onclick={() => (showBackground = !showBackground)}
					>
						{showBackground ? "hide HDRI backdrop" : "show HDRI backdrop"}
					</button>
					{#if !hdriPath}
						<span class="mt-2 block font-mono text-[0.65rem] text-muted">
							pick an HDRI above to enable the backdrop
						</span>
					{/if}
					<button
						class="mt-2 w-full rounded border px-3 py-2 font-mono text-xs transition-colors {showRig
							? 'border-ember text-ember'
							: 'border-line text-fg hover:border-ember hover:text-ember'}"
						aria-pressed={showRig}
						onclick={() => (showRig = !showRig)}
					>
						{showRig ? "hide lightbox rig" : "show lightbox rig"}
					</button>
					<button
						class="mt-2 w-full rounded border px-3 py-2 font-mono text-xs transition-colors {lightboxEnabled
							? 'border-ember text-ember'
							: 'border-line text-fg hover:border-ember hover:text-ember'}"
						aria-pressed={lightboxEnabled}
						onclick={() => (lightboxEnabled = !lightboxEnabled)}
					>
						{lightboxEnabled
							? "disable lightbox lighting"
							: "enable lightbox lighting"}
					</button>
					<span
						class="mt-2 block font-mono text-[0.65rem] leading-relaxed text-muted"
					>
						Renders the built-in rig as a real studio — grey cove plus the
						emitters themselves, which bloom. Independent of the HDRI.
					</span>
				</div>

				<div>
					<div class="grid gap-x-6 gap-y-6 sm:grid-cols-3">
						{#each controls as control (control.key)}
							{@const value = valueFor(control.key)}
							<label class="block font-mono text-xs">
								<span class="mb-2 block text-muted">
									<span class="block">{control.label}</span>
									<span class="mt-1 block whitespace-nowrap text-fg"
										>{value.toFixed(2)} rad / {degrees(value)}°</span
									>
								</span>
								<input
									type="range"
									min={control.min}
									max={control.max}
									step={control.step}
									{value}
									oninput={(event) => setValue(control.key, event)}
									class="w-full accent-ember"
								/>
								<input
									type="number"
									min={control.min}
									max={control.max}
									step={control.step}
									{value}
									oninput={(event) => setValue(control.key, event)}
									class="mt-2 w-full rounded border border-line bg-surface px-2 py-1 text-fg"
								/>
							</label>
						{/each}
					</div>

					<div class="mt-10 border-t border-line pt-5">
						<h2 class="font-mono text-xs text-muted">
							open / present
							<span class="ml-2 text-[0.65rem] normal-case"
								>(click the case to see these)</span
							>
						</h2>
						<div class="mt-5 grid gap-x-6 gap-y-6 sm:grid-cols-2">
							{#each openControls as control (control.key)}
								{@const value = open[control.key]}
								<label class="block font-mono text-xs">
									<span class="mb-2 flex justify-between gap-3 text-muted">
										<span>{control.label}</span>
										<span class="whitespace-nowrap text-fg">
											{#if control.unit === "rad"}
												{value.toFixed(2)} / {degrees(value)}°
											{:else if control.unit === "mult"}
												×{(1 + value).toFixed(2)}
											{:else}
												{value.toFixed(2)}
											{/if}
										</span>
									</span>
									<input
										type="range"
										min={control.min}
										max={control.max}
										step={control.step}
										{value}
										oninput={(event) => setOpenValue(control.key, event)}
										class="w-full accent-ember"
									/>
								</label>
							{/each}
						</div>
					</div>

					<div class="mt-10 border-t border-line pt-5">
						<h2 class="font-mono text-xs text-muted">
							lightbox rig
							<span class="ml-2 text-[0.65rem] normal-case"
								>(built-in environment; ignored while an HDRI is loaded)</span
							>
						</h2>
						<div class="mt-5 grid gap-x-6 gap-y-6 sm:grid-cols-2">
							{#each lightControls as control (control.key)}
								{@const value = light[control.key]}
								<label class="block font-mono text-xs">
									<span class="mb-2 flex justify-between gap-3 text-muted">
										<span>{control.label}</span>
										<span class="whitespace-nowrap text-fg">{value}</span>
									</span>
									<input
										type="range"
										min={control.min}
										max={control.max}
										step={control.step}
										{value}
										oninput={(event) => setLightValue(control.key, event)}
										class="w-full accent-ember"
									/>
								</label>
							{/each}
						</div>
					</div>

					<div class="mt-10 border-t border-line pt-5">
						<h2 class="font-mono text-xs text-muted">glass / lighting</h2>
						<div class="mt-5 grid gap-x-6 gap-y-6 sm:grid-cols-2">
							{#each glassControls as control (control.key)}
								{@const value = glassValue(control.key)}
								<label class="block font-mono text-xs">
									<span class="mb-2 flex justify-between gap-3 text-muted">
										<span>{control.label}</span>
										<span class="whitespace-nowrap text-fg"
											>{value.toFixed(3)}</span
										>
									</span>
									<input
										type="range"
										min={control.min}
										max={control.max}
										step={control.step}
										{value}
										oninput={(event) => setGlassValue(control.key, event)}
										class="w-full accent-ember"
									/>
								</label>
							{/each}
						</div>
					</div>
				</div>

				<div class="mt-10 border-t border-line pt-5">
					<button
						class="w-full rounded border border-line px-3 py-2 font-mono text-xs text-fg transition-colors hover:border-ember hover:text-ember"
						aria-pressed={lightBackground}
						onclick={() => (lightBackground = !lightBackground)}
					>
						{lightBackground ? "use green background" : "use light background"}
					</button>
					<button
						class="mt-2 w-full rounded border border-ember px-3 py-2 font-mono text-xs text-ember transition-colors hover:bg-ember hover:text-bg"
						onclick={copyValues}
					>
						{copied ? "copied" : "copy values"}
					</button>
					<pre
						class="mt-3 rounded border border-line bg-surface p-3 font-mono text-xs leading-relaxed text-fg">{JSON.stringify(
							radiansObject(),
							null,
							2,
						)}</pre>
				</div>
			</section>
		</div>
	</div>
</main>

<style>
	.proto-light {
		background-color: #eef1ed;
	}

	.proto-light :global(.text-muted) {
		color: #536257;
	}

	.proto-light :global(.text-fg) {
		color: #26352b;
	}

	.proto-light :global(.text-ember) {
		color: #9a5b28;
	}

	.proto-light :global(.border-line) {
		border-color: #cbd4cc;
	}

	.proto-light :global(.bg-surface) {
		background-color: #e2e8e2;
	}
</style>
