/**
 * Glyph-field hero shaders (spec §1).
 *
 * The screen is divided into cells; photo luminance at each cell picks a
 * glyph from a coverage-ordered Commit Mono atlas. FBM flow churns the fog
 * (far field), depth weights cursor parallax (near shifts more), and
 * `uDitherBlend` crossfades to blue-noise dithering of the same duotone.
 */

export const glyphVertexShader = /* glsl */ `#version 300 es
in vec2 aPosition;
void main() {
	gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const glyphFragmentShader = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uPhoto;
uniform sampler2D uDepth;
uniform sampler2D uGlyphs;
uniform sampler2D uBlueNoise;
uniform vec2 uResolution;   // drawing-buffer px
uniform vec2 uUvScale;      // cover-fit mapping, set on resize
uniform vec2 uUvOffset;
uniform float uTime;
uniform vec2 uPointer;      // damped, -1..1
uniform vec2 uCursorPx;     // damped cursor in buffer px, y-up
uniform float uCellSize;    // buffer px
uniform float uDitherBlend;
uniform float uContrast;
uniform float uGamma;
uniform float uFlowScale;
uniform float uFlowSpeed;
uniform float uParallax;
uniform float uCursorRadius;   // buffer px
uniform float uCursorStrength;
uniform float uBaseTint;
uniform float uCursorReveal;
uniform float uSparkAmount;    // ships 0
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uGlyphCount;

out vec4 fragColor;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
		u.y
	);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 3; i++) {
		v += a * vnoise(p);
		p = p * 2.03 + 17.7;
		a *= 0.5;
	}
	return v;
}

void main() {
	vec2 cell = floor(gl_FragCoord.xy / uCellSize);
	vec2 cellCenter = (cell + 0.5) * uCellSize;

	// cover-fit uv of the cell center — the whole cell shares one tone
	vec2 uv = (cellCenter / uResolution) * uUvScale + uUvOffset;
	uv.y = 1.0 - uv.y;

	float depth = texture(uDepth, uv).r;

	// fog flow: strongest in the far field
	float t = uTime * uFlowSpeed;
	vec2 flow = (vec2(
		fbm(uv * uFlowScale + t),
		fbm(uv * uFlowScale + 7.31 - t)
	) - 0.5) * 0.03 * (1.0 - depth);

	// cursor parallax: near shifts more
	vec2 par = uPointer * uParallax * depth;

	// cursor falloff: used for glyph jitter and for the photo-reveal lens
	float cdist = distance(gl_FragCoord.xy, uCursorPx);
	float falloff = 1.0 - smoothstep(0.0, uCursorRadius, cdist);
	float cursor = falloff * uCursorStrength;

	vec2 suv = clamp(uv + flow + par, 0.001, 0.999);
	vec3 rgb = texture(uPhoto, suv).rgb;
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	float tone = pow(clamp((lum - 0.5) * uContrast + 0.5, 0.0, 1.0), uGamma);
	tone = clamp(tone + cursor * (hash(cell + floor(uTime * 8.0)) - 0.35) * 0.6, 0.0, 1.0);

	// glyph branch
	float idx = floor(tone * (uGlyphCount - 1.0) + 0.5);
	vec2 inCell = fract(gl_FragCoord.xy / uCellSize);
	inCell.y = 1.0 - inCell.y;
	// coverage already encodes tone; only a mild brightness ramp on top,
	// else dark regions double-attenuate and the fog reads muddy
	float mask = texture(uGlyphs, vec2((idx + inCell.x) / uGlyphCount, inCell.y)).a;
	float glyphInk = mask * mix(0.7, 1.0, tone);

	// dither branch: per-PIXEL tone (cell quantization would read blocky here),
	// blue-noise threshold, flow-modulated so the fog boils
	vec2 uvPix = (gl_FragCoord.xy / uResolution) * uUvScale + uUvOffset;
	uvPix.y = 1.0 - uvPix.y;
	vec2 suvPix = clamp(uvPix + flow + par, 0.001, 0.999);
	float lumPix = dot(texture(uPhoto, suvPix).rgb, vec3(0.2126, 0.7152, 0.0722));
	float tonePix = pow(clamp((lumPix - 0.5) * uContrast + 0.5, 0.0, 1.0), uGamma);
	float bn = texture(uBlueNoise, gl_FragCoord.xy / 64.0).r;
	float ditherInk = step(bn, tonePix + (fbm(uv * uFlowScale * 2.0 + t) - 0.5) * 0.08);

	float ink = mix(glyphInk, ditherInk, uDitherBlend);

	// the real photograph is the base layer (legibility), glyphs are the
	// surface it is printed in; the cursor resolves it back to the photo
	float reveal = falloff * uCursorReveal;
	vec3 photoCol = texture(uPhoto, suvPix).rgb;
	vec3 base = mix(uPaper, photoCol, clamp(uBaseTint + reveal, 0.0, 1.0));
	float inkFinal = ink * (1.0 - reveal);

	// ember spark: ships at 0; rare warm ticks when enabled
	float spark = step(1.0 - uSparkAmount * 0.001, hash(cell + floor(uTime * 2.0)));
	vec3 col = mix(base, uInk, inkFinal);
	col = mix(col, vec3(0.788, 0.533, 0.306), spark * inkFinal);

	// The hover area is implied rather than outlined. A scattered subset of
	// glyph pixels moves toward the OPPOSING tone of the image beneath it:
	// brighter over dark photography, paper-dark over bright photography.
	float baseLum = dot(base, vec3(0.2126, 0.7152, 0.0722));
	vec3 brightCursorInk = min(vec3(1.0), uInk * 1.28 + vec3(0.04));
	vec3 contrastGlyph = baseLum > 0.48 ? uPaper : brightCursorInk;
	float selectedCell = step(0.42, hash(cell + vec2(41.7, 13.2)));
	float cursorContrast = falloff
		* min(1.0, uCursorStrength * 2.4)
		* selectedCell
		* inkFinal;
	col = mix(col, contrastGlyph, cursorContrast);

	fragColor = vec4(col, 1.0);
}
`;
