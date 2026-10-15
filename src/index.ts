const FORMATS: Record<string, string> = {
	avif: "image/avif",
	webp: "image/webp",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
};
const FITS = ["scale-down", "contain", "cover", "crop", "pad"] as const;
const GRAVITIES = ["auto", "left", "right", "top", "bottom", "center"] as const;

class BadRequest extends Error {}

// Images は SVG を描画できないので、角丸マスク用の PNG を自前で作る
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const dv = new DataView(out.buffer);
	dv.setUint32(0, data.length);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	let c = 0xffffffff;
	for (let i = 4; i < 8 + data.length; i++) c = CRC_TABLE[(c ^ out[i]) & 0xff] ^ (c >>> 8);
	dv.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
	return out;
}

/** 半径 R の角マスク。円の外側だけ黒で不透明。corner: 0=左上 1=右上 2=右下 3=左下 */
async function cornerMask(R: number, corner: 0 | 1 | 2 | 3): Promise<Uint8Array> {
	const SS = 4;
	const raw = new Uint8Array(R * (R * 4 + 1));
	for (let y = 0; y < R; y++) {
		raw[y * (R * 4 + 1)] = 0;
		for (let x = 0; x < R; x++) {
			// 左上角に正規化: 円の中心は (R, R)
			const px = corner === 1 || corner === 2 ? R - 1 - x : x;
			const py = corner === 2 || corner === 3 ? R - 1 - y : y;
			let outside = 0;
			for (let sy = 0; sy < SS; sy++) {
				for (let sx = 0; sx < SS; sx++) {
					const dx = R - (px + (sx + 0.5) / SS);
					const dy = R - (py + (sy + 0.5) / SS);
					if (dx * dx + dy * dy > R * R) outside++;
				}
			}
			raw[y * (R * 4 + 1) + 1 + x * 4 + 3] = Math.round((outside / (SS * SS)) * 255);
		}
	}
	const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
	const ihdr = new Uint8Array(13);
	const dv = new DataView(ihdr.buffer);
	dv.setUint32(0, R);
	dv.setUint32(4, R);
	ihdr.set([8, 6, 0, 0, 0], 8);
	const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", z), chunk("IEND", new Uint8Array())];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let o = 0;
	for (const p of parts) (out.set(p, o), (o += p.length));
	return out;
}

async function verifySig(rawQuery: string, secret: string): Promise<boolean> {
	const parts = rawQuery.replace(/^\?/, "").split("&");
	const sigPart = parts.find((x) => x.startsWith("sig="));
	if (!sigPart) return false;
	const hex = sigPart.slice(4);
	if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
	const msg = parts.filter((x) => !x.startsWith("sig=")).join("&");
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
	const sig = Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
	return crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(msg));
}

function applyPreset(p: URLSearchParams, env: Env): URLSearchParams {
	const name = p.get("preset");
	if (!name) return p;
	let presets: Record<string, string> = {};
	try {
		presets = JSON.parse(env.PRESETS || "{}");
	} catch {
		throw new Error("PRESETS is not valid JSON");
	}
	const def = presets[name];
	if (def === undefined) throw new BadRequest(`unknown preset: ${name}`);
	const merged = new URLSearchParams(def);
	for (const [k, v] of p) if (k !== "preset") merged.set(k, v);
	return merged;
}

function num(p: URLSearchParams, key: string, min: number, max: number): number | undefined {
	const v = p.get(key);
	if (v === null || v === "") return undefined;
	const n = Number(v);
	if (!Number.isFinite(n) || n < min || n > max) {
		throw new BadRequest(`${key} must be a number between ${min} and ${max}`);
	}
	return n;
}

function oneOf<T extends string>(p: URLSearchParams, key: string, list: readonly T[]): T | undefined {
	const v = p.get(key);
	if (v === null || v === "") return undefined;
	if (!list.includes(v as T)) throw new BadRequest(`${key} must be one of: ${list.join(", ")}`);
	return v as T;
}

