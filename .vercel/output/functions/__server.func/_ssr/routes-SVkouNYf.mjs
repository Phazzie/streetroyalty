import { i as __toESM } from "../_runtime.mjs";
import { i as interpret, n as LOCK_LINE, r as REQUIRED_SLOTS, t as CATEGORIES } from "./tickets-B6Ik5l_m.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { n as Square, r as Mic } from "../_libs/lucide-react.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-SVkouNYf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex shrink-0 items-center justify-center gap-2 font-medium transition-[opacity,transform] duration-150 ease-out disabled:pointer-events-none disabled:border-line disabled:bg-line disabled:text-muted disabled:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg active:scale-[0.98]", {
	variants: {
		variant: {
			primary: "border-2 border-ink bg-accent font-extrabold text-accent-fg",
			ghost: "border-2 border-ink bg-cream font-bold text-fg",
			quiet: "bg-surface font-bold text-fg"
		},
		size: {
			md: "h-12 rounded-md px-4 text-base",
			lg: "h-14 rounded-lg px-5 text-lg"
		}
	},
	defaultVariants: {
		variant: "primary",
		size: "md"
	}
});
function Button({ className, variant, size, asChild = false, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		type: asChild ? void 0 : type,
		...props
	});
}
var copy = {
	title: "Street Royalty",
	lab: "Outfit Lab",
	crown: "Crown never came off. Just dressing it.",
	lockLead: "Three photos lock your face: front, side, and three-quarter. Extra is optional.",
	lockCount: "The button turns on when those three are in.",
	stay: "Photos and looks stay on this phone.",
	lockedIn: "Locked in.",
	boardOpen: "Board's open. What are we building?",
	sharp: "That one's sharp. Want to run it or tweak it?",
	buildingThose: "Got it. Building those.",
	buildingOne: "Got it. Building that.",
	onBoard: "On the board.",
	puttingOn: "Putting it on you. Give it a moment.",
	runwayUp: "Runway's up.",
	walking: "Walking. This usually takes a minute.",
	saved: "Saved.",
	already: "Already saved.",
	stopped: "Stopped.",
	emptyBoard: "Nothing on the board yet. Name a piece below: hoodie, coat, trousers, shoes.",
	missed: "That one didn't land. Say it again or try different words.",
	partial: "One of those didn't land. The rest are up.",
	unclear: "Name the piece. Hoodie, trousers, coat, hat, or shoes.",
	pick: "Tap what you're wearing. An orange border means it's on.",
	noLook: "Nothing to put on yet.",
	micBlocked: "Mic's blocked. Type it.",
	missedSpeech: "Didn't catch that. Say it again.",
	cameraBlocked: "Camera's blocked. Use a photo.",
	cameraWait: "Camera isn't ready yet. Try the shutter again.",
	notPhoto: "That file isn't a photo. Choose an image.",
	storageFull: "This phone is full. Drop a saved look and try again.",
	stillBuilding: "Still building. Hit stop if you want it cut.",
	hubJob: "Name the clothes: a hoodie, trousers, a coat, shoes. Open the board, tap what you're wearing, then put it on you.",
	runwayHint: "Runway is the walk. The crowd cheers, boos, or does both.",
	splashLead: "The house model holds the pictures. Your face wears the clothes.",
	stepFace: "Three photos lock your face.",
	stepPieces: "Name the pieces you want built.",
	stepWalk: "Put them on you, then send it down the runway.",
	openIt: "Open it",
	pinned: "Saved looks stay on this device.",
	installHow: "Chrome or Edge: Install app. Phone: Add to Home Screen.",
	clipGone: "That clip's gone. Run it again.",
	cantBuild: "Can't build right now. Say it again in a minute.",
	boardForPieces: "Say that on the board. This is the walk.",
	noWalk: "Nothing to walk in.",
	openCamera: "Open the camera",
	drop: "Drop",
	putOn: "Put it on me",
	saveThis: "Save this",
	runway: "Runway",
	change: "Change something",
	changeHint: "Say what to change",
	tryReaction: "Reshoot the walk",
	wearing: "Wearing",
	nothingOn: "Nothing on you yet.",
	openBoard: "Open the board",
	usePhotos: "Use these photos",
	yourFace: "Your face",
	optional: "Optional",
	takePhoto: "Take photo",
	keepIt: "Keep it on this phone",
	typePiece: "Name a piece",
	reshootNote: "This walk doesn't match the crowd you picked.",
	usePhoto: "Use a photo",
	face: "Face",
	board: "Board",
	hub: "Hub",
	look: "Look",
	typeIt: "Or type it",
	go: "Go",
	listening: "Listening.",
	judges: "Judges",
	cheer: "Cheer",
	boo: "Boo",
	both: "Both",
	add: "Add",
	notNow: "Not now",
	empty: "Empty.",
	savedHead: "Saved",
	on: "On",
	stop: "Stop",
	talk: "Talk",
	slots: {
		front: "Front",
		side: "Side",
		threequarter: "3/4",
		extra: "Extra"
	}
};
var SCENES = [
	{
		src: "/wild/scene-beam.mp4",
		poster: "/wild/scene-beam.jpg",
		label: "House model on the beam, coffee in hand, unfazed"
	},
	{
		src: "/wild/scene-moon.mp4",
		poster: "/wild/scene-moon.jpg",
		label: "House model on the moon, coffee in hand, unfazed"
	},
	{
		src: "/wild/scene-boat.mp4",
		poster: "/wild/scene-boat.jpg",
		label: "House model in the boat, coffee in hand, unfazed"
	},
	{
		src: "/wild/scene-flyer.mp4",
		poster: "/wild/scene-flyer.jpg",
		label: "House model at the flyer, hands in pockets, unfazed"
	}
];
var STEPS = [
	copy.stepFace,
	copy.stepPieces,
	copy.stepWalk
];
function Clip({ src, poster, label, className }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const video = ref.current;
		if (!video) return;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		video.muted = true;
		if (reduce) {
			video.pause();
			return;
		}
		video.play().catch(() => void 0);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
		ref,
		className,
		src,
		poster,
		muted: true,
		playsInline: true,
		autoPlay: true,
		loop: true,
		preload: "metadata",
		"aria-label": label
	});
}
function Shell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mess-field flex min-h-dvh justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "phone-frame relative flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream text-fg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Marquee, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex min-h-0 min-w-0 flex-1 flex-col",
				children
			})]
		})
	});
}
function Marquee() {
	const line = "On the beam  ·  On the moon  ·  In the boat  ·  At the flyer  ·  ";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mash-bar edge-b safe-top shrink-0 overflow-hidden text-cream",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "marquee-track py-1.5 font-display text-xs font-bold tracking-widest uppercase",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "px-3",
				children: line
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "px-3",
				children: line
			})]
		})
	});
}
function Header({ title, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "flex shrink-0 flex-col gap-3 border-b border-line bg-cream px-4 pt-3 pb-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-display text-xs font-bold tracking-widest text-muted uppercase",
			children: copy.lab
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl font-extrabold leading-none tracking-tight text-ink",
			children: title
		})] }), action ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-2",
			children: action
		}) : null]
	});
}
function TextButton({ children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "h-11 rounded-full border-2 border-ink bg-cream px-4 text-sm font-bold text-ink transition-opacity duration-150 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
		children
	});
}
function Splash({ onEnter }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mess-field flex min-h-dvh items-center justify-center text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "phone-frame safe-top flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid shrink-0 grid-cols-2",
					children: SCENES.map((scene) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clip, {
						...scene,
						className: "h-36 w-full object-cover object-top sm:h-44"
					}, scene.src))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 *:shrink-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-4xl font-extrabold leading-none tracking-tight",
							children: copy.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-lg italic",
							children: copy.splashLead
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "flex list-decimal flex-col gap-2 pl-5",
							children: STEPS.map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: step }, step))
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "safe-bottom shrink-0 border-t border-line px-5 pt-3",
					children: onEnter ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "w-full",
						size: "lg",
						onClick: onEnter,
						children: copy.openIt
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "pb-3 text-sm text-muted",
						children: copy.lab
					})
				})
			]
		})
	});
}
function Status({ text }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		"aria-live": "polite",
		className: "min-h-6 text-base text-muted",
		children: text
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-12 w-full rounded-md border-2 border-ink bg-cream px-3 text-base text-fg outline-none placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink", className),
		...props
	});
}
var DB_NAME = "street-royalty";
var STORE = "kv";
var opening = null;
function openDb() {
	if (opening) return opening;
	opening = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
		request.onsuccess = () => {
			const db = request.result;
			const drop = () => {
				if (opening) opening = null;
			};
			db.onclose = drop;
			db.onversionchange = () => {
				db.close();
				drop();
			};
			resolve(db);
		};
		request.onerror = () => {
			opening = null;
			reject(request.error);
		};
	});
	return opening;
}
async function idbGet(key) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
async function idbSet(key, value) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}
function drawDataUrl(dataUrl, maxEdge, quality) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => {
			const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
			const width = Math.max(1, Math.round(image.width * scale));
			const height = Math.max(1, Math.round(image.height * scale));
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				resolve(dataUrl);
				return;
			}
			ctx.drawImage(image, 0, 0, width, height);
			resolve(canvas.toDataURL("image/jpeg", quality));
		};
		image.onerror = () => reject(/* @__PURE__ */ new Error("photo"));
		image.src = dataUrl;
	});
}
async function compressDataUrl(dataUrl, maxEdge = 800, quality = .72) {
	let edge = maxEdge;
	let q = quality;
	let result = await drawDataUrl(dataUrl, edge, q);
	while (result.length > 12e5 && edge > 360) {
		edge = Math.round(edge * .75);
		q = Math.max(.5, q - .1);
		result = await drawDataUrl(dataUrl, edge, q);
	}
	return result;
}
function readFileAsDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
function frameToDataUrl(video, maxEdge = 800, quality = .72, mirror = false) {
	const width = video.videoWidth;
	const height = video.videoHeight;
	if (!width || !height) return null;
	const scale = Math.min(1, maxEdge / Math.max(width, height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	if (mirror) {
		ctx.translate(canvas.width, 0);
		ctx.scale(-1, 1);
	}
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/jpeg", quality);
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
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
var generatePiece = createServerFn({ method: "POST" }).validator((input) => ({
	spoken: String(input?.spoken ?? "").trim().slice(0, 800),
	category: String(input?.category ?? "")
})).handler(createSsrRpc("bd821dd78bfe0d29098d66a33a79754597f355128a99c1bd633829324dd3c8d1"));
var generateLook = createServerFn({ method: "POST" }).validator((input) => ({
	mode: input?.mode === "tweak" ? "tweak" : "look",
	spoken: String(input?.spoken ?? "").trim().slice(0, 1600),
	baseSpoken: String(input?.baseSpoken ?? "").trim().slice(0, 1600),
	characterImages: takeImages(input?.characterImages, 3),
	clothingImages: takeImages(input?.clothingImages, 4),
	lookImage: asDataImage(input?.lookImage)
})).handler(createSsrRpc("ba37ebe8d6c4051a49d7bfb4d3ca614981cdf4f086c419d2b55ef0d639b9dcee"));
var startRunway = createServerFn({ method: "POST" }).validator((input) => ({
	lookImage: asDataImage(input?.lookImage),
	faceImage: asDataImage(input?.faceImage),
	spoken: String(input?.spoken ?? "").trim().slice(0, 800),
	reaction: isReaction(input?.reaction) ? input.reaction : "both"
})).handler(createSsrRpc("bb79534e248a71735da9d1df6c341d0af28042b7960063e469558d6387e9487a"));
var pollRunway = createServerFn({ method: "POST" }).validator((input) => ({ requestId: String(input?.requestId ?? "") })).handler(createSsrRpc("ad2ddfc0fa330e2f8c1ebdb05271f9ec359db94df383db864689b0e9ebb3fc3e"));
function recognitionCtor() {
	if (typeof window === "undefined") return null;
	const host = window;
	return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}
function hush() {
	if (typeof window === "undefined") return;
	window.speechSynthesis?.cancel();
}
function speak(text) {
	if (typeof window === "undefined" || !window.speechSynthesis) return;
	window.speechSynthesis.cancel();
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.rate = 1;
	utterance.pitch = .92;
	const voices = window.speechSynthesis.getVoices();
	const voice = voices.find((item) => /en/i.test(item.lang) && /male|david|daniel|aaron|guy/i.test(item.name)) ?? voices.find((item) => /en-US/i.test(item.lang));
	if (voice) utterance.voice = voice;
	window.speechSynthesis.speak(utterance);
}
function listen(handlers) {
	const Ctor = recognitionCtor();
	if (!Ctor) return null;
	const rec = new Ctor();
	rec.lang = "en-US";
	rec.continuous = false;
	rec.interimResults = true;
	rec.onresult = (event) => {
		let partial = "";
		let finalText = "";
		for (let i = event.resultIndex; i < event.results.length; i += 1) {
			const row = event.results[i];
			const said = row[0]?.transcript ?? "";
			if (row.isFinal) finalText += said;
			else partial += said;
		}
		if (partial.trim()) handlers.onPartial(partial.trim());
		if (finalText.trim()) handlers.onFinal(finalText.trim());
	};
	rec.onerror = (event) => {
		handlers.onError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "blocked" : "missed");
	};
	rec.onend = () => handlers.onEnd();
	try {
		rec.start();
	} catch {
		handlers.onError("missed");
		return null;
	}
	return { stop: () => {
		try {
			rec.abort();
		} catch {}
	} };
}
var CATEGORY_RANK = {
	Tops: 0,
	Bottoms: 1,
	Shoes: 2,
	Outer: 3,
	Hats: 4,
	Accessories: 5
};
var SLOT_RANK = [
	"front",
	"side",
	"threequarter",
	"extra"
];
var token = 0;
var hydrated = false;
var persistQueue = Promise.resolve();
function snapshot(state) {
	return {
		refs: state.refs,
		pieces: state.pieces,
		looks: state.looks,
		tickets: state.tickets,
		seq: state.seq,
		view: state.view,
		draft: state.draft,
		reaction: state.reaction,
		lastJob: state.lastJob
	};
}
function persist() {
	const data = snapshot(useLab.getState());
	persistQueue = persistQueue.then(() => idbSet("lab", data)).catch((error) => {
		if ((error instanceof DOMException ? error.name : "") === "QuotaExceededError") useLab.setState({ status: copy.storageFull });
	});
}
function sameScreen(stage, next) {
	return useLab.getState().view === stage ? next : useLab.getState().view;
}
function failLine(result) {
	return result && !result.ok && result.kind === "unavailable" ? copy.cantBuild : copy.missed;
}
async function shrink(image) {
	try {
		return await compressDataUrl(image);
	} catch {
		return image;
	}
}
function buildingLine(drafts) {
	if (drafts.length === 1) return `Got it. Building ${drafts[0].spoken.trim().slice(0, 80)}.`;
	return `Got it. Building ${drafts.length} pieces.`;
}
function patch(partial, remember = true) {
	useLab.setState(partial);
	if (remember) persist();
}
function nextId(prefix) {
	const seq = useLab.getState().seq + 1;
	useLab.setState({ seq });
	return `${prefix}-${String(seq).padStart(4, "0")}`;
}
function begin() {
	token += 1;
	useLab.setState({ busy: true });
	return token;
}
function alive(my) {
	return my === token;
}
function finish(my) {
	if (alive(my)) useLab.setState({ busy: false });
}
function stopGeneration() {
	token += 1;
	hush();
	useLab.setState({
		busy: false,
		status: copy.stopped
	});
}
function faces() {
	const refs = useLab.getState().refs;
	return SLOT_RANK.map((slot) => refs.find((ref) => ref.id === slot)?.dataUrl).filter((url) => Boolean(url));
}
function selectedPieces() {
	return useLab.getState().pieces.filter((piece) => piece.selected).sort((a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || a.createdAt - b.createdAt);
}
function spokenFrom(pieces) {
	return pieces.map((piece) => piece.spoken).join(", ");
}
function rememberTicket(ticket) {
	patch({ tickets: [ticket, ...useLab.getState().tickets].slice(0, 40) });
}
function noteStatus(status, line) {
	useLab.setState({ status });
	if (line) speak(line);
}
async function buildPieces(drafts, transcript, thenWear, again) {
	const my = begin();
	const started = useLab.getState().view;
	const previous = useLab.getState().lastJob;
	const previousIds = again && previous?.kind === "pieces" ? previous.pieceIds ?? [] : [];
	const line = buildingLine(drafts);
	noteStatus(line, line);
	patch({ lastJob: {
		kind: "pieces",
		drafts,
		transcript,
		thenWear,
		pieceIds: previousIds
	} });
	const made = [];
	let missed = 0;
	for (const draft of drafts) {
		if (!alive(my)) return;
		const ticketId = nextId("GEN");
		let result = null;
		try {
			result = await generatePiece({ data: {
				spoken: draft.spoken,
				category: draft.category
			} });
		} catch (error) {
			console.error(error);
			result = null;
		}
		if (!alive(my)) return;
		if (!result || !result.ok) {
			missed += 1;
			continue;
		}
		const image = await shrink(result.image);
		if (!alive(my)) return;
		const id = nextId("piece");
		patch({ pieces: [{
			id,
			category: draft.category,
			spoken: draft.spoken,
			sourceTranscript: transcript,
			image,
			selected: true,
			ticketId,
			createdAt: Date.now()
		}, ...useLab.getState().pieces].slice(0, 30) });
		rememberTicket({
			id: ticketId,
			type: "Piece",
			category: draft.category,
			characterRefIds: [],
			pieceRefIds: [],
			spokenDescription: draft.spoken,
			prompt: result.prompt,
			consistencyLocks: LOCK_LINE,
			output: id,
			status: again ? "Regenerated" : "Generated",
			createdAt: Date.now()
		});
		made.push(id);
	}
	if (!alive(my)) return;
	if (made.length === 0) {
		noteStatus(copy.missed, copy.missed);
		finish(my);
		return;
	}
	if (previousIds.length && made.length === drafts.length) patch({ pieces: useLab.getState().pieces.filter((piece) => !previousIds.includes(piece.id)) });
	patch({ lastJob: {
		kind: "pieces",
		drafts,
		transcript,
		thenWear,
		pieceIds: made
	} });
	if (!thenWear) {
		const done = missed ? copy.partial : copy.onBoard;
		noteStatus(done, done);
		patch({ view: sameScreen(started, "board") });
		finish(my);
		return;
	}
	await buildLook(my, again);
}
async function buildLook(my = begin(), again = false) {
	const picked = selectedPieces();
	if (picked.length === 0) {
		noteStatus(copy.pick);
		finish(my);
		return;
	}
	const spoken = spokenFrom(picked);
	noteStatus(copy.puttingOn, copy.puttingOn);
	patch({
		lastJob: { kind: "look" },
		view: "look"
	});
	const stage = "look";
	const ticketId = nextId("GEN");
	let result = null;
	try {
		result = await generateLook({ data: {
			mode: "look",
			spoken,
			characterImages: faces(),
			clothingImages: picked.map((piece) => piece.image)
		} });
	} catch (error) {
		console.error(error);
		result = null;
	}
	if (!alive(my)) return;
	if (!result || !result.ok) {
		const missedLine = failLine(result);
		noteStatus(missedLine, missedLine);
		finish(my);
		return;
	}
	const draft = {
		id: nextId("look"),
		image: await shrink(result.image),
		spoken,
		pieceIds: picked.map((piece) => piece.id),
		ticketId,
		createdAt: Date.now()
	};
	patch({
		draft,
		view: sameScreen(stage, "look")
	});
	rememberTicket({
		id: ticketId,
		type: "Full Look",
		category: "Full",
		characterRefIds: useLab.getState().refs.map((ref) => ref.id),
		pieceRefIds: draft.pieceIds,
		spokenDescription: spoken,
		prompt: result.prompt,
		consistencyLocks: LOCK_LINE,
		output: draft.id,
		status: again ? "Regenerated" : "Generated",
		createdAt: Date.now()
	});
	noteStatus(copy.sharp, copy.sharp);
	finish(my);
}
async function tweakLook(change, my = begin(), again = false) {
	const current = useLab.getState().draft;
	if (!current) {
		noteStatus(copy.noLook);
		finish(my);
		return;
	}
	noteStatus(copy.puttingOn, copy.puttingOn);
	patch({ lastJob: {
		kind: "tweak",
		change
	} });
	const ticketId = nextId("GEN");
	let result = null;
	try {
		result = await generateLook({ data: {
			mode: "tweak",
			spoken: change,
			baseSpoken: current.spoken,
			characterImages: faces(),
			lookImage: current.image
		} });
	} catch (error) {
		console.error(error);
		result = null;
	}
	if (!alive(my)) return;
	if (!result || !result.ok) {
		const missedLine = failLine(result);
		noteStatus(missedLine, missedLine);
		finish(my);
		return;
	}
	const draft = {
		id: nextId("look"),
		image: await shrink(result.image),
		spoken: `${current.spoken}. ${change}`,
		pieceIds: current.pieceIds,
		ticketId,
		createdAt: Date.now()
	};
	patch({
		draft,
		view: sameScreen("look", "look")
	});
	rememberTicket({
		id: ticketId,
		type: "Full Look",
		category: "Full",
		characterRefIds: useLab.getState().refs.map((ref) => ref.id),
		pieceRefIds: draft.pieceIds,
		spokenDescription: change,
		prompt: result.prompt,
		consistencyLocks: LOCK_LINE,
		output: draft.id,
		status: again ? "Regenerated" : "Generated",
		createdAt: Date.now()
	});
	noteStatus(copy.sharp, copy.sharp);
	finish(my);
}
async function walk(my = begin(), again = false) {
	const draft = useLab.getState().draft;
	if (!draft) {
		noteStatus(copy.noWalk);
		finish(my);
		return;
	}
	const reaction = useLab.getState().reaction;
	noteStatus(copy.walking, copy.walking);
	patch({
		lastJob: { kind: "video" },
		view: "runway"
	});
	const stage = "runway";
	const ticketId = nextId("GEN");
	let started = null;
	try {
		started = await startRunway({ data: {
			lookImage: draft.image,
			faceImage: faces()[0],
			spoken: draft.spoken,
			reaction
		} });
	} catch (error) {
		console.error(error);
		started = null;
	}
	if (!alive(my)) return;
	if (!started || !started.ok) {
		const missedLine = failLine(started);
		noteStatus(missedLine, missedLine);
		finish(my);
		return;
	}
	rememberTicket({
		id: ticketId,
		type: "Runway Video",
		category: "Video",
		characterRefIds: useLab.getState().refs.map((ref) => ref.id),
		pieceRefIds: draft.pieceIds,
		spokenDescription: draft.spoken,
		prompt: started.prompt,
		consistencyLocks: LOCK_LINE,
		status: "Pending",
		createdAt: Date.now()
	});
	let misses = 0;
	for (let attempt = 0; attempt < 45; attempt += 1) {
		if (!alive(my)) return;
		await new Promise((resolve) => setTimeout(resolve, 4e3));
		if (!alive(my)) return;
		let polled = null;
		try {
			polled = await pollRunway({ data: { requestId: started.requestId } });
		} catch (error) {
			console.error(error);
			polled = null;
		}
		if (!alive(my)) return;
		if (!polled || !polled.ok) {
			misses += 1;
			if (misses >= 3) {
				noteStatus(copy.missed, copy.missed);
				finish(my);
				return;
			}
			continue;
		}
		misses = 0;
		if (polled.status === "failed") {
			noteStatus(copy.missed, copy.missed);
			finish(my);
			return;
		}
		if (polled.status === "done" && polled.url) {
			const videoUrl = polled.url;
			const latest = useLab.getState().draft;
			if (latest && latest.id === draft.id) {
				const next = {
					...latest,
					videoUrl,
					videoReaction: reaction
				};
				patch({
					draft: next,
					looks: useLab.getState().looks.map((look) => look.id === next.id ? {
						...look,
						videoUrl,
						videoReaction: reaction
					} : look)
				});
			}
			patch({
				tickets: useLab.getState().tickets.map((ticket) => ticket.id === ticketId ? {
					...ticket,
					status: again ? "Regenerated" : "Generated",
					output: videoUrl
				} : ticket),
				view: sameScreen(stage, "runway")
			});
			noteStatus(copy.runwayUp);
			finish(my);
			return;
		}
	}
	if (!alive(my)) return;
	noteStatus(copy.missed, copy.missed);
	finish(my);
}
function runIntent(intent, view, text) {
	if (intent.type === "stop") {
		stopGeneration();
		return;
	}
	if (useLab.getState().busy) {
		useLab.setState({ status: copy.stillBuilding });
		return;
	}
	if (intent.type === "again") {
		const job = useLab.getState().lastJob;
		if (!job) {
			useLab.setState({ status: copy.unclear });
			return;
		}
		if (job.kind === "pieces") buildPieces(job.drafts, job.transcript, Boolean(job.thenWear), true);
		if (job.kind === "look") buildLook(begin(), true);
		if (job.kind === "tweak") tweakLook(job.change, begin(), true);
		if (job.kind === "video") walk(begin(), true);
		return;
	}
	if (intent.type === "save") {
		useLab.getState().saveDraft();
		return;
	}
	if (intent.type === "reaction") {
		patch({ reaction: intent.reaction });
		const status = intent.reaction === "boo" ? "Boo it is." : intent.reaction === "cheer" ? "Cheer it is." : "Both. Loud.";
		useLab.setState({ status });
		return;
	}
	if (intent.type === "runway") {
		if (intent.reaction) patch({ reaction: intent.reaction });
		walk();
		return;
	}
	if (intent.type === "wear") {
		buildLook();
		return;
	}
	if (view === "look" && (intent.type === "unclear" || intent.type === "pieces")) {
		if (text.trim().length < 3) {
			useLab.setState({ status: copy.unclear });
			return;
		}
		tweakLook(text);
		return;
	}
	if (view === "runway" && intent.type === "pieces") {
		useLab.setState({ status: copy.boardForPieces });
		return;
	}
	if (intent.type === "pieces") {
		buildPieces(intent.pieces, intent.transcript, intent.thenWear, false);
		return;
	}
	useLab.setState({ status: copy.unclear });
}
async function hydrate() {
	if (hydrated) return;
	hydrated = true;
	try {
		const data = await idbGet("lab");
		if (!data) {
			useLab.setState({
				ready: true,
				view: "lock",
				status: ""
			});
			return;
		}
		const locked = REQUIRED_SLOTS.every((slot) => data.refs?.some((ref) => ref.id === slot));
		const view = locked ? data.view === "lock" ? "hub" : data.view : "lock";
		const status = !locked ? "" : view === "look" && data.draft ? copy.sharp : view === "runway" ? copy.runwayUp : view === "hub" ? copy.boardOpen : "";
		useLab.setState({
			...data,
			refs: data.refs ?? [],
			pieces: data.pieces ?? [],
			looks: data.looks ?? [],
			tickets: data.tickets ?? [],
			seq: data.seq ?? 0,
			draft: data.draft ?? null,
			reaction: data.reaction ?? "both",
			lastJob: data.lastJob ?? null,
			view,
			ready: true,
			busy: false,
			status
		});
	} catch {
		useLab.setState({
			ready: true,
			view: "lock"
		});
	}
}
var useLab = create((set, get) => ({
	refs: [],
	pieces: [],
	looks: [],
	tickets: [],
	seq: 0,
	view: "lock",
	draft: null,
	reaction: "both",
	lastJob: null,
	ready: false,
	busy: false,
	status: "",
	setStatus: (status) => set({ status }),
	setView: (view) => {
		set({ view });
		persist();
	},
	setReaction: (reaction) => {
		set({ reaction });
		persist();
	},
	setRef: (ref) => {
		set({ refs: [...get().refs.filter((item) => item.id !== ref.id), ref] });
		persist();
	},
	togglePiece: (id) => {
		set({ pieces: get().pieces.map((piece) => piece.id === id ? {
			...piece,
			selected: !piece.selected
		} : piece) });
		persist();
	},
	dropPiece: (id) => {
		set({ pieces: get().pieces.filter((piece) => piece.id !== id) });
		persist();
	},
	lockIn: () => {
		if (!REQUIRED_SLOTS.every((slot) => get().refs.some((ref) => ref.id === slot))) return;
		set({
			view: "hub",
			status: copy.boardOpen
		});
		persist();
		speak(copy.lockedIn);
	},
	saveDraft: () => {
		const draft = get().draft;
		if (!draft) {
			set({ status: copy.noLook });
			return;
		}
		if (get().looks.some((look) => look.image === draft.image)) {
			set({ status: copy.already });
			speak(copy.saved);
			return;
		}
		set({
			looks: [{ ...draft }, ...get().looks].slice(0, 12),
			tickets: get().tickets.map((ticket) => ticket.id === draft.ticketId ? {
				...ticket,
				status: "Accepted"
			} : ticket),
			status: copy.saved
		});
		persist();
		speak(copy.saved);
	},
	openSaved: (id) => {
		const look = get().looks.find((item) => item.id === id);
		if (!look) return;
		set({
			draft: look,
			view: "look",
			status: copy.sharp
		});
		persist();
	},
	dropLook: (id) => {
		set({ looks: get().looks.filter((look) => look.id !== id) });
		persist();
	},
	handleTranscript: (text) => {
		const cleaned = text.trim();
		if (!cleaned) return;
		runIntent(interpret(cleaned), get().view, cleaned);
	},
	requestLook: () => {
		if (get().busy) {
			set({ status: copy.stillBuilding });
			return;
		}
		buildLook();
	},
	requestRunway: () => {
		if (get().busy) {
			set({ status: copy.stillBuilding });
			return;
		}
		if (get().draft?.videoUrl) {
			set({
				view: "runway",
				status: copy.runwayUp
			});
			persist();
			return;
		}
		walk();
	},
	retryReaction: () => {
		if (get().busy) {
			set({ status: copy.stillBuilding });
			return;
		}
		if (!get().draft) {
			set({ status: copy.noWalk });
			return;
		}
		walk(begin(), true);
	}
}));
function Composer({ placeholder = copy.typePiece, suggestions = [] }) {
	const busy = useLab((state) => state.busy);
	const status = useLab((state) => state.status);
	const setStatus = useLab((state) => state.setStatus);
	const handleTranscript = useLab((state) => state.handleTranscript);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [listening, setListening] = (0, import_react.useState)(false);
	const stopRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		return () => stopRef.current?.();
	}, []);
	(0, import_react.useEffect)(() => {
		function onKey(event) {
			if (event.key === "Escape" && useLab.getState().busy) {
				stopGeneration();
				stopRef.current?.();
				stopRef.current = null;
				setListening(false);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	function stopListen() {
		stopRef.current?.();
		stopRef.current = null;
		setListening(false);
	}
	function startListen() {
		const handle = listen({
			onPartial: (text) => setStatus(text),
			onFinal: (text) => {
				setDraft("");
				handleTranscript(text);
			},
			onError: (kind) => setStatus(kind === "blocked" ? copy.micBlocked : copy.missedSpeech),
			onEnd: () => {
				stopRef.current = null;
				setListening(false);
			}
		});
		if (!handle) {
			setStatus(copy.micBlocked);
			return;
		}
		stopRef.current = handle.stop;
		setListening(true);
		setStatus(copy.listening);
	}
	function onMic() {
		if (busy) {
			stopGeneration();
			stopListen();
			return;
		}
		if (listening) {
			stopListen();
			setStatus("");
			return;
		}
		startListen();
	}
	function onSubmit(event) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || busy) return;
		setDraft("");
		handleTranscript(text);
	}
	const micLabel = busy ? copy.stop : listening ? copy.listening : copy.talk;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		"aria-busy": busy,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit,
				className: "flex w-full gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "say",
					value: draft,
					onChange: (event) => setDraft(event.target.value),
					placeholder,
					"aria-label": placeholder,
					autoComplete: "off",
					disabled: busy
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					variant: "ghost",
					className: "min-w-16 shrink-0",
					disabled: busy || draft.trim().length === 0,
					children: copy.go
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onMic,
					"aria-label": micLabel,
					"aria-pressed": listening,
					className: cn("relative inline-flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-ink transition-[opacity,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink", busy || listening ? "bg-accent text-accent-fg" : "bg-cream text-fg", listening && "mic-live"),
					children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
						className: "size-5",
						fill: "currentColor"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-6" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-bold",
					children: micLabel
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Status, { text: status }),
			suggestions.length > 0 && !busy && draft.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: suggestions.map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => handleTranscript(suggestion),
					className: "h-11 rounded-full border-2 border-line bg-cream px-3 text-sm font-bold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
					children: suggestion
				}, suggestion))
			}) : null
		]
	});
}
var EXAMPLES$2 = [
	"black hoodie",
	"wool trousers",
	"leather loafers"
];
function BoardScreen() {
	const setView = useLab((state) => state.setView);
	const pieces = useLab((state) => state.pieces);
	const togglePiece = useLab((state) => state.togglePiece);
	const dropPiece = useLab((state) => state.dropPiece);
	const requestLook = useLab((state) => state.requestLook);
	const busy = useLab((state) => state.busy);
	const selected = pieces.filter((piece) => piece.selected).length;
	const filled = CATEGORIES.filter((category) => pieces.some((piece) => piece.category === category));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {
			title: copy.board,
			action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
				onClick: () => setView("hub"),
				children: copy.hub
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-h-0 flex-1 overflow-y-auto px-4 py-4",
			children: pieces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: copy.emptyBoard }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: copy.pick
				}), filled.map((category) => {
					const items = pieces.filter((piece) => piece.category === category);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-sm font-bold tracking-widest text-muted uppercase",
						children: category
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex gap-3 overflow-x-auto pb-1",
						children: items.map((piece) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "w-40 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => togglePiece(piece.id),
								"aria-pressed": piece.selected,
								className: cn("w-full overflow-hidden rounded-lg border-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink", piece.selected ? "border-pipe" : "border-line"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: piece.image,
										alt: "",
										className: "aspect-square w-full object-cover"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "line-clamp-2 block px-2 pt-2 text-xs text-muted",
										children: piece.spoken
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("block px-2 pb-2 text-xs font-bold", !piece.selected && "invisible"),
										children: copy.wearing
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => dropPiece(piece.id),
								"aria-label": `${copy.drop} ${piece.spoken}`,
								className: "mt-1 h-11 w-full rounded-md border-2 border-line text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
								children: copy.drop
							})]
						}, piece.id))
					})] }, category);
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "safe-bottom shrink-0 border-t border-line px-4 pt-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, { suggestions: pieces.length === 0 ? EXAMPLES$2 : [] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-3 w-full",
				size: "lg",
				disabled: busy || selected === 0,
				onClick: requestLook,
				children: selected > 0 ? `${copy.putOn} (${selected})` : copy.putOn
			})]
		})
	] });
}
var EXAMPLES$1 = [
	"black hoodie",
	"wool trousers",
	"leather loafers"
];
function HubScreen() {
	const setView = useLab((state) => state.setView);
	const draft = useLab((state) => state.draft);
	const looks = useLab((state) => state.looks);
	const pieces = useLab((state) => state.pieces);
	const openSaved = useLab((state) => state.openSaved);
	const dropLook = useLab((state) => state.dropLook);
	const [install, setInstall] = (0, import_react.useState)(null);
	const [hideInstall, setHideInstall] = (0, import_react.useState)(false);
	const wearing = pieces.filter((piece) => piece.selected).length;
	(0, import_react.useEffect)(() => {
		const onPrompt = (event) => {
			event.preventDefault();
			setInstall(event);
		};
		window.addEventListener("beforeinstallprompt", onPrompt);
		return () => window.removeEventListener("beforeinstallprompt", onPrompt);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {
			title: copy.title,
			action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
				onClick: () => setView("lock"),
				children: copy.face
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
				onClick: () => setView("board"),
				children: copy.board
			})] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-4 py-4 *:shrink-0",
			children: [
				pieces.length === 0 && !draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-lg italic",
						children: copy.crown
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: copy.hubJob })]
				}) : null,
				pieces.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted",
					children: [
						pieces.length,
						" pieces on the board. ",
						wearing,
						" selected."
					]
				}) : null,
				draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setView("look"),
					className: "text-left",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: draft.image,
						alt: "",
						className: "seam aspect-3/4 w-full object-cover"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-2 line-clamp-2 block text-sm",
						children: draft.spoken
					})]
				}) : null,
				looks.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-sm font-bold tracking-widest text-ink uppercase",
					children: copy.savedHead
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 flex gap-3 overflow-x-auto pb-2",
					children: looks.map((look) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-28 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => openSaved(look.id),
							className: "w-full text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: look.image,
								alt: "",
								className: "seam aspect-3/4 w-full object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 line-clamp-2 block text-xs text-muted",
								children: look.spoken
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => dropLook(look.id),
							"aria-label": `${copy.drop} ${look.spoken}`,
							className: "mt-1 h-11 w-full rounded-md border-2 border-line text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
							children: copy.drop
						})]
					}, look.id))
				})] }) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
					className: "border-2 border-ink bg-mint px-3 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
							className: "font-display text-sm font-extrabold tracking-widest uppercase",
							children: copy.keepIt
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm",
							children: copy.pinned
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm",
							children: copy.installHow
						}),
						install && !hideInstall ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
								onClick: () => {
									install.prompt();
									setHideInstall(true);
								},
								children: copy.add
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
								onClick: () => setHideInstall(true),
								children: copy.notNow
							})]
						}) : null
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "safe-bottom shrink-0 border-t border-line px-4 pt-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, { suggestions: EXAMPLES$1 })
		})
	] });
}
var SLOT_ORDER = [
	"front",
	"side",
	"threequarter",
	"extra"
];
function LockScreen() {
	const refs = useLab((state) => state.refs);
	const setRef = useLab((state) => state.setRef);
	const lockIn = useLab((state) => state.lockIn);
	const status = useLab((state) => state.status);
	const videoRef = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	const streamRef = (0, import_react.useRef)(null);
	const [live, setLive] = (0, import_react.useState)(false);
	const [note, setNote] = (0, import_react.useState)("");
	const [slot, setSlot] = (0, import_react.useState)("front");
	(0, import_react.useEffect)(() => {
		return () => {
			streamRef.current?.getTracks().forEach((track) => track.stop());
		};
	}, []);
	const ready = REQUIRED_SLOTS.every((id) => refs.some((ref) => ref.id === id));
	const got = REQUIRED_SLOTS.filter((id) => refs.some((ref) => ref.id === id)).length;
	const missing = REQUIRED_SLOTS.filter((id) => !refs.some((ref) => ref.id === id)).map((id) => copy.slots[id]);
	const active = refs.find((ref) => ref.id === slot);
	async function openCamera() {
		if (!navigator.mediaDevices?.getUserMedia) {
			setNote(copy.cameraBlocked);
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "user" },
				audio: false
			});
			streamRef.current = stream;
			setLive(true);
			setNote("");
		} catch {
			setNote(copy.cameraBlocked);
		}
	}
	(0, import_react.useEffect)(() => {
		if (!live || !videoRef.current || !streamRef.current) return;
		videoRef.current.srcObject = streamRef.current;
		videoRef.current.play().catch(() => void 0);
	}, [live]);
	async function savePhoto(dataUrl, target) {
		const image = await compressDataUrl(dataUrl);
		setRef({
			id: target,
			dataUrl: image,
			createdAt: Date.now()
		});
		const next = REQUIRED_SLOTS.find((id) => id !== target && !useLab.getState().refs.some((ref) => ref.id === id));
		if (next) setSlot(next);
	}
	function shoot() {
		const video = videoRef.current;
		if (!video) return;
		const frame = frameToDataUrl(video, 800, .72, true);
		if (!frame) {
			setNote(copy.cameraWait);
			return;
		}
		setNote("");
		savePhoto(frame, slot);
	}
	async function onFile(file) {
		if (!file || !file.type.startsWith("image/")) {
			setNote(copy.notPhoto);
			return;
		}
		try {
			await savePhoto(await readFileAsDataUrl(file), slot);
			setNote("");
		} catch {
			setNote(copy.notPhoto);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, { title: copy.yourFace }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 *:shrink-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: copy.lockLead }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "seam overflow-hidden bg-lilac",
					children: live ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						ref: videoRef,
						className: "aspect-4/3 max-h-56 w-full -scale-x-100 object-cover",
						playsInline: true,
						muted: true,
						autoPlay: true,
						"aria-label": `${copy.takePhoto}, ${copy.slots[slot]}`
					}) : active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: active.dataUrl,
						alt: "",
						className: "aspect-4/3 max-h-56 w-full object-cover"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex aspect-4/3 max-h-56 items-center justify-center px-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-center text-muted",
							children: copy.slots[slot]
						})
					})
				}),
				live ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: shoot,
						"aria-label": `${copy.takePhoto}, ${copy.slots[slot]}`,
						className: "size-16 shrink-0 rounded-full border-4 border-fg bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-sm font-bold",
						children: [
							copy.takePhoto,
							": ",
							copy.slots[slot]
						]
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "w-full",
					size: "lg",
					onClick: () => void openCamera(),
					children: copy.openCamera
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-4 gap-2",
					children: SLOT_ORDER.map((id) => {
						const photo = refs.find((ref) => ref.id === id);
						const label = copy.slots[id];
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSlot(id),
							"aria-pressed": slot === id,
							"aria-label": `${label}${id === "extra" ? `, ${copy.optional}` : ""}${photo ? ", photo added" : ", empty"}`,
							className: cn("overflow-hidden rounded-md border-2 bg-cream text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink", slot === id ? "border-pipe" : "border-line"),
							children: [photo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: photo.dataUrl,
								alt: "",
								className: "aspect-square w-full object-cover"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "block aspect-square bg-lilac" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "block px-1 py-1 text-center text-xs font-bold text-ink",
								children: [label, id === "extra" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block font-medium text-muted",
									children: copy.optional
								}) : null]
							})]
						}, id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "w-full",
					size: "lg",
					variant: "ghost",
					onClick: () => fileRef.current?.click(),
					children: copy.usePhoto
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "photo",
					ref: fileRef,
					type: "file",
					accept: "image/*",
					tabIndex: -1,
					"aria-hidden": "true",
					className: "sr-only",
					onChange: (event) => {
						onFile(event.target.files?.[0]);
						event.target.value = "";
					}
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Status, { text: note || status }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: copy.stay
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "safe-bottom shrink-0 border-t border-line px-4 pt-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-center text-sm",
				children: ready ? copy.lockCount : `${got} of 3. Still need ${missing.join(", ")}.`
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "w-full",
				size: "lg",
				disabled: !ready,
				onClick: lockIn,
				children: copy.usePhotos
			})]
		})
	] });
}
var EXAMPLES = [
	"make it black",
	"add a hat",
	"shorter coat"
];
function LookScreen() {
	const setView = useLab((state) => state.setView);
	const draft = useLab((state) => state.draft);
	const busy = useLab((state) => state.busy);
	const saveDraft = useLab((state) => state.saveDraft);
	const requestRunway = useLab((state) => state.requestRunway);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {
			title: copy.look,
			action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
				onClick: () => setView("hub"),
				children: copy.hub
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
				onClick: () => setView("board"),
				children: copy.board
			})] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 *:shrink-0",
			children: draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
				className: "flex flex-col items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: draft.image,
					alt: draft.spoken,
					className: cn("seam mx-auto max-h-72 max-w-full object-contain", busy && "pending-pulse")
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
					className: "text-center text-sm text-muted",
					children: draft.spoken
				})]
			}) : busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "pending-pulse text-center text-lg",
				children: copy.puttingOn
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-center gap-3 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: copy.nothingOn }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: () => setView("board"),
					children: copy.openBoard
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "safe-bottom shrink-0 border-t border-line px-4 pt-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-sm text-muted",
					children: copy.runwayHint
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, {
					placeholder: copy.changeHint,
					suggestions: draft ? EXAMPLES : []
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						disabled: !draft || busy,
						onClick: saveDraft,
						children: copy.saveThis
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						disabled: !draft || busy,
						onClick: requestRunway,
						children: copy.runway
					})]
				})
			]
		})
	] });
}
var CHOICES = [
	{
		id: "cheer",
		label: copy.cheer
	},
	{
		id: "boo",
		label: copy.boo
	},
	{
		id: "both",
		label: copy.both
	}
];
function RunwayScreen() {
	const setView = useLab((state) => state.setView);
	const draft = useLab((state) => state.draft);
	const reaction = useLab((state) => state.reaction);
	const setReaction = useLab((state) => state.setReaction);
	const busy = useLab((state) => state.busy);
	const status = useLab((state) => state.status);
	const retryReaction = useLab((state) => state.retryReaction);
	const [broken, setBroken] = (0, import_react.useState)(false);
	const videoUrl = draft?.videoUrl;
	(0, import_react.useEffect)(() => {
		setBroken(false);
	}, [videoUrl]);
	const shot = draft?.videoReaction;
	const mismatch = Boolean(videoUrl && shot && shot !== reaction);
	const shotLabel = CHOICES.find((choice) => choice.id === shot)?.label;
	function move(direction, group) {
		const next = CHOICES[(CHOICES.findIndex((choice) => choice.id === reaction) + direction + CHOICES.length) % CHOICES.length];
		setReaction(next.id);
		group.querySelector(`[data-reaction="${next.id}"]`)?.focus();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {
		title: copy.runway,
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
			onClick: () => setView("look"),
			children: copy.look
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "seam flex min-h-48 w-full flex-1 items-center justify-center overflow-hidden bg-surface",
			children: videoUrl && !broken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				src: videoUrl,
				className: "max-h-full w-full bg-bg object-contain",
				controls: true,
				playsInline: true,
				autoPlay: true,
				onError: () => setBroken(true)
			}, videoUrl) : draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: draft.image,
				alt: draft.spoken,
				className: "max-h-full w-full object-contain"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "p-6 text-center text-muted",
				children: copy.noWalk
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex shrink-0 flex-col gap-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					"aria-live": "polite",
					className: "text-center text-muted",
					children: broken ? copy.clipGone : busy ? copy.walking : status
				}),
				mismatch && shotLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-center text-sm",
					children: [
						copy.reshootNote,
						" Last walk: ",
						shotLabel,
						"."
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-2 text-sm text-muted",
					id: "judges-label",
					children: copy.judges
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "radiogroup",
					"aria-labelledby": "judges-label",
					className: "grid grid-cols-3 gap-2",
					onKeyDown: (event) => {
						if (event.key === "ArrowRight" || event.key === "ArrowDown") {
							event.preventDefault();
							move(1, event.currentTarget);
						}
						if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
							event.preventDefault();
							move(-1, event.currentTarget);
						}
					},
					children: CHOICES.map((choice) => {
						const selected = reaction === choice.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							role: "radio",
							"data-reaction": choice.id,
							"aria-checked": selected,
							tabIndex: selected ? 0 : -1,
							onClick: () => setReaction(choice.id),
							className: cn("h-12 rounded-md border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink", selected ? "border-ink bg-accent font-extrabold text-accent-fg" : "border-line bg-cream text-fg"),
							children: choice.label
						}, choice.id);
					})
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: mismatch || broken ? "primary" : "ghost",
					disabled: busy || !draft,
					onClick: retryReaction,
					children: copy.tryReaction
				})
			]
		})]
	})] });
}
function LabApp() {
	const ready = useLab((state) => state.ready);
	const view = useLab((state) => state.view);
	const refs = useLab((state) => state.refs);
	const locked = REQUIRED_SLOTS.every((slot) => refs.some((ref) => ref.id === slot));
	const [open, setOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		hydrate();
	}, []);
	(0, import_react.useEffect)(() => {
		if (sessionStorage.getItem("sr-open") === "1") setOpen(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js").catch(() => void 0);
	}, []);
	(0, import_react.useEffect)(() => {
		const titles = {
			lock: copy.yourFace,
			hub: copy.title,
			board: copy.board,
			look: copy.look,
			runway: copy.runway
		};
		document.title = open ? `${titles[view] ?? copy.title} · ${copy.lab}` : copy.title;
	}, [open, view]);
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, {});
	if (!open) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, { onEnter: () => {
		sessionStorage.setItem("sr-open", "1");
		setOpen(true);
	} });
	if (!locked || view === "lock") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockScreen, {});
	if (view === "board") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoardScreen, {});
	if (view === "look") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LookScreen, {});
	if (view === "runway") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunwayScreen, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HubScreen, {});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LabApp, {});
}
//#endregion
export { Home as component };
