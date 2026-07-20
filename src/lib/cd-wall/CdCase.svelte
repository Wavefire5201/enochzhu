<script lang="ts">
	import { T, useTask } from "@threlte/core";
	import { onDestroy } from "svelte";
	import type { BufferGeometry, Group, Material, Mesh } from "three";
	import {
		BackSide,
		Color,
		DoubleSide,
		MeshBasicMaterial,
		MeshPhysicalMaterial,
		type Texture,
		CanvasTexture,
	} from "three";
	import type { CdAlbum } from "./albums";
	import { albumIndexAt, slotForMesh, slotX, windowStart } from "./layout";
	import type { WallScroll } from "./scroll";
	import type { CoverCache } from "./textures";
	import type { VideoCache } from "./video-textures";
	import type { DiscStyle, DitherDiscOptions } from "./disc-art";
	import type { PreviewPlayer } from "./preview-player.svelte";

	interface Props {
		index: number;
		pool: number;
		spacing: number;
		albums: CdAlbum[];
		scroll: WallScroll;
		covers: CoverCache;
		videos: VideoCache;
		caseGeometry: BufferGeometry;
		baseGeometry: BufferGeometry | null;
		cardGeometry: BufferGeometry | null;
		artGeometry: BufferGeometry;
		lidGeometry: BufferGeometry;
		discGeometry: BufferGeometry;
		caseMaterial: Material;
		lidMaterial: Material;
		discMaterial: Material;
		/** a thin print layer used by metadata-forward proto disc styles */
		discPrintMaterial: Material | null;
		discPrintVisible?: boolean;
		caseYaw: number;
		casePitch: number;
		caseRoll: number;
		/** subtle per-slot orientation makes the shared HDRI sweep across the row */
		reactiveLighting?: boolean;
		/** lid swing at full open, in radians (negative swings it off-camera) */
		openAngle: number;
		/** the pose an opened case settles into as it turns to face the viewer */
		presentYaw: number;
		presentPitch: number;
		presentRoll: number;
		/** how much bigger an opened case reads than one resting in the row */
		presentScale: number;
		/** where an opened case settles, so info can sit beside it rather than under */
		presentX: number;
		presentY: number;
		/** rad/sec the disc turns while this case is open (0 = still) */
		discSpin: number;
		/** how far the disc rises toward the viewer as it spins up (world units) */
		discLift?: number;
		caseWidth: number;
		caseDepth: number;
		/** where the disc sits: the tray's hub in x/y, its face height in z */
		discX: number;
		discY: number;
		discZ: number;
		/** z of the art plane and lid offset, from the case origin */
		artZ: number;
		lidZ: number;
		openedSlot: number | null;
		onopen: (slot: number | null) => void;
		onhover: (album: CdAlbum | null, slot?: number) => void;
		/** proto camera-orbit equivalent: keep the HDRI aligned with inspection */
		onrotation?: (x: number, y: number, z: number) => void;
		discStyle?: DiscStyle;
		ditherOptions?: DitherDiscOptions;
		player?: PreviewPlayer;
	}

	const {
		index,
		pool,
		spacing,
		albums,
		scroll,
		covers,
		videos,
		caseGeometry,
		baseGeometry,
		cardGeometry,
		artGeometry,
		lidGeometry,
		discGeometry,
		caseMaterial,
		lidMaterial,
		discMaterial,
		discPrintMaterial,
		discPrintVisible = false,
		caseYaw,
		casePitch,
		caseRoll,
		reactiveLighting = false,
		openAngle,
		presentYaw,
		presentPitch,
		presentRoll,
		presentScale,
		presentX,
		presentY,
		discSpin,
		discLift = 0,
		caseWidth,
		caseDepth,
		discX,
		discY,
		discZ,
		artZ,
		lidZ,
		openedSlot,
		onopen,
		onhover,
		onrotation,
		discStyle = "mirror",
		ditherOptions = undefined,
		player,
	}: Props = $props();

	let outer = $state<Group>();
	let inner = $state<Group>();
	let lidPivot = $state<Group>();
	let discMesh = $state<Mesh>();
	let discPrintMesh = $state<Mesh>();
	let topMesh = $state<Mesh>();
	let bottomMesh = $state<Mesh>();

	// --- 3D sliding text for 1-bit dither ---
	const tCanvas =
		typeof document !== "undefined" ? document.createElement("canvas") : null;
	const bCanvas =
		typeof document !== "undefined" ? document.createElement("canvas") : null;
	if (tCanvas) {
		tCanvas.width = 1024;
		tCanvas.height = 128;
	}
	if (bCanvas) {
		bCanvas.width = 1024;
		bCanvas.height = 128;
	}

	const tTexture = tCanvas ? new CanvasTexture(tCanvas) : null;
	const bTexture = bCanvas ? new CanvasTexture(bCanvas) : null;

	function drawTextToCanvas(
		canvas: HTMLCanvasElement,
		text: string,
		color: string,
	) {
		const ctx = canvas.getContext("2d")!;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = color;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = "bold 46px 'Commit Mono', ui-monospace, monospace";
		ctx.fillText(text, canvas.width / 2, canvas.height / 2);
	}

	function updateTextCanvases() {
		const current = album;
		if (!current || discStyle !== "dither") return;

		let color = "#f5f5f5";
		if (ditherOptions?.colorMode === "green") color = "#8bac0f";
		else if (ditherOptions?.colorMode === "amber") color = "#ffb000";
		else if (ditherOptions?.colorMode === "album") color = current.color;

		if (tCanvas && tTexture) {
			drawTextToCanvas(tCanvas, current.title.toUpperCase(), color);
			tTexture.needsUpdate = true;
		}

		if (bCanvas && bTexture) {
			const subText = [current.artist, current.year]
				.filter(Boolean)
				.join(" · ")
				.toUpperCase();
			drawTextToCanvas(bCanvas, subText, color);
			bTexture.needsUpdate = true;
		}
	}

	$effect(() => {
		discStyle;
		ditherOptions?.colorMode;
		updateTextCanvases();
	});

	// One pooled mesh, endlessly recycled: which slot (and so which album) it
	// shows is derived from the scroll offset every frame (PRD-cd-wall §5.1).
	// Per-frame values stay out of Svelte reactivity on purpose.
	let album: CdAlbum | null = null;
	let slot = Number.NaN;
	let artMix = 0; // 0 = dominant-color placeholder, 1 = full cover art
	let forward = 0; // eased pull toward the viewer while inspecting/open
	let part = 0; // eased sideways step while a neighbor is inspected
	let lidAmount = 0; // 0 = closed, 1 = fully open
	let present = 0; // 0 = sits in the row, 1 = squared up and held to camera
	let discSpinAngle = 0; // accumulates while a case is open — the disc spins up
	let lifeTime = 0; // keeps the surrounding wall quietly alive under focus lock

	// hold-to-inspect: press and hold a case, then drag to turn it 360°
	let inspect = false;
	let spin = 0;
	let spinPitch = 0;
	let lastX = 0;
	let lastY = 0;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;

	// Keep the color-authored booklet neutral and unlit. Direct studio lights
	// must not wash its pixels into a broad glow; the separate transmissive lid
	// is solely responsible for the visible reflections.
	const placeholderColor = new Color("#1d211f");
	const litColor = new Color("#ffffff");
	const PAPER = new Color("#d9d6cf");
	const coverMaterial = new MeshBasicMaterial({
		color: placeholderColor.clone(),
		toneMapped: true,
	});

	function assign(next: CdAlbum) {
		album = next;
		artMix = 0;
		placeholderColor.set(next.color);
		// the inlay reads as paper first, album second: mostly card, lightly cast
		bookletBackMaterial.color.set(next.color).lerp(PAPER, 0.8);
		cardMaterial.color.copy(bookletBackMaterial.color);
		setCoverMap(covers.get(next));
		if (!coverMaterial.map) {
			covers
				.ready(next)
				.then((texture) => {
					// this mesh may have been recycled again while loading
					if (album !== next) return;
					setCoverMap(texture);
				})
				.catch(() => {
					// failed cover: the placeholder color simply stays
				});
		}
		updateTextCanvases();
	}

	// The booklet's back page: matte printed card, not glossy art. It carries a
	// washed-out cast of the album's dominant colour the way a real inlay picks
	// up its cover's palette, and it never takes the cover texture.
	const bookletBackMaterial = new MeshPhysicalMaterial({
		color: "#d9d6cf",
		roughness: 0.85,
		metalness: 0,
		clearcoat: 0,
		envMapIntensity: 0.6,
		side: BackSide,
	});

	// The tray card wraps behind the tray as a thin shell, so it is seen from
	// both sides: through the tray's cutouts from the front and through the
	// clear back panel from behind.
	const cardMaterial = new MeshPhysicalMaterial({
		color: "#d9d6cf",
		roughness: 0.85,
		metalness: 0,
		clearcoat: 0,
		envMapIntensity: 0.6,
		side: DoubleSide,
	});

	function setCoverMap(texture: Texture | null) {
		coverMaterial.map = texture;
		// swapping a map in or out changes the shader's defines
		coverMaterial.needsUpdate = true;
	}

	useTask((delta) => {
		if (!outer || !inner || !lidPivot) return;
		lifeTime += delta;
		const j = slotForMesh(
			index,
			pool,
			windowStart(scroll.offset, spacing, pool),
		);
		if (j !== slot) {
			slot = j;
			assign(albums[albumIndexAt(j, albums.length)]);
		}
		// Animated cover: keep the album's shared video playing while it's on
		// screen and swap the still for it once the first frame is ready (so
		// there's no black flash). The still cover set by assign() stays until then.
		if (album?.video) {
			const videoTexture = videos.get(album);
			videos.keep(album.id);
			if (videoTexture && coverMaterial.map !== videoTexture) {
				coverMaterial.map = videoTexture;
				coverMaterial.needsUpdate = true;
			}
		}
		// Either interaction pushes neighbors aside so the focused case has room:
		// a held case turning 360° needs a little clearance, but an OPENED case is
		// scaled up and squared to camera, so the row parts far wider to give it
		// "a lot of space on either side" and stop anything clipping into it.
		const focusSlot = openedSlot ?? scroll.inspectSlot;
		// an opened case clears the stage: neighbors slide right off toward the
		// faded edges so it stands alone with air on both sides
		const clearance = openedSlot !== null ? 3 : 0.3;
		const partTarget =
			focusSlot !== null && slot !== focusSlot
				? Math.sign(slot - focusSlot) * clearance
				: 0;
		part += (partTarget - part) * Math.min(1, delta * 5);
		// present offset is applied on the OUTER group, so it slides the whole case
		// out of the row rather than fighting the inner pose
		outer.position.x =
			slotX(j, spacing, scroll.offset) + part + present * presentX;
		// The focus lock deliberately freezes horizontal scroll. Keep the other
		// cases breathing a few millimetres in place so the scene still feels like
		// a living installation, not a paused carousel. The focused case itself is
		// left stable for readable disc typography and cursor parallax.
		const ambientLift =
			openedSlot !== null && slot !== openedSlot
				? Math.sin(lifeTime * 0.62 + slot * 1.73) * 0.018
				: 0;
		outer.position.y = present * presentY + ambientLift;

		// placeholder → art crossfade, only once the texture is actually there.
		// The map multiplies the base color, so easing the tint to white lets
		// the art come up to full strength without a second mesh.
		const mixTarget = coverMaterial.map ? 1 : 0;
		artMix += (mixTarget - artMix) * Math.min(1, delta * 6);
		coverMaterial.color.lerpColors(placeholderColor, litColor, artMix);

		// lid hinge: opens to a fully-revealed state. The lid + cover art
		// ride on the lid pivot at the back edge; the disc stays in the
		// tray. Keyed by SLOT: the collection tiles, so keying by album would
		// swing every visible copy open at once.
		const lidTarget = slot === openedSlot ? 1 : 0;
		lidAmount += (lidTarget - lidAmount) * Math.min(1, delta * 5);
		lidPivot.rotation.y = openAngle * lidAmount;

		const forwardTarget = inspect ? 0.9 : lidAmount * 0.4;
		forward += (forwardTarget - forward) * Math.min(1, delta * 8);
		inner.position.z = forward;

		// inspect spin is free; released, it eases home the short way
		if (!inspect) {
			spin += (0 - spin) * Math.min(1, delta * 6);
			spinPitch += (0 - spinPitch) * Math.min(1, delta * 6);
		}

		// PRESENT: opening carries the case out of the row and up to the
		// viewer — it turns from its resting angle to the presented pose and
		// grows. The wall camera is orthographic, so scale remains the canonical
		// push toward the viewer; the single-case lab adds perspective on top.
		// Hand-inspection overrides it, so a spun case keeps the angle you put it at.
		const presentTarget = inspect ? 0 : lidAmount;
		present += (presentTarget - present) * Math.min(1, delta * 5);
		inner.scale.setScalar(1 + present * presentScale);

		// the disc spins up as the case opens — the "cool when you open it" beat.
		// Keyed to `lidAmount` (lid open), NOT `present`, so hand-turning the case
		// (which eases `present` to 0) never freezes the disc — it keeps spinning
		// as long as the lid is up, and coasts to a stop as the case closes.
		discSpinAngle += delta * discSpin * lidAmount;
		// the disc also rises out of the tray toward the viewer as it opens, so it
		// reads as a lifted object, not a texture on a plane; eased by lidAmount.
		const lift = discLift * lidAmount;
		if (discMesh) {
			discMesh.rotation.z = discSpinAngle;
			discMesh.position.z = discZ + lift;
		}
		if (discPrintMesh) {
			discPrintMesh.rotation.z = discSpinAngle;
			discPrintMesh.position.z = discZ + 0.002 + lift;
		}

		if (topMesh) {
			topMesh.position.y = lidAmount * 0.74;
			if (topMesh.material && !Array.isArray(topMesh.material)) {
				topMesh.material.opacity = lidAmount;
			}
		}
		if (bottomMesh) {
			bottomMesh.position.y = -lidAmount * 0.74;
			if (bottomMesh.material && !Array.isArray(bottomMesh.material)) {
				bottomMesh.material.opacity = lidAmount;
			}
		}

		if (player) {
			if (openedSlot !== null) {
				if (slot === openedSlot) {
					player.openAmount = lidAmount;
				}
			} else {
				if (lidAmount > 0.001) {
					player.openAmount = lidAmount;
				} else if (player.openAmount > 0 && Math.abs(lidAmount) < 0.002) {
					player.openAmount = 0;
				}
			}
		}

		// An equirectangular room is infinitely far away: translating a flat case
		// sideways through it cannot change its reflection. Give resting slots a
		// small, stable pose that evolves with the shared scroll offset instead.
		// This changes only the normal seen by the one shared attic environment;
		// it does not create a per-CD scene, light, or material.
		const response = reactiveLighting && !inspect ? 1 - present : 0;
		// Scroll moves highlights quickly; time keeps the off-focus cases moving
		// gently while a focus lock holds scroll.offset perfectly still.
		const phase = slot * 1.618 - scroll.offset * 0.9 + lifeTime * 0.16;
		// The skylights in attic-2k are small in angular terms. A couple of
		// degrees leaves them off the lid entirely; this 8° resting range and
		// 17° scroll range lets their real HDR radiance sweep across each case.
		const sway = (openedSlot !== null ? 0.035 : 0.14) + scroll.energy * 0.16;
		const lightYaw = Math.sin(phase) * sway * response;
		const lightPitch = Math.cos(phase * 1.23) * sway * 0.42 * response;

		// Opening turns the case to the presented pose; a resting case does not
		// react to the pointer.
		inner.rotation.y = lerp(caseYaw, presentYaw, present) + spin + lightYaw;
		inner.rotation.x =
			lerp(casePitch, presentPitch, present) + spinPitch + lightPitch;
		inner.rotation.z = lerp(caseRoll, presentRoll, present);
		onrotation?.(inner.rotation.x, inner.rotation.y, inner.rotation.z);
	});

	function lerp(from: number, to: number, t: number) {
		return from + (to - from) * t;
	}

	// The case no longer magnifies or turns under the pointer; enter/leave only
	// keep the cursor affordance and pause idle drift.
	function enter() {
		scroll.hovering = true;
		if (album) onhover(album, slot);
	}

	function leave() {
		scroll.hovering = false;
		onhover(null);
	}

	function activate() {
		// a fling (or a hold-and-spin) that ends on a case is not a tap
		if (scroll.dragDistance > 8) return;
		if (!album) return;
		// Tapping an already-open case always closes it. External album links live
		// in the focused action orb, so the case itself has one predictable job.
		if (slot === openedSlot) {
			onopen(null);
			return;
		}
		onopen(slot);
	}

	function beginHold(event: { nativeEvent: PointerEvent }) {
		lastX = event.nativeEvent.clientX;
		lastY = event.nativeEvent.clientY;
		clearTimeout(holdTimer);
		holdTimer = setTimeout(() => {
			// if the pointer already moved, the gesture is a row drag, not a hold
			if (scroll.dragDistance > 6 || !album) return;
			inspect = true;
			scroll.inspecting = true;
			scroll.inspectSlot = slot;
			if (player) player.inspecting = true;
			scroll.cancelDrag();
			scroll.dragDistance = 99; // releasing a spun case is not a tap
			window.addEventListener("pointermove", spinMove);
		}, 260);
		window.addEventListener("pointerup", endHold);
		window.addEventListener("pointercancel", endHold);
	}

	function spinMove(event: PointerEvent) {
		spin += (event.clientX - lastX) * 0.012;
		// unclamped on purpose: inspection allows full end-over-end turns
		spinPitch += (event.clientY - lastY) * 0.006;
		lastX = event.clientX;
		lastY = event.clientY;
	}

	function endHold() {
		clearTimeout(holdTimer);
		window.removeEventListener("pointerup", endHold);
		window.removeEventListener("pointercancel", endHold);
		window.removeEventListener("pointermove", spinMove);
		if (!inspect) return;
		inspect = false;
		scroll.inspecting = false;
		scroll.inspectSlot = null;
		if (player) player.inspecting = false;
		// come home the short way, however many full turns were made
		spin = (((spin % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
		// Keep the current release from becoming a tap, but do not strand the
		// proto preview at dragDistance=99: unlike Wall3D, it has no outer
		// pointerdown handler that resets the drag guard on the next gesture.
		setTimeout(() => {
			if (!scroll.dragging && !scroll.inspecting) scroll.dragDistance = 0;
		}, 0);
	}

	onDestroy(() => {
		endHold();
		scroll.inspecting = false;
		scroll.inspectSlot = null;
		coverMaterial.dispose();
		bookletBackMaterial.dispose();
		cardMaterial.dispose();
		tTexture?.dispose();
		bTexture?.dispose();
	});
</script>

<T.Group bind:ref={outer}>
	<T.Group
		bind:ref={inner}
		rotation.y={caseYaw}
		rotation.x={casePitch}
		rotation.z={caseRoll}
		onpointerenter={enter}
		onpointerleave={leave}
		onpointerdown={beginHold}
		onclick={activate}
	>
		<!-- the tray body -->
		<T.Mesh geometry={caseGeometry} material={caseMaterial} />
		<!-- The build script bisected the modeled clear shell at its real lid
		     seam. This back half stays with the tray, already sitting at its
		     assembly position; the front half below rides the hinge. -->
		{#if baseGeometry}
			<T.Mesh geometry={baseGeometry} material={lidMaterial} />
		{/if}
		<!-- the tray card: printed paper wrapped behind the perforated tray.
		     Without it the tray's cutouts expose the clear back panel, whose
		     environment reflections read as grey smudges on the black deck. -->
		{#if cardGeometry}
			<T.Mesh geometry={cardGeometry} material={cardMaterial} />
		{/if}
		<!-- the disc, seated on the tray's hub (right of center — the hinge
		     eats the left edge). Hidden by the booklet when closed; revealed
		     when the lid hinges open and carries the cover away. -->
		<T.Mesh
			bind:ref={discMesh}
			geometry={discGeometry}
			material={discMaterial}
			position.x={discX}
			position.y={discY}
			position.z={discZ}
		/>
		{#if discPrintVisible && discPrintMaterial}
			<!-- The printed label sits a fraction above the reflective substrate.
			     This keeps metadata ink crisp while the physical disc still owns
			     edge glints and the spinning silhouette. -->
			<T.Mesh
				bind:ref={discPrintMesh}
				geometry={discGeometry}
				material={discPrintMaterial}
				position.x={discX}
				position.y={discY}
				position.z={discZ + 0.002}
			/>
		{/if}
		<!-- the lid pivot: hinged at the back edge of the case. The lid +
		     the cover art (booklet) ride on it, so opening the lid carries
		     the cover out of the way to reveal the disc. -->
		<T.Group
			bind:ref={lidPivot}
			position.x={-caseWidth / 2}
			position.z={-caseDepth / 2}
		>
			<T.Mesh
				geometry={artGeometry}
				material={coverMaterial}
				position.x={caseWidth / 2}
				position.z={caseDepth / 2 + artZ}
			/>
			<!-- the booklet's printed reverse. Same plane as the cover, drawn
			     BackSide: exactly one of the two renders for any view direction,
			     so there is no z-fighting and no flipped geometry to realign. -->
			<T.Mesh
				geometry={artGeometry}
				material={bookletBackMaterial}
				position.x={caseWidth / 2}
				position.z={caseDepth / 2 + artZ}
			/>
			<T.Mesh
				geometry={lidGeometry}
				material={lidMaterial}
				position.x={caseWidth / 2}
				position.z={caseDepth / 2 + lidZ}
			/>
		</T.Group>

		{#if tTexture && bTexture}
			<!-- Sliding Top Text (Album Title) -->
			<T.Mesh bind:ref={topMesh} position.z={-0.015}>
				<T.PlaneGeometry args={[1.2, 0.15]} />
				<T.MeshBasicMaterial
					map={tTexture}
					transparent
					opacity={0}
					side={DoubleSide}
					toneMapped
				/>
			</T.Mesh>

			<!-- Sliding Bottom Text (Artist & Year) -->
			<T.Mesh bind:ref={bottomMesh} position.z={-0.015}>
				<T.PlaneGeometry args={[1.2, 0.15]} />
				<T.MeshBasicMaterial
					map={bTexture}
					transparent
					opacity={0}
					side={DoubleSide}
					toneMapped
				/>
			</T.Mesh>
		{/if}
	</T.Group>
</T.Group>
