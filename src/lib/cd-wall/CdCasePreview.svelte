<script lang="ts">
	import { Canvas } from "@threlte/core";
	import { WebGLRenderer } from "three";
	import type { CdAlbum } from "./albums";
	import type { DiscStyle } from "./disc-art";
	import type { JewelCaseModel } from "./models";
	import Scene from "./Scene.svelte";
	import { WallScroll } from "./scroll";

	interface Props {
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
		discSpin: number;
		discIridescence: number;
		discThicknessLo: number;
		discThicknessHi: number;
		discLift: number;
		ondiscanchor?: (x: number, y: number, radius: number) => void;
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
	}

	const {
		album,
		yaw,
		pitch,
		roll,
		openAngle,
		presentYaw,
		presentPitch,
		presentRoll,
		presentScale,
		presentX,
		presentY,
		caseModel,
		discStyle,
		discSpin,
		discIridescence,
		discThicknessLo,
		discThicknessHi,
		discLift,
		ondiscanchor,
		onopenchange,
		hdriPath,
		hdriRotation,
		backgroundIntensity,
		backgroundBlurriness,
		showBackground,
		lightboxEnabled,
		showRig,
		keyIntensity,
		softboxScale,
		fillIntensity,
		rimIntensity,
		stripCount,
		stripIntensity,
		stripWidth,
		stripLength,
		stripSpacing,
		stripHeight,
		stripDistance,
		stripSpecular,
		discRoughness,
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
	}: Props = $props();

	// the proto is a single stationary case: the row never drifts, coasts, or
	// flings here, so angles and glass can be judged against a fixed frame
	const scroll = new WallScroll();
	scroll.autoScrollPaused = true;
	let openedSlot = $state<number | null>(null);
	let openLookX = $state(0);
	let openLookY = $state(0);
	function onopen(slot: number | null) {
		openedSlot = slot;
		onopenchange?.(slot !== null);
		if (slot === null) {
			openLookX = 0;
			openLookY = 0;
		}
	}

	function trackOpenPointer(event: PointerEvent) {
		if (openedSlot === null) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		openLookX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
		openLookY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
	}

	function resetOpenPointer() {
		openLookX = 0;
		openLookY = 0;
	}
	function onhover() {}
	function onfail() {}
</script>

<div
	class="h-[min(70vh,36rem)] min-h-104 w-full"
	role="presentation"
	onpointermove={trackOpenPointer}
	onpointerleave={resetOpenPointer}
>
	<Canvas
		dpr={Math.min(2, window.devicePixelRatio)}
		createRenderer={(canvas) => {
			const renderer = new WebGLRenderer({
				canvas,
				alpha: true,
				antialias: true,
				powerPreference: "high-performance",
				premultipliedAlpha: false,
			});
			renderer.setClearColor(0x000000, 0);
			return renderer;
		}}
	>
		{#key album.id}
			<Scene
				albums={[album]}
				{scroll}
				{openedSlot}
				{onopen}
				{onhover}
				{onfail}
				caseYaw={yaw}
				casePitch={pitch}
				caseRoll={roll}
				{openAngle}
				{presentYaw}
				{presentPitch}
				{presentRoll}
				{presentScale}
				{presentX}
				{presentY}
				{openLookX}
				{openLookY}
				{caseModel}
				{discStyle}
				{discSpin}
				{discIridescence}
				{discThicknessLo}
				{discThicknessHi}
				{discLift}
				{ondiscanchor}
				{hdriPath}
				{hdriRotation}
				{backgroundIntensity}
				{backgroundBlurriness}
				{showBackground}
				{lightboxEnabled}
				{showRig}
				{keyIntensity}
				{softboxScale}
				{fillIntensity}
				{rimIntensity}
				{stripCount}
				{stripIntensity}
				{stripWidth}
				{stripLength}
				{stripSpacing}
				{stripHeight}
				{stripDistance}
				{stripSpecular}
				{discRoughness}
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
				preview
			/>
		{/key}
	</Canvas>
</div>
