#!/usr/bin/env bun
// 使い方: SIGNING_SECRET=xxx bun sign.mjs "https://img-parameter.wks.lapius7.com/?url=...&w=400"
import { createHmac } from "node:crypto";
const secret = process.env.SIGNING_SECRET;
const raw = process.argv[2];
if (!secret || !raw) { console.error("usage: SIGNING_SECRET=... bun sign.mjs <url>"); process.exit(1); }
const u = new URL(raw);
const msg = u.search.replace(/^\?/, "");
const sig = createHmac("sha256", secret).update(msg).digest("hex");
console.log(`${u.origin}${u.pathname}?${msg}&sig=${sig}`);
