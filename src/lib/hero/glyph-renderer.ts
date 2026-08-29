import { buildGlyphAtlas, DEFAULT_CHARSET } from "./glyph-atlas";
import type { GlyphParams } from "./glyph-params";
import { glyphFragmentShader, glyphVertexShader } from "./glyph-shaders";
import type { HeroPair } from "./pairs";

export interface GlyphRendererOptions {
	pair: HeroPair;
	params: GlyphParams;
	charset?: string;
	onready?: () => void;
	onContextLost?: () => void;
	onTiltStatus?: (status: TiltStatus) => void;
}

export type TiltStatus =
	"needs-permission" | "listening" | "active" | "denied" | "unavailable";

export interface GlyphRenderer {
	setParams(p: GlyphParams): void;
	setCharset(charset: string): Promise<void>;
	destroy(): void;
}

const MAX_DPR = 1.75;
const BLUE_NOISE_URL = "/hero/bluenoise64.png";

function compile(
	gl: WebGL2RenderingContext,
	type: number,
	src: string,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("shader allocation failed");
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) ?? "unknown";
		gl.deleteShader(shader);
		throw new Error(`shader compile failed: ${log}`);
	}
	return shader;
}

function hexToVec3(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.replace("#", ""), 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
	return createImageBitmap(await res.blob());
}