function checkSource(raw: string | null, env: Env): URL {
	if (!raw) throw new BadRequest("url parameter is required");
	let src: URL;
	try {
		src = new URL(raw);
	} catch {
		throw new BadRequest("url is invalid");
	}
	if (src.protocol !== "http:" && src.protocol !== "https:") {
		throw new BadRequest("only http(s) urls are allowed");
	}
	const allowed = (env.ALLOWED_HOSTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
	if (allowed.length && !allowed.some((h) => src.hostname === h || src.hostname.endsWith("." + h))) {
		throw new BadRequest("host is not allowed");
	}
	return src;
}

const REPO_URL = "https://github.com/Lapius7/img-parameter.wks.lapius7.com";

const TOP_PAGE = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>img-parameter</title>
<meta name="description" content="URLのパラメータで画像を加工して返すAPI">
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#111;--sub:#666;--line:#e5e5e5;--code:#f5f5f5}
@media(prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--sub:#999;--line:#2a2a2a;--code:#1c1c1c}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--fg);font:16px/1.7 system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
main{width:100%;max-width:560px}
h1{margin:0 0 4px;font-size:28px;font-weight:600;letter-spacing:-.01em}
p{margin:0 0 20px;color:var(--sub)}
pre{margin:0 0 24px;padding:14px 16px;overflow-x:auto;background:var(--code);border:1px solid var(--line);border-radius:10px;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--fg)}
a{color:var(--fg);text-underline-offset:3px}
a:focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:2px}
</style>
</head>
<body>
<main>
<h1>img-parameter</h1>
<p>URLのパラメータで画像を加工して返すAPI</p>
<pre>https://img-parameter.wks.lapius7.com/
  ?url=https://example.com/photo.jpg
  &amp;w=400&amp;h=300&amp;fit=cover&amp;f=webp</pre>
