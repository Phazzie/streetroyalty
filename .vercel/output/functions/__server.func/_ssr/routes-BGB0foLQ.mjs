import { i as __toESM } from "../_runtime.mjs";
import { a as interpret, i as SLOTS, n as LOCK_LINE, r as REQUIRED_SLOTS, t as CATEGORIES } from "./tickets-DTwv3wmS.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { i as Mic, r as Square, t as X } from "../_libs/lucide-react.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BGB0foLQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 font-medium transition-[opacity,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg active:scale-[0.98]", {
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
	lockLead: "Three photos of you. Front, side, and three-quarter. He stays on the edges. This locks your face.",
	lockCount: "Locked in turns on at 3.",
	stay: "Stays on this phone until you build a look.",
	lockedIn: "Locked in.",
	boardOpen: "Board's open. What are we building.",
	sharp: "That one's sharp. Want to run it or tweak it.",
	buildingThose: "Got it. Building those.",
	buildingOne: "Got it. Building that.",
	onBoard: "On the board.",
	puttingOn: "Putting it on you.",
	runwayUp: "Runway's up.",
	walking: "Walking.",
	saved: "Saved.",
	already: "Already saved.",
	stopped: "Stopped.",
	emptyBoard: "Nothing on the board yet. Say a piece: shirt, trousers, coat, hat, shoes.",
	missed: "That one didn't land. Say it again or try different words.",
	partial: "One of those didn't land. The rest are up.",
	unclear: "Name the piece. Top, bottoms, shoes, or what.",
	pick: "Tap what you're wearing. Then put it on you.",
	noLook: "Nothing to put on yet.",
	micBlocked: "Mic's blocked. Type it.",
	missedSpeech: "Didn't catch that. Say it again.",
	cameraBlocked: "Camera's blocked. Use a photo.",
	stillBuilding: "Still building. Hit stop if you want it cut.",
	hubJob: "Say the clothes. A top, bottoms, shoes, a hat. Open the board, tap what you're wearing, then put it on you.",
	runwayHint: "Runway is the walk. Cheer, boo, or both is the crowd.",
	splashLead: "House model on the sides. Your face in the camera.",
	splashSteps: "Three photos of you. Say the pieces. Put it on you. Runway if you want the walk.",
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
	tryReaction: "Try another reaction",
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
		extra: "One more"
	}
};
var LILAC = "/wild/side-lilac.jpg";
var MINT = "/wild/side-mint.jpg";
var BOW = "/wild/bowtie.jpg";
var STRIDE = "/wild/stride.jpg";
function Shell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mess-field flex min-h-dvh justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "phone-frame relative flex h-dvh w-full max-w-md flex-col overflow-hidden bg-cream text-fg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "edge-gutter relative z-10 flex min-h-0 min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Marquee, {}), children]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Edges, {})]
		})
	});
}
function Edges() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-30",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: LILAC,
				alt: "",
				className: "edge-still edge-still-left"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: MINT,
				alt: "",
				className: "edge-still edge-still-right"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				className: "walker walker-left",
				src: "/wild/walk-lilac.mp4",
				muted: true,
				playsInline: true,
				autoPlay: true,
				loop: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				className: "walker walker-right",
				src: "/wild/walk-mint.mp4",
				muted: true,
				playsInline: true,
				autoPlay: true,
				loop: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				className: "walker walker-left walker-late",
				src: "/wild/walk-bow.mp4",
				muted: true,
				playsInline: true,
				autoPlay: true,
				loop: true
			})
		]
	});
}
function Marquee() {
	const line = "Lilac set  ·  Mint set  ·  Gold rims  ·  Cafe table  ·  No reservation  ·  ";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mash-bar edge-b overflow-hidden text-cream",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "marquee-track py-1.5 font-display text-xs font-bold tracking-widest uppercase",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "px-3",
				children: line
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "px-3",
				"aria-hidden": "true",
				children: line
			})]
		})
	});
}
function Header({ action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "banner-head safe-top flex flex-col gap-2 px-4 pb-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-display text-xs font-bold tracking-widest text-ink uppercase",
			children: copy.lab
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-display text-2xl font-extrabold leading-none tracking-tight text-ink",
			children: copy.title
		})] }), action ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-1",
			children: action
		}) : null]
	});
}
function TextButton({ children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "h-11 rounded-full bg-cream px-3 text-sm font-bold text-ink transition-opacity duration-150 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
		children
	});
}
function Splash({ onEnter }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mess-field flex min-h-dvh items-center justify-center text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "phone-frame flex h-dvh w-full max-w-md flex-col overflow-hidden bg-cream",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid shrink-0 grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: LILAC,
							alt: "House model in the lilac set, full body",
							className: "aspect-3/4 w-full object-cover object-top"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: BOW,
							alt: "House model in a lilac set with a huge patterned bowtie",
							className: "edge-l edge-r aspect-3/4 w-full object-cover object-top"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: STRIDE,
							alt: "House model mid-stride in the mint set",
							className: "aspect-3/4 w-full object-cover object-top"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-3xl font-extrabold leading-none tracking-tight",
							children: copy.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "italic",
							children: copy.splashLead
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: copy.splashSteps })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "safe-bottom border-t border-line px-5 pt-3",
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
		className: "min-h-6 px-4 text-center text-base text-muted",
		children: text
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-12 w-full rounded-md border-2 border-ink bg-cream px-3 text-base text-fg outline-none placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pipe", className),
		...props
	});
}
var DB_NAME = "street-royalty";
var STORE = "kv";
function openDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
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
	});
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
	persistQueue = persistQueue.then(() => idbSet("lab", data)).catch(() => void 0);
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
	const line = drafts.length > 1 ? copy.buildingThose : copy.buildingOne;
	noteStatus(line, line);
	patch({ lastJob: {
		kind: "pieces",
		drafts,
		transcript
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
		const id = nextId("piece");
		patch({ pieces: [{
			id,
			category: draft.category,
			spoken: draft.spoken,
			sourceTranscript: transcript,
			image: result.image,
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
	if (!thenWear) {
		noteStatus(missed ? copy.partial : copy.onBoard);
		patch({ view: "board" });
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
		noteStatus(result && !result.ok && result.kind === "unavailable" ? copy.cantBuild : copy.missed, copy.missed);
		finish(my);
		return;
	}
	const draft = {
		id: nextId("look"),
		image: result.image,
		spoken,
		pieceIds: picked.map((piece) => piece.id),
		ticketId,
		createdAt: Date.now()
	};
	patch({
		draft,
		view: "look"
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
		noteStatus(result && !result.ok && result.kind === "unavailable" ? copy.cantBuild : copy.missed, copy.missed);
		finish(my);
		return;
	}
	const draft = {
		id: nextId("look"),
		image: result.image,
		spoken: `${current.spoken}. ${change}`,
		pieceIds: current.pieceIds,
		ticketId,
		createdAt: Date.now()
	};
	patch({
		draft,
		view: "look"
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
	noteStatus(copy.walking, copy.runwayUp);
	patch({
		lastJob: { kind: "video" },
		view: "runway"
	});
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
		noteStatus(started && !started.ok && started.kind === "unavailable" ? copy.cantBuild : copy.missed, copy.missed);
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
			noteStatus(copy.missed, copy.missed);
			finish(my);
			return;
		}
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
					videoUrl
				};
				patch({
					draft: next,
					looks: useLab.getState().looks.map((look) => look.id === next.id ? {
						...look,
						videoUrl
					} : look)
				});
			}
			patch({
				tickets: useLab.getState().tickets.map((ticket) => ticket.id === ticketId ? {
					...ticket,
					status: again ? "Regenerated" : "Generated",
					output: videoUrl
				} : ticket),
				view: "runway"
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
		if (job.kind === "pieces") buildPieces(job.drafts, job.transcript, false, true);
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
		if (text.trim().length < 8) {
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
function Composer({ prominent = false, flush = false }) {
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
		if (!text) return;
		setDraft("");
		handleTranscript(text);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onMic,
				"aria-label": busy ? copy.stop : copy.talk,
				"aria-pressed": listening,
				className: cn("relative inline-flex items-center justify-center rounded-full transition-[opacity,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg", prominent ? "size-32" : "size-16", busy || prominent ? "border-2 border-ink bg-accent text-accent-fg" : "border-2 border-ink bg-cream text-fg", listening && "mic-live"),
				children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
					className: prominent ? "size-8" : "size-5",
					fill: "currentColor"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: prominent ? "size-10" : "size-6" })
			}),
			busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: copy.stop
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Status, { text: status }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit,
				className: cn("flex w-full gap-2", !flush && "px-5"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "say",
					value: draft,
					onChange: (event) => setDraft(event.target.value),
					placeholder: copy.typeIt,
					"aria-label": copy.typeIt,
					autoComplete: "off"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					variant: "ghost",
					className: "shrink-0",
					children: copy.go
				})]
			})
		]
	});
}
function BoardScreen() {
	const setView = useLab((state) => state.setView);
	const pieces = useLab((state) => state.pieces);
	const togglePiece = useLab((state) => state.togglePiece);
	const dropPiece = useLab((state) => state.dropPiece);
	const requestLook = useLab((state) => state.requestLook);
	const busy = useLab((state) => state.busy);
	const selected = pieces.some((piece) => piece.selected);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, { action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
			onClick: () => setView("hub"),
			children: copy.hub
		}) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-h-0 flex-1 overflow-y-auto py-4",
			children: [pieces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-1 pb-4",
				children: copy.emptyBoard
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-1 pb-3 text-sm text-muted",
				children: copy.pick
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-col gap-5",
				children: CATEGORIES.map((category) => {
					const items = pieces.filter((piece) => piece.category === category);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "px-5 text-sm font-medium text-muted",
						children: category
					}), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-5 py-4 text-sm text-subtle",
						children: copy.empty
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex gap-3 overflow-x-auto px-5 pb-1",
						children: items.map((piece) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative w-40 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => togglePiece(piece.id),
								"aria-pressed": piece.selected,
								className: cn("w-full overflow-hidden rounded-lg border-2 text-left", piece.selected ? "border-pipe" : "border-line"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: piece.image,
										alt: piece.spoken,
										className: "aspect-square w-full object-cover"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "clamp-2 block px-2 py-2 text-xs text-muted",
										children: piece.spoken
									}),
									piece.selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block px-2 pb-2 text-xs font-medium",
										children: copy.on
									}) : null
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-label": copy.drop,
								onClick: () => dropPiece(piece.id),
								className: "absolute top-1 right-1 flex size-11 items-center justify-center rounded-full bg-bg/80 text-fg",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						}, piece.id))
					})] }, category);
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "safe-bottom border-t border-line px-5 pt-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, { flush: true })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "w-full",
				size: "lg",
				disabled: busy || !selected,
				onClick: requestLook,
				children: copy.putOn
			})]
		})
	] });
}
function HubScreen() {
	const setView = useLab((state) => state.setView);
	const draft = useLab((state) => state.draft);
	const looks = useLab((state) => state.looks);
	const pieces = useLab((state) => state.pieces);
	const openSaved = useLab((state) => state.openSaved);
	const [install, setInstall] = (0, import_react.useState)(null);
	const [hideInstall, setHideInstall] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const onPrompt = (event) => {
			event.preventDefault();
			setInstall(event);
		};
		window.addEventListener("beforeinstallprompt", onPrompt);
		return () => window.removeEventListener("beforeinstallprompt", onPrompt);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, { action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
			onClick: () => setView("lock"),
			children: copy.face
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
			onClick: () => setView("board"),
			children: copy.board
		})]
	}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto py-5",
		children: [
			pieces.length === 0 && !draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2 px-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-lg italic",
					children: copy.crown
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: copy.hubJob })]
			}) : null,
			draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setView("look"),
				className: "px-4 text-left",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: draft.image,
					alt: draft.spoken,
					className: "seam aspect-3/4 w-full object-cover"
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, { prominent: true }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mx-4 border-2 border-dashed border-ink bg-mint px-3 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xs font-extrabold tracking-widest uppercase",
						children: "Keep it"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm",
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
			}),
			looks.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "px-4 font-display text-sm font-bold tracking-widest text-ink uppercase",
				children: copy.savedHead
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex gap-3 overflow-x-auto px-4 pb-2",
				children: looks.map((look) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => openSaved(look.id),
					className: "w-24 shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: look.image,
						alt: look.spoken,
						className: "seam aspect-3/4 w-full object-cover"
					})
				}, look.id))
			})] }) : null
		]
	})] });
}
function compressDataUrl(dataUrl, maxEdge = 800, quality = .72) {
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
function readFileAsDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
function frameToDataUrl(video, maxEdge = 800, quality = .72) {
	const width = video.videoWidth;
	const height = video.videoHeight;
	if (!width || !height) return null;
	const scale = Math.min(1, maxEdge / Math.max(width, height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/jpeg", quality);
}
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
		const next = SLOTS.find((id) => id !== target && !useLab.getState().refs.some((ref) => ref.id === id));
		if (next) setSlot(next);
	}
	function shoot() {
		const video = videoRef.current;
		if (!video) return;
		const frame = frameToDataUrl(video);
		if (!frame) return;
		savePhoto(frame, slot);
	}
	async function onFile(file) {
		if (!file || !file.type.startsWith("image/")) {
			setNote(copy.missed);
			return;
		}
		try {
			await savePhoto(await readFileAsDataUrl(file), slot);
			setNote("");
		} catch {
			setNote(copy.missed);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-base",
					children: copy.lockLead
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: copy.lockCount
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "seam overflow-hidden bg-lilac",
					children: live ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						ref: videoRef,
						className: "aspect-square w-full object-cover",
						playsInline: true,
						muted: true,
						autoPlay: true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex aspect-square flex-col items-center justify-end p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "w-full",
							size: "lg",
							onClick: () => void openCamera(),
							children: copy.openCamera
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-4 gap-2",
					children: SLOTS.map((id) => {
						const photo = refs.find((ref) => ref.id === id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSlot(id),
							className: cn("overflow-hidden rounded-md border-2 text-left", slot === id ? "border-2 border-pipe" : "border-2 border-line"),
							children: photo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: photo.dataUrl,
								alt: copy.slots[id],
								className: "aspect-square w-full object-cover"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex aspect-square items-end p-1.5 text-xs text-subtle",
								children: copy.slots[id]
							})
						}, id);
					})
				}),
				live ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: shoot,
						"aria-label": copy.slots[slot],
						className: "size-20 rounded-full border-4 border-fg bg-accent transition-[opacity,transform] duration-150 active:scale-[0.98]"
					})
				}) : null,
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
					className: "sr-only",
					onChange: (event) => {
						onFile(event.target.files?.[0]);
						event.target.value = "";
					}
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Status, { text: note || status }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-subtle",
					children: copy.stay
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "safe-bottom border-t border-line px-3 pt-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mb-2 text-center text-sm",
				children: [got, " of 3"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "w-full",
				size: "lg",
				disabled: !ready,
				onClick: lockIn,
				children: copy.lockedIn
			})]
		})
	] });
}
function LookScreen() {
	const setView = useLab((state) => state.setView);
	const draft = useLab((state) => state.draft);
	const busy = useLab((state) => state.busy);
	const saveDraft = useLab((state) => state.saveDraft);
	const requestRunway = useLab((state) => state.requestRunway);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, { action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
				onClick: () => setView("hub"),
				children: copy.hub
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
				onClick: () => setView("board"),
				children: copy.board
			})]
		}) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex min-h-0 flex-1 items-center justify-center px-5 py-4",
			children: draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: draft.image,
				alt: draft.spoken,
				className: "seam max-h-full max-w-full object-contain"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "aspect-3/4 w-full rounded-xl bg-surface" })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "safe-bottom border-t border-line px-5 pt-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-center text-sm",
					children: copy.runwayHint
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-3 text-center text-sm text-muted",
					children: copy.change
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, { flush: true }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid grid-cols-2 gap-3",
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, { action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
		onClick: () => setView("look"),
		children: copy.look
	}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "seam overflow-hidden bg-surface",
				children: draft?.videoUrl && !broken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: draft.videoUrl,
					className: "aspect-9/16 max-h-[28rem] w-full bg-bg object-contain",
					controls: true,
					playsInline: true,
					autoPlay: true,
					onError: () => setBroken(true)
				}, draft.videoUrl) : draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: draft.image,
					alt: draft.spoken,
					className: "aspect-9/16 max-h-[28rem] w-full object-cover"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "aspect-9/16 w-full" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				"aria-live": "polite",
				className: "text-center text-muted",
				children: broken ? copy.clipGone : status
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-sm text-muted",
				children: copy.judges
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "radiogroup",
				"aria-label": copy.judges,
				className: "grid grid-cols-3 gap-2",
				children: CHOICES.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					role: "radio",
					"aria-checked": reaction === choice.id,
					onClick: () => setReaction(choice.id),
					className: cn("h-12 rounded-md border text-sm font-medium", reaction === choice.id ? "border-ink bg-accent font-extrabold text-accent-fg" : "border-line bg-cream text-fg"),
					children: choice.label
				}, choice.id))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "ghost",
				disabled: busy || !draft,
				onClick: retryReaction,
				children: copy.tryReaction
			})
		]
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
