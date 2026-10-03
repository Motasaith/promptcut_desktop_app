// SPDX-License-Identifier: AGPL-3.0-or-later
// electron-builder never copies node_modules folders through extraResources, so the bundled studio
// (studio-bundle/, with its production dependencies) is copied into resources/studio here,
// after packing and before the installer is made.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
	const source = path.join(context.packager.projectDir, "studio-bundle");
	if (!fs.existsSync(path.join(source, "node_modules"))) {
		throw new Error("studio-bundle/ is missing or incomplete. Run: npm run bundle:studio");
	}
	const resources =
		context.electronPlatformName === "darwin"
			? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
			: path.join(context.appOutDir, "resources");
	const target = path.join(resources, "studio");
	fs.rmSync(target, { recursive: true, force: true });
	fs.cpSync(source, target, { recursive: true, dereference: true });
	console.log(`  • studio copied into ${path.relative(context.packager.projectDir, target)}`);
};
