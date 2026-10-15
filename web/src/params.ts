export const REPO_URL = "https://github.com/Lapius7/img-parameter.wks.lapius7.com";
export const AI_URL = `${REPO_URL}/blob/main/AI.md`;

export interface State {
	url: string; w: string; h: string; fit: string; gravity: string; f: string; q: number;
	r: number; full: boolean; rotate: string; bg: string; blur: number; sharpen: number;
	brightness: number; contrast: number; saturation: number; gamma: number; trim: number; dpr: string;
}

export const DEFAULTS: State = {
	url: "https://httpbin.org/image/jpeg", w: "480", h: "", fit: "scale-down", gravity: "auto", f: "auto", q: 85,
	r: 0, full: false, rotate: "0", bg: "", blur: 0, sharpen: 0,
	brightness: 1, contrast: 1, saturation: 1, gamma: 1, trim: 0, dpr: "1",
};

/** Only parameters that differ from the API defaults are written, so the URL stays short. */
export function buildQuery(s: State): string {
	const p = new URLSearchParams();
	p.set("url", s.url.trim());
	const add = (k: string, v: string | number, skip: string | number) => { if (String(v) !== String(skip) && String(v) !== "") p.set(k, String(v)); };
	add("w", s.w, ""); add("h", s.h, "");
	add("fit", s.fit, "scale-down"); add("gravity", s.gravity, "auto");
	add("f", s.f, "auto"); add("q", s.q, 85);
	if (s.full) p.set("r", "full"); else add("r", s.r, 0);
	add("rotate", s.rotate, "0"); add("bg", s.bg.replace(/^#/, ""), "");
	add("blur", s.blur, 0); add("sharpen", s.sharpen, 0);
	add("brightness", s.brightness, 1); add("contrast", s.contrast, 1);
	add("saturation", s.saturation, 1); add("gamma", s.gamma, 1);
	add("trim", s.trim, 0); add("dpr", s.dpr, "1");
	return p.toString();
}
