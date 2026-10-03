// Development check: run a JS file inside one of the app's windows through the DevTools port that
// PROMPTCUT_DEBUG_PORT opens, and print the result. Console output is never echoed (it can contain
// the user's saved settings).
// Usage: node scripts/cdp-eval.mjs <port> <url-substring> <file.js>
import { readFileSync } from "node:fs";

const [port, match, file] = process.argv.slice(2);
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = pages.find((p) => p.type === "page" && p.url.includes(match));
if (!target) throw new Error(`no window matching "${match}": ${pages.map((p) => p.url).join(", ")}`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
	const m = JSON.parse(e.data);
	if (m.id && pending.has(m.id)) pending.get(m.id)(m);
});
const send = (method, params) =>
	new Promise((r) => {
		const i = ++id;
		pending.set(i, r);
		ws.send(JSON.stringify({ id: i, method, params }));
	});
const code = readFileSync(file, "utf8");
const res = await send("Runtime.evaluate", { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true });
console.log(JSON.stringify(res.result?.result?.value ?? res.result?.exceptionDetails ?? res, null, 2));
ws.close();