export async function createGlyphRenderer(
	canvas: HTMLCanvasElement,
	opts: GlyphRendererOptions,
): Promise<GlyphRenderer> {
	const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
	if (!gl) throw new Error("webgl2 unavailable");

	let params = opts.params;
	let destroyed = false;

	// program -----------------------------------------------------------
	const program = gl.createProgram();
	if (!program) throw new Error("program allocation failed");
	gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, glyphVertexShader));
	gl.attachShader(
		program,
		compile(gl, gl.FRAGMENT_SHADER, glyphFragmentShader),
	);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(
			`program link failed: ${gl.getProgramInfoLog(program) ?? "unknown"}`,
		);
	}
	gl.useProgram(program);

	const u = (name: string) => gl.getUniformLocation(program, name);
	const loc = {
		photo: u("uPhoto"),
		depth: u("uDepth"),
		glyphs: u("uGlyphs"),
		blueNoise: u("uBlueNoise"),
		resolution: u("uResolution"),
		uvScale: u("uUvScale"),
		uvOffset: u("uUvOffset"),
		time: u("uTime"),
		pointer: u("uPointer"),
		cursorPx: u("uCursorPx"),
		cellSize: u("uCellSize"),
		ditherBlend: u("uDitherBlend"),
		contrast: u("uContrast"),
		gamma: u("uGamma"),
		flowScale: u("uFlowScale"),
		flowSpeed: u("uFlowSpeed"),
		parallax: u("uParallax"),
		cursorRadius: u("uCursorRadius"),
		cursorStrength: u("uCursorStrength"),
		baseTint: u("uBaseTint"),
		cursorReveal: u("uCursorReveal"),
		sparkAmount: u("uSparkAmount"),
		paper: u("uPaper"),
		ink: u("uInk"),
		glyphCount: u("uGlyphCount"),
	};

	// full-screen triangle ------------------------------------------------
	const vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	const vbo = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 3, -1, -1, 3]),
		gl.STATIC_DRAW,
	);
	const aPosition = gl.getAttribLocation(program, "aPosition");
	gl.enableVertexAttribArray(aPosition);
	gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

	// textures --------------------------------------------------------------
	const makeTexture = (unit: number, wrap: number): WebGLTexture => {
		const tex = gl.createTexture();
		if (!tex) throw new Error("texture allocation failed");
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
		return tex;
	};

	const upload = (
		unit: number,
		tex: WebGLTexture,
		source: TexImageSource,
	): void => {
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
	};

	const photoTex = makeTexture(0, gl.CLAMP_TO_EDGE);
	const depthTex = makeTexture(1, gl.CLAMP_TO_EDGE);
	const glyphTex = makeTexture(2, gl.CLAMP_TO_EDGE);
	const noiseTex = makeTexture(3, gl.REPEAT);

	let glyphCount = 1;
	const uploadAtlas = async (charset: string): Promise<void> => {
		const atlas = await buildGlyphAtlas(charset);
		if (destroyed) return;
		upload(2, glyphTex, atlas.canvas);
		glyphCount = atlas.count;
	};

	const [photo, depth, noise] = await Promise.all([
		loadBitmap(opts.pair.photo),
		loadBitmap(opts.pair.depth),
		loadBitmap(BLUE_NOISE_URL),
		uploadAtlas(opts.charset ?? DEFAULT_CHARSET),
	]);
	if (destroyed) throw new Error("destroyed during load");
	upload(0, photoTex, photo);
	upload(1, depthTex, depth);
	upload(3, noiseTex, noise);

	gl.uniform1i(loc.photo, 0);
	gl.uniform1i(loc.depth, 1);
	gl.uniform1i(loc.glyphs, 2);
	gl.uniform1i(loc.blueNoise, 3);

	// sizing ------------------------------------------------------------
	const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
	const mobileInput =
		window.matchMedia("(max-width: 639px)").matches ||
		window.matchMedia("(pointer: coarse)").matches ||
		navigator.maxTouchPoints > 0;
	const glyphScale = mobileInput ? 0.8 : 1;
	let uvScale: [number, number] = [1, 1];
	let uvOffset: [number, number] = [0, 0];

	const resize = (): void => {
		const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
		const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		gl.viewport(0, 0, w, h);
		// object-fit: cover — visible fraction of the photo
		const canvasAspect = w / h;
		const photoAspect = opts.pair.aspect;
		if (canvasAspect > photoAspect) {
			uvScale = [1, photoAspect / canvasAspect];
			uvOffset = [
				0,
				Math.min(
					1 - uvScale[1],
					Math.max(0, opts.pair.focus[1] - uvScale[1] / 2),
				),
			];
		} else {
			uvScale = [canvasAspect / photoAspect, 1];
			uvOffset = [
				Math.min(
					1 - uvScale[0],
					Math.max(0, opts.pair.focus[0] - uvScale[0] / 2),
				),
				0,
			];
		}
	};
	resize();
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);

	// pointer ----------------------------------------------------------
	const target = { x: 0, y: 0, px: -9999, py: -9999 };
	const eased = { x: 0, y: 0 };
	const onPointerMove = (e: PointerEvent): void => {
		target.x = (e.clientX / window.innerWidth) * 2 - 1;
		target.y = -((e.clientY / window.innerHeight) * 2 - 1);
		if (e.pointerType === "touch") {
			target.px = -9999;
			target.py = -9999;
			return;
		}
		const rect = canvas.getBoundingClientRect();
		target.px = (e.clientX - rect.left) * dpr;
		target.py = (rect.height - (e.clientY - rect.top)) * dpr;
	};
	window.addEventListener("pointermove", onPointerMove, { passive: true });

	const onPointerOut = (e: PointerEvent): void => {
		if (e.relatedTarget) return;
		target.px = -9999;
		target.py = -9999;
	};
	window.addEventListener("pointerout", onPointerOut, { passive: true });

	// Mobile parallax follows device tilt, calibrated from the pose in which
	// the page was opened. Touch dragging remains a fallback.
	let neutralBeta: number | null = null;
	let neutralGamma: number | null = null;
	let neutralMotionX: number | null = null;
	let neutralMotionY: number | null = null;
	let sensorsEnabled = false;
	let orientationSeen = false;
	let sensorSeen = false;
	let sensorTimer: ReturnType<typeof setTimeout> | undefined;
	const clampTilt = (value: number): number => Math.max(-1, Math.min(1, value));
	const markSensorActive = (): void => {
		if (sensorSeen) return;
		sensorSeen = true;
		clearTimeout(sensorTimer);
		opts.onTiltStatus?.("active");
	};
	const resetOrientation = (): void => {
		neutralBeta = null;
		neutralGamma = null;
		neutralMotionX = null;
		neutralMotionY = null;
	};
	const onDeviceOrientation = (e: DeviceOrientationEvent): void => {
		if (e.beta === null || e.gamma === null) return;
		orientationSeen = true;
		markSensorActive();
		if (neutralBeta === null || neutralGamma === null) {
			neutralBeta = e.beta;
			neutralGamma = e.gamma;
			return;
		}

		let x = (e.gamma - neutralGamma) / 15;
		let y = -(e.beta - neutralBeta) / 15;
		const angle = screen.orientation?.angle ?? 0;
		if (angle === 90) [x, y] = [-y, x];
		else if (angle === 270 || angle === -90) [x, y] = [y, -x];
		target.x = clampTilt(x);
		target.y = clampTilt(y);
		target.px = -9999;
		target.py = -9999;
	};
	const onDeviceMotion = (e: DeviceMotionEvent): void => {
		// Orientation has cleaner axes when both sources are available.
		if (orientationSeen) return;
		const gravity = e.accelerationIncludingGravity;
		if (gravity?.x === null || gravity?.y === null || !gravity) return;
		markSensorActive();
		if (neutralMotionX === null || neutralMotionY === null) {
			neutralMotionX = gravity.x;
			neutralMotionY = gravity.y;
			return;
		}

		let x = (gravity.x - neutralMotionX) / 2.5;
		let y = -(gravity.y - neutralMotionY) / 2.5;
		const angle = screen.orientation?.angle ?? 0;
		if (angle === 90) [x, y] = [-y, x];
		else if (angle === 270 || angle === -90) [x, y] = [y, -x];
		target.x = clampTilt(x);
		target.y = clampTilt(y);
		target.px = -9999;
		target.py = -9999;
	};
	const enableSensors = (): void => {
		if (sensorsEnabled) return;
		sensorsEnabled = true;
		opts.onTiltStatus?.("listening");
		if (orientationApi) {
			window.addEventListener("deviceorientation", onDeviceOrientation, {
				passive: true,
			});
		}
		if (motionApi) {
			window.addEventListener("devicemotion", onDeviceMotion, {
				passive: true,
			});
		}
		window.addEventListener("orientationchange", resetOrientation, {
			passive: true,
		});
		sensorTimer = setTimeout(() => {
			if (!sensorSeen) opts.onTiltStatus?.("unavailable");
		}, 2500);
	};
	type OrientationPermission = typeof DeviceOrientationEvent & {
		requestPermission?: () => Promise<"granted" | "denied">;
	};
	const orientationApi =
		typeof DeviceOrientationEvent === "undefined"
			? null
			: (DeviceOrientationEvent as OrientationPermission);
	type MotionPermission = typeof DeviceMotionEvent & {
		requestPermission?: () => Promise<"granted" | "denied">;
	};
	const motionApi =
		typeof DeviceMotionEvent === "undefined"
			? null
			: (DeviceMotionEvent as MotionPermission);
	const requestSensors = async (): Promise<void> => {
		try {
			// Invoke both permission methods synchronously inside the click gesture;
			// awaiting one before calling the other loses user activation on iOS.
			const requests: Promise<"granted" | "denied">[] = [];
			if (typeof orientationApi?.requestPermission === "function") {
				requests.push(orientationApi.requestPermission());
			}
			if (typeof motionApi?.requestPermission === "function") {
				requests.push(motionApi.requestPermission());
			}
			const permissions = await Promise.all(requests);
			if (permissions.some((permission) => permission === "granted")) {
				enableSensors();
			} else {
				opts.onTiltStatus?.("denied");
			}
		} catch {
			opts.onTiltStatus?.("denied");
		}
	};
	if (mobileInput && (orientationApi || motionApi)) {
		const needsPermission =
			typeof orientationApi?.requestPermission === "function" ||
			typeof motionApi?.requestPermission === "function";
		if (needsPermission) {
			opts.onTiltStatus?.("needs-permission");
			window.addEventListener("hero-request-tilt", requestSensors);
		} else {
			enableSensors();
		}
	} else if (mobileInput) {
		opts.onTiltStatus?.("unavailable");
	}

	// context loss --------------------------------------------------------
	const onContextLost = (e: Event): void => {
		e.preventDefault();
		stop();
		opts.onContextLost?.();
	};
	canvas.addEventListener("webglcontextlost", onContextLost);

	// frame loop --------------------------------------------------------
	let raf = 0;
	let time = 0;
	let last = performance.now();
	let readyFired = false;

	const frame = (now: number): void => {
		const dt = Math.min((now - last) / 1000, 0.1);
		last = now;
		time += dt;

		const k = 1 - Math.exp(-params.damp * dt);
		eased.x += (target.x - eased.x) * k;
		eased.y += (target.y - eased.y) * k;

		gl.uniform2f(loc.resolution, canvas.width, canvas.height);
		gl.uniform2f(loc.uvScale, uvScale[0], uvScale[1]);
		gl.uniform2f(loc.uvOffset, uvOffset[0], uvOffset[1]);
		gl.uniform1f(loc.time, time);
		gl.uniform2f(loc.pointer, eased.x, eased.y);
		gl.uniform2f(loc.cursorPx, target.px, target.py);
		gl.uniform1f(loc.cellSize, Math.max(2, params.cellSize * glyphScale) * dpr);
		gl.uniform1f(loc.ditherBlend, params.ditherBlend);
		gl.uniform1f(loc.contrast, params.contrast);
		gl.uniform1f(loc.gamma, params.gamma);
		gl.uniform1f(loc.flowScale, params.flowScale);
		gl.uniform1f(loc.flowSpeed, params.flowSpeed);
		gl.uniform1f(loc.parallax, params.parallax);
		gl.uniform1f(loc.cursorRadius, params.cursorRadius * dpr);
		gl.uniform1f(loc.cursorStrength, params.cursorStrength);
		gl.uniform1f(loc.baseTint, params.baseTint);
		gl.uniform1f(loc.cursorReveal, params.cursorReveal);
		gl.uniform1f(loc.sparkAmount, params.sparkAmount);
		gl.uniform3f(loc.paper, ...hexToVec3(params.paper));
		gl.uniform3f(loc.ink, ...hexToVec3(params.ink));
		gl.uniform1f(loc.glyphCount, glyphCount);

		gl.drawArrays(gl.TRIANGLES, 0, 3);

		if (!readyFired) {
			readyFired = true;
			opts.onready?.();
		}
		raf = requestAnimationFrame(frame);
	};

	// The loop only earns its cost while the hero is actually on screen: scrolled
	// past, or in a background tab, it is pure GPU burn behind whatever the
	// visitor is looking at. Resuming rebases `last` so the flow time and eased
	// pointer continue from where they stopped rather than jumping forward by
	// however long the pause lasted.
	let onScreen = true;
	const start = (): void => {
		if (raf !== 0 || destroyed) return;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	};
	const stop = (): void => {
		if (raf === 0) return;
		cancelAnimationFrame(raf);
		raf = 0;
	};
	const sync = (): void => {
		if (onScreen && !document.hidden) start();
		else stop();
	};
	const visibility = new IntersectionObserver((entries) => {
		onScreen = entries[entries.length - 1].isIntersecting;
		sync();
	});
	visibility.observe(canvas);
	document.addEventListener("visibilitychange", sync);
	sync();

	return {
		setParams(p: GlyphParams): void {
			params = p;
		},
		async setCharset(charset: string): Promise<void> {
			await uploadAtlas(charset);
		},
		destroy(): void {
			destroyed = true;
			stop();
			clearTimeout(sensorTimer);
			observer.disconnect();
			visibility.disconnect();
			document.removeEventListener("visibilitychange", sync);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerout", onPointerOut);
			window.removeEventListener("hero-request-tilt", requestSensors);
			window.removeEventListener("deviceorientation", onDeviceOrientation);
			window.removeEventListener("devicemotion", onDeviceMotion);
			window.removeEventListener("orientationchange", resetOrientation);
			canvas.removeEventListener("webglcontextlost", onContextLost);
			gl.deleteProgram(program);
			gl.deleteBuffer(vbo);
			gl.deleteVertexArray(vao);
			for (const tex of [photoTex, depthTex, glyphTex, noiseTex]) {
				gl.deleteTexture(tex);
			}
			gl.getExtension("WEBGL_lose_context")?.loseContext();
		},
	};
}
