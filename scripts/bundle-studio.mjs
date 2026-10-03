// SPDX-License-Identifier: AGPL-3.0-or-later
// Copies the Stickman Studio (../StickMan, or STICKMAN_ROOT) into studio-bundle/ with production
// dependencies only, so the installer carries the whole studio and runs it on the user's machine.
// Usage: node scripts/bundle-studio.mjs   (run after `npm run build` in the StickMan folder)
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "..");
const source = path.resolve(process.env.STICKMAN_ROOT ?? path.join(app, "..", "StickMan"));
const out = path.join(app, "studio-bundle");

if (!fs.existsSync(path.join(source, "dist", "index.html"))) {
	throw new Error(`Build the studio first: cd "${source}" && npm run build`);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// The server imports shared engine code from src/, and reads prompts and drawings from public/.
for (const item of ["dist", "server", "src", "public", "package.json", "package-lock.json", "tsconfig.json", "LICENSE", "NOTICE", "ATTRIBUTION.md"]) {
	const from = path.join(source, item);
	if (!fs.existsSync(from)) continue;
	fs.cpSync(from, path.join(out, item), {
		recursive: true,
		filter: (p) => !/[\\/](node_modules|\.git)([\\/]|$)|\.test\.tsx?$/.test(p) && !p.endsWith(".env"),
	});
}

const pkg = JSON.parse(fs.readFileSync(path.join(out, "package.json"), "utf8"));
// Some packages the server uses at run time are listed as devDependencies (e.g. @napi-rs/canvas):
// keep every one that server/ or src/ actually imports.
const dev = pkg.devDependencies ?? {};
const used = new Set();
const scan = (dir) => {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) scan(file);
		else if (/\.tsx?$/.test(entry.name)) {
			for (const m of fs.readFileSync(file, "utf8").matchAll(/(?:from |import\()"([^".][^"]*)"/g)) {
				const name = m[1].startsWith("@") ? m[1].split("/").slice(0, 2).join("/") : m[1].split("/")[0];
				if (dev[name]) used.add(name);
			}
		}
	}
};
scan(path.join(out, "server"));
scan(path.join(out, "src"));
pkg.dependencies = { ...pkg.dependencies, tsx: dev.tsx ?? "^4.19.0" };
for (const name of used) pkg.dependencies[name] = dev[name];
console.log(`Run-time packages kept from devDependencies: ${[...used].join(", ") || "none"}`);
delete pkg.devDependencies;
delete pkg.scripts;
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify(pkg, null, 2));
fs.rmSync(path.join(out, "package-lock.json"), { force: true });
console.log("Installing the studio's production dependencies…");
execSync("npm install --omit=dev --no-audit --no-fund --fetch-retries=6", { cwd: out, stdio: "inherit" });
console.log(`Studio bundled into ${path.relative(app, out)}`);
