// SPDX-License-Identifier: AGPL-3.0-or-later
// Draws the PromptCut Studio logo (the Stickman wave mark) into the app icon, tray icons and the
// in-app logo. Run: node scripts/brand-icons.cjs  (uses sharp from ../StickMan)
const path = require("node:path");
const fs = require("node:fs");
const sharp = require(path.resolve(__dirname, "..", "..", "StickMan", "node_modules", "sharp"));
const root = path.resolve(__dirname, "..");
const BG = "#1b1d18", INK = "#eeecdf", ACCENT = "#d9502f";

function mark({ frac = 0.72, shape = "square", rec = false }) {
	const s = 32 / frac, o = (s - 32) / 2;
	const bg = shape === "none" ? "" : `<rect x="${-o}" y="${-o}" width="${s}" height="${s}" rx="${shape === "circle" ? s / 2 : s * 0.22}" fill="${BG}"/>`;
	const dot = rec ? `<circle cx="26" cy="25" r="4.2" fill="${ACCENT}" stroke="${BG}" stroke-width="1.4"/>` : "";
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-o} ${-o} ${s} ${s}">${bg}
<g fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(-1.5 0)">
<circle cx="14" cy="7" r="4.5"/><path d="M14 11.5v9M14 14.5l-6 3.5M14 14.5l6-5M14 20.5l-4.5 8M14 20.5l4.5 8"/>
<path d="M24 5.5l3-2.5M25.5 9l3.5-.5" stroke="${ACCENT}"/></g>${dot}</svg>`;
}
const png = (svg, size, file) => {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	return sharp(Buffer.from(svg), { density: (72 * size) / 32 }).resize(size, size).png().toFile(file);
};

(async () => {
	for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) await png(mark({}), size, path.join(root, "icons/icons/png", `${size}x${size}.png`));
	await png(mark({ frac: 0.86 }), 512, path.join(root, "public/promptcut.png"));
	await png(mark({ frac: 0.86, rec: true }), 64, path.join(root, "public/rec-button.png"));
	// Windows .ico: PNG-compressed entries (supported since Vista).
	const sizes = [16, 24, 32, 48, 64, 128, 256];
	const images = await Promise.all(sizes.map((s) => sharp(path.join(root, "icons/icons/png", `${s}x${s}.png`)).toBuffer()));
	const header = Buffer.alloc(6 + 16 * sizes.length);
	header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
	let offset = header.length;
	sizes.forEach((s, i) => {
		const e = 6 + 16 * i;
		header.writeUInt8(s >= 256 ? 0 : s, e); header.writeUInt8(s >= 256 ? 0 : s, e + 1);
		header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
		header.writeUInt32LE(images[i].length, e + 8); header.writeUInt32LE(offset, e + 12);
		offset += images[i].length;
	});
	fs.writeFileSync(path.join(root, "icons/icons/win/icon.ico"), Buffer.concat([header, ...images]));
	console.log("icons written");
})().catch((e) => { console.error(e); process.exit(1); });
