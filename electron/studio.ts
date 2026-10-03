// PromptCut Studio desktop: the Stickman Studio editor, running entirely on this computer.
// Copyright (c) 2026 Abdul Rauf Azhar <https://github.com/Motasaith>
// Source: https://github.com/Motasaith/StickMan
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The studio's own server (projects, media, ffmpeg, voices, AI calls) runs as a child process on
// this machine, with Electron's bundled Node. Projects and media stay in the same folder the web
// version uses (~/.stickman-studio), so both see the same work. Nothing is uploaded anywhere
// except the AI and stock services the user configures with their own keys.

import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, shell } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let server: ChildProcess | null = null;
let baseUrl = "";
let studioWindow: BrowserWindow | null = null;

/** Where the studio's code lives: bundled next to the app, or the StickMan checkout beside it. */
function studioRoot(): string {
	const candidates = [
		process.env.STICKMAN_ROOT,
		app.isPackaged ? path.join(process.resourcesPath, "studio") : undefined,
		path.resolve(__dirname, "..", "..", "StickMan"),
	].filter(Boolean) as string[];
	const found = candidates.find((dir) => fs.existsSync(path.join(dir, "server", "index.ts")));
	if (!found) throw new Error(`Stickman Studio files not found (looked in ${candidates.join(", ")})`);
	return found;
}

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = net.createServer();
		probe.unref();
		probe.on("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const { port } = probe.address() as net.AddressInfo;
			probe.close(() => resolve(port));
		});
	});
}

async function waitForServer(url: string, timeoutMs: number) {
	const until = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < until) {
		if (server?.exitCode != null) throw new Error(`the studio server stopped (exit ${server.exitCode})`);
		try {
			const res = await fetch(`${url}/api/health`);
			if (res.ok) return;
		} catch (err) {
			lastError = err;
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`the studio server did not start: ${String(lastError)}`);
}

/** Start the studio server once and return its address (127.0.0.1 only, never the network). */
export async function startStudio(): Promise<string> {
	if (baseUrl) return baseUrl;
	const root = studioRoot();
	const port = await freePort();
	const tsx = pathToFileURL(path.join(root, "node_modules", "tsx", "dist", "loader.mjs")).href;
	const logFile = path.join(app.getPath("logs"), "studio-server.log");
	fs.mkdirSync(path.dirname(logFile), { recursive: true });
	const log = fs.createWriteStream(logFile, { flags: "a" });
	server = spawn(process.execPath, ["--import", tsx, path.join("server", "index.ts")], {
		cwd: root,
		env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "production" },
		stdio: ["ignore", "pipe", "pipe"],
		windowsHide: true,
	});
	server.stdout?.pipe(log);
	server.stderr?.pipe(log);
	const url = `http://127.0.0.1:${port}`;
	await waitForServer(url, 60_000);
	baseUrl = url;
	return url;
}

export function stopStudio() {
	server?.kill();
	server = null;
	baseUrl = "";
}

export function getStudioWindow() {
	return studioWindow && !studioWindow.isDestroyed() ? studioWindow : null;
}

/** The main window: the studio's projects page. */
export async function openStudioWindow(route = "/"): Promise<BrowserWindow> {
	const url = await startStudio();
	const existing = getStudioWindow();
	if (existing) {
		if (route !== "/" || !existing.webContents.getURL().startsWith(url)) await existing.loadURL(url + route);
		if (existing.isMinimized()) existing.restore();
		existing.show();
		existing.focus();
		return existing;
	}
	studioWindow = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 640,
		title: "PromptCut Studio",
		backgroundColor: "#f3efe6",
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			additionalArguments: ["--promptcut-studio"],
			contextIsolation: true,
			nodeIntegration: false,
		},
	});
	// Outside links (GitHub, provider sign-up pages) open in the user's browser.
	studioWindow.webContents.setWindowOpenHandler(({ url: target }) => {
		if (!target.startsWith(url)) void shell.openExternal(target);
		return { action: target.startsWith(url) ? "allow" : "deny" };
	});
	studioWindow.webContents.on("will-navigate", (event, target) => {
		if (!target.startsWith(url)) {
			event.preventDefault();
			void shell.openExternal(target);
		}
	});
	studioWindow.on("closed", () => {
		studioWindow = null;
	});
	await studioWindow.loadURL(url + route);
	return studioWindow;
}

/**
 * Bring a finished recording into the studio: import it into the media library, start a project
 * the size and length of the recording, and open it in the editor with the clip on the canvas.
 */
export async function sendRecordingToStudio(filePath: string): Promise<{ projectId: string }> {
	const url = await startStudio();
	const bytes = await fs.promises.readFile(filePath);
	const name = path.basename(filePath);
	const form = new FormData();
	form.append("file", new Blob([bytes]), name);
	form.append("origin", "recording");
	const up = await fetch(`${url}/api/media`, { method: "POST", body: form });
	const media = (await up.json()) as { id?: string; error?: string };
	if (!up.ok || !media.id) throw new Error(media.error ?? `import failed (${up.status})`);
	const res = await fetch(`${url}/api/projects/from-media`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id: media.id, title: name.replace(/\.[a-z0-9]+$/i, "") }),
	});
	const project = (await res.json()) as { id?: string; asset?: string; error?: string };
	if (!res.ok || !project.id) throw new Error(project.error ?? `project failed (${res.status})`);
	await openStudioWindow(`/editor/${project.id}?place=${project.asset}`);
	return { projectId: project.id };
}
