import { useEffect, useMemo, useRef, useState } from "react";
import { Bot } from "lucide-react";
import { Input } from "@/components/arc/input/input";
import { Select } from "@/components/arc/select/select";
import Slider from "@/components/arc/slider/slider";
import Switch from "@/components/arc/switch/switch";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { AI_URL, REPO_URL, DEFAULTS, buildQuery, type State } from "./params";

const FITS = ["scale-down", "contain", "cover", "crop", "pad"].map((v) => ({ value: v, label: v }));
const GRAVITIES = ["auto", "center", "top", "bottom", "left", "right"].map((v) => ({ value: v, label: v }));
const FORMATS = ["auto", "avif", "webp", "jpeg", "png"].map((v) => ({ value: v, label: v }));
const ROTATES = ["0", "90", "180", "270"].map((v) => ({ value: v, label: `${v}°` }));
const DPRS = ["1", "2", "3"].map((v) => ({ value: v, label: `${v}x` }));

type Preview = { status: "idle" | "loading" | "ok" | "error"; src?: string; message?: string; type?: string; bytes?: number };

function usePreview(query: string, valid: boolean): Preview {
	const [state, setState] = useState<Preview>({ status: "idle" });
	const prev = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (!valid) { setState({ status: "idle" }); return; }
		const ctl = new AbortController();
		setState((s) => ({ ...s, status: "loading" }));
		const t = setTimeout(async () => {
			try {
				const res = await fetch(`/?${query}`, { signal: ctl.signal });
				if (!res.ok) {
					const text = await res.text();
					let message = text;
					try { message = JSON.parse(text).error ?? text; } catch { /* plain text */ }
					setState({ status: "error", message: `${res.status} ${message}`.slice(0, 200) });
					return;
				}
				const blob = await res.blob();
				if (prev.current) URL.revokeObjectURL(prev.current);
				prev.current = URL.createObjectURL(blob);
				setState({ status: "ok", src: prev.current, type: blob.type, bytes: blob.size });
			} catch (e) {
				if ((e as Error).name !== "AbortError") setState({ status: "error", message: "Request failed" });
			}
		}, 350);
		return () => { clearTimeout(t); ctl.abort(); };
	}, [query, valid]);
	return state;
}

const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="group">
			<h2>{title}</h2>
			<div className="group-body">{children}</div>
		</section>
	);
}

export function App() {
	const [s, setS] = useState<State>(DEFAULTS);
	const set = <K extends keyof State>(k: K) => (v: State[K]) => setS((o) => ({ ...o, [k]: v }));
	const num = <K extends keyof State>(k: K) => (e: React.ChangeEvent<HTMLInputElement>) => setS((o) => ({ ...o, [k]: e.target.value.replace(/\D/g, "") }));

	const valid = /^https?:\/\/.+/i.test(s.url.trim());
	const query = useMemo(() => buildQuery(s), [s]);
	const full = `${location.origin}/?${query}`;
	const preview = usePreview(query, valid);

	return (
		<div className="page">
			<header className="top">
				<div>
					<h1>img-parameter</h1>
					<p>Resize, crop, round and convert any image with URL parameters. Use the result as an image URL.</p>
				</div>
				<nav>
					<a href={AI_URL}><Bot size={16} aria-hidden /> Ask an AI</a>
					<a href={REPO_URL}><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg> GitHub</a>
				</nav>
			</header>

			<main className="grid">
				<div className="controls">
					<Group title="Source">
						<Input label="Image URL" value={s.url} onChange={(e) => set("url")(e.target.value)} placeholder="https://example.com/photo.jpg" error={s.url && !valid ? "Enter an http or https URL" : undefined} />
					</Group>

					<Group title="Size">
						<div className="row">
							<Input label="Width" inputMode="numeric" value={s.w} onChange={num("w")} placeholder="auto" />
							<Input label="Height" inputMode="numeric" value={s.h} onChange={num("h")} placeholder="auto" />
						</div>
						<div className="row">
							<Select label="Fit" value={s.fit} onValueChange={set("fit")} options={FITS} />
							<Select label="Gravity" value={s.gravity} onValueChange={set("gravity")} options={GRAVITIES} />
						</div>
						<SegmentedControl label="Pixel ratio" value={s.dpr} onValueChange={set("dpr")} options={DPRS} />
					</Group>

					<Group title="Shape">
						<Switch label="Circle or ellipse" checked={s.full} onCheckedChange={set("full")} />
						<Slider label="Corner radius" min={0} max={200} step={1} value={s.r} onValueChange={set("r")} disabled={s.full} format={(v) => `${v}px`} />
						<SegmentedControl label="Rotate" value={s.rotate} onValueChange={set("rotate")} options={ROTATES} />
						<Slider label="Trim edges" min={0} max={100} step={1} value={s.trim} onValueChange={set("trim")} format={(v) => `${v}px`} />
						<Input label="Background" value={s.bg} onChange={(e) => set("bg")(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 8))} placeholder="ffffff" description="Used by fit=pad" />
					</Group>

					<Group title="Output">
						<SegmentedControl label="Format" value={s.f} onValueChange={set("f")} options={FORMATS} />
						<Slider label="Quality" min={1} max={100} step={1} value={s.q} onValueChange={set("q")} />
					</Group>

					<Group title="Adjust">
						<Slider label="Brightness" min={0.1} max={3} step={0.05} value={s.brightness} onValueChange={set("brightness")} format={(v) => v.toFixed(2)} />
						<Slider label="Contrast" min={0.1} max={3} step={0.05} value={s.contrast} onValueChange={set("contrast")} format={(v) => v.toFixed(2)} />
						<Slider label="Saturation" min={0} max={3} step={0.05} value={s.saturation} onValueChange={set("saturation")} format={(v) => v.toFixed(2)} />
						<Slider label="Gamma" min={0.1} max={3} step={0.05} value={s.gamma} onValueChange={set("gamma")} format={(v) => v.toFixed(2)} />
						<Slider label="Blur" min={0} max={100} step={1} value={s.blur} onValueChange={set("blur")} />
						<Slider label="Sharpen" min={0} max={10} step={0.5} value={s.sharpen} onValueChange={set("sharpen")} format={(v) => v.toFixed(1)} />
					</Group>
				</div>

				<aside className="side">
					<div className="stage" data-status={preview.status}>
						{preview.status === "error" && <p className="stage-msg" role="alert">{preview.message}</p>}
						{preview.status === "idle" && <p className="stage-msg">Enter an image URL to see the result.</p>}
						{preview.src && preview.status !== "error" && <img src={preview.src} alt="Processed result" />}
					</div>
					{preview.status === "ok" && <p className="meta">{preview.type} · {fmtBytes(preview.bytes ?? 0)}</p>}

					<div className="out">
						<label htmlFor="out-url">Processed URL</label>
						<textarea id="out-url" readOnly value={valid ? full : ""} placeholder="The URL appears here" rows={4} onFocus={(e) => e.currentTarget.select()} />
						<div className="out-actions">
							<CopyButton value={full} label="Copy URL" disabled={!valid} />
							<button type="button" className="link" onClick={() => setS(DEFAULTS)}>Reset</button>
						</div>
					</div>
				</aside>
			</main>
		</div>
	);
}
