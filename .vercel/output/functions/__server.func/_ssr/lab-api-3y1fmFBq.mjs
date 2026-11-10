import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lab-api-3y1fmFBq.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function asDataImage(value) {
	if (typeof value !== "string") return null;
	if (!value.startsWith("data:image/")) return null;
	if (value.length > 14e5) return null;
	return value;
}
function takeImages(values, limit) {
	if (!Array.isArray(values)) return [];
	const images = [];
	for (const value of values) {
		const image = asDataImage(value);
		if (!image) continue;
		images.push(image);
		if (images.length >= limit) break;
	}
	return images;
}
function isReaction(value) {
	return value === "cheer" || value === "boo" || value === "both";
}
var generatePiece_createServerFn_handler = createServerRpc({
	id: "bd821dd78bfe0d29098d66a33a79754597f355128a99c1bd633829324dd3c8d1",
	name: "generatePiece",
	filename: "src/lib/lab-api.ts"
}, (opts) => generatePiece.__executeServer(opts));
var generatePiece = createServerFn({ method: "POST" }).validator((input) => ({
	spoken: String(input?.spoken ?? "").trim().slice(0, 800),
	category: String(input?.category ?? "")
})).handler(generatePiece_createServerFn_handler, async ({ data }) => {
	const { runPiece } = await import("./imagine.server-DbSdO04R.mjs");
	return runPiece(data);
});
var generateLook_createServerFn_handler = createServerRpc({
	id: "ba37ebe8d6c4051a49d7bfb4d3ca614981cdf4f086c419d2b55ef0d639b9dcee",
	name: "generateLook",
	filename: "src/lib/lab-api.ts"
}, (opts) => generateLook.__executeServer(opts));
var generateLook = createServerFn({ method: "POST" }).validator((input) => ({
	mode: input?.mode === "tweak" ? "tweak" : "look",
	spoken: String(input?.spoken ?? "").trim().slice(0, 1600),
	baseSpoken: String(input?.baseSpoken ?? "").trim().slice(0, 1600),
	characterImages: takeImages(input?.characterImages, 3),
	clothingImages: takeImages(input?.clothingImages, 4),
	lookImage: asDataImage(input?.lookImage)
})).handler(generateLook_createServerFn_handler, async ({ data }) => {
	const { runLook } = await import("./imagine.server-DbSdO04R.mjs");
	return runLook(data);
});
var startRunway_createServerFn_handler = createServerRpc({
	id: "bb79534e248a71735da9d1df6c341d0af28042b7960063e469558d6387e9487a",
	name: "startRunway",
	filename: "src/lib/lab-api.ts"
}, (opts) => startRunway.__executeServer(opts));
var startRunway = createServerFn({ method: "POST" }).validator((input) => ({
	lookImage: asDataImage(input?.lookImage),
	faceImage: asDataImage(input?.faceImage),
	spoken: String(input?.spoken ?? "").trim().slice(0, 800),
	reaction: isReaction(input?.reaction) ? input.reaction : "both"
})).handler(startRunway_createServerFn_handler, async ({ data }) => {
	const { runStart } = await import("./imagine.server-DbSdO04R.mjs");
	return runStart(data);
});
var pollRunway_createServerFn_handler = createServerRpc({
	id: "ad2ddfc0fa330e2f8c1ebdb05271f9ec359db94df383db864689b0e9ebb3fc3e",
	name: "pollRunway",
	filename: "src/lib/lab-api.ts"
}, (opts) => pollRunway.__executeServer(opts));
var pollRunway = createServerFn({ method: "POST" }).validator((input) => ({ requestId: String(input?.requestId ?? "") })).handler(pollRunway_createServerFn_handler, async ({ data }) => {
	const { runPoll } = await import("./imagine.server-DbSdO04R.mjs");
	return runPoll(data.requestId);
});
//#endregion
export { generateLook_createServerFn_handler, generatePiece_createServerFn_handler, pollRunway_createServerFn_handler, startRunway_createServerFn_handler };