<a href="${REPO_URL}">GitHub</a>
</main>
</body>
</html>
`;

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
		}
		const reqUrl = new URL(request.url);
		if (reqUrl.pathname !== "/") return new Response("Not Found", { status: 404 });
		if (!reqUrl.search) return new Response(TOP_PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });

		// フォーマット自動選択は Accept に依存するので、キャッシュキーに結果形式を含める
		if (env.SIGNING_SECRET && !(await verifySig(reqUrl.search, env.SIGNING_SECRET))) {
			return new Response("invalid or missing signature", { status: 403 });
		}
		let p: URLSearchParams;
		try {
			p = applyPreset(reqUrl.searchParams, env);
		} catch (e) {
			if (e instanceof BadRequest) return new Response(e.message, { status: 400 });
			console.error(e);
			return new Response("server misconfigured", { status: 500 });
		}
		let format = oneOf(p, "f", Object.keys(FORMATS) as (keyof typeof FORMATS)[]);
		if (!format) {
			const accept = request.headers.get("Accept") ?? "";
			format = accept.includes("image/avif") ? "avif" : accept.includes("image/webp") ? "webp" : "jpeg";
		}
		// 角丸は透過が要るので、透過できない形式は WebP に切り替える
		if (p.get("r") && (format === "jpeg" || format === "jpg" || format === "gif")) format = "webp";
		const cacheKey = new Request(`${reqUrl.origin}${reqUrl.pathname}?${p.toString()}&__f=${format}`);
		const cache = caches.default;
		const hit = await cache.match(cacheKey);
		if (hit) return hit;

		try {
			let fallbackStatus = 0;
			const src = checkSource(p.get("url"), env);

			const transform: ImageTransform = {};
			const w = num(p, "w", 1, 8192);
			const h = num(p, "h", 1, 8192);
			if (w) transform.width = w;
			if (h) transform.height = h;
			const fit = oneOf(p, "fit", FITS);
			if (fit) transform.fit = fit;
			const gravity = oneOf(p, "gravity", GRAVITIES);
			if (gravity) transform.gravity = gravity;
			const rot = num(p, "rotate", 0, 270);
			if (rot !== undefined) {
				if (![0, 90, 180, 270].includes(rot)) throw new BadRequest("rotate must be 0, 90, 180 or 270");
				transform.rotate = rot as 0 | 90 | 180 | 270;
			}
			const blur = num(p, "blur", 1, 250);
			if (blur) transform.blur = blur;
			const brightness = num(p, "brightness", 0.01, 10);
			if (brightness) transform.brightness = brightness;
			const contrast = num(p, "contrast", 0.01, 10);
			if (contrast) transform.contrast = contrast;
			const saturation = num(p, "saturation", 0, 10);
			if (saturation !== undefined) transform.saturation = saturation;
			const gamma = num(p, "gamma", 0.01, 10);
			if (gamma) transform.gamma = gamma;
			const sharpen = num(p, "sharpen", 0, 10);
			if (sharpen) transform.sharpen = sharpen;
			const trim = num(p, "trim", 0, 1000);
			if (trim) transform.trim = { top: trim, right: trim, bottom: trim, left: trim };
			const bg = p.get("bg");
			if (bg) {
				if (!/^[0-9a-fA-F]{3,8}$/.test(bg)) throw new BadRequest("bg must be a hex color like ffffff");
				transform.background = "#" + bg;
			}

			const get = (u: string) => fetch(u, { headers: { Accept: "image/*" }, cf: { cacheEverything: true, cacheTtl: 3600 } });
			let upstream = await get(src.toString());
			let failStatus = 0;
			if (!upstream.ok || !upstream.body) failStatus = 502;
			else if (!(upstream.headers.get("content-type") ?? "").startsWith("image/")) failStatus = 400;
			if (failStatus) {
				// 代替画像があれば、元画像の失敗ステータスのまま代替画像を返す
				if (!env.FALLBACK_URL) {
					return new Response(failStatus === 502 ? `source returned ${upstream.status}` : "source is not an image", { status: failStatus });
				}
				upstream = await get(env.FALLBACK_URL);
				if (!upstream.ok || !upstream.body) return new Response("fallback unavailable", { status: 502 });
				fallbackStatus = failStatus;
			}
			const max = Number(env.MAX_SOURCE_BYTES) || 20_000_000;
			const len = Number(upstream.headers.get("content-length") ?? 0);
			if (len > max) return new Response("source too large", { status: 413 });

			const dpr = num(p, "dpr", 1, 4);
			if (dpr && transform.width) transform.width = Math.min(8192, Math.round(transform.width * dpr));
			if (dpr && transform.height) transform.height = Math.min(8192, Math.round(transform.height * dpr));

			const r = p.get("r");
			if (r && r !== "full" && !(Number(r) >= 1 && Number(r) <= 4096)) {
				throw new BadRequest("r must be a number between 1 and 4096, or full");
			}
			const quality = num(p, "q", 1, 100) ?? 85;
			const outFormat = FORMATS[format] as ImageOutputOptions["format"];
			let out;
			if (r) {
				// 1回目: 指定サイズに加工(PNG)。2回目: 実寸の角丸マスクを重ねて切り抜く
				const first = await env.IMAGES.input(upstream.body!).transform(transform).output({ format: "image/png" });
				const buf = await first.response().arrayBuffer();
				const { width, height } = (await env.IMAGES.info(new Response(buf).body!)) as { width: number; height: number };
				const R = Math.max(1, Math.round(r === "full" ? Math.min(width, height) / 2 : Math.min(Number(r), Math.min(width, height) / 2)));
				// 四隅の「円の外側」だけを塗ったPNGを xor で重ね、重なった不透明部分を透明にする
				const corner = async (c: 0 | 1 | 2 | 3) => new Response(await cornerMask(R, c)).body!;
				const mask = { composite: "xor" } as const;
				out = await env.IMAGES.input(new Response(buf).body!)
					.draw(await corner(0), { ...mask, left: 0, top: 0 })
					.draw(await corner(1), { ...mask, right: 0, top: 0 })
					.draw(await corner(2), { ...mask, right: 0, bottom: 0 })
					.draw(await corner(3), { ...mask, left: 0, bottom: 0 })
					.output({ format: outFormat, quality });
			} else {
				out = await env.IMAGES.input(upstream.body!).transform(transform).output({ format: outFormat, quality });
			}

			const res = new Response(out.image(), {
				status: fallbackStatus || 200,
				headers: {
					"content-type": out.contentType(),
					"cache-control": fallbackStatus ? "public, max-age=60" : "public, max-age=86400, s-maxage=604800",
					"access-control-allow-origin": "*",
					vary: "Accept",
				},
			});
			if (!fallbackStatus) ctx.waitUntil(cache.put(cacheKey, res.clone()));
			return res;
		} catch (e) {
			if (e instanceof BadRequest) return new Response(e.message, { status: 400 });
			console.error(e);
			return new Response("image processing failed", { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
