//#region node_modules/.nitro/vite/services/ssr/assets/tickets-B6Ik5l_m.js
var CATEGORIES = [
	"Tops",
	"Bottoms",
	"Outer",
	"Hats",
	"Shoes",
	"Accessories"
];
var REQUIRED_SLOTS = [
	"front",
	"side",
	"threequarter"
];
var LEX = [
	{
		category: "Hats",
		words: [
			"bucket hat",
			"beanie",
			"fedora",
			"durag",
			"headwrap",
			"beret",
			"hat",
			"cap"
		]
	},
	{
		category: "Shoes",
		words: [
			"sneakers",
			"sneaker",
			"loafers",
			"loafer",
			"boots",
			"boot",
			"heels",
			"heel",
			"sandals",
			"sandal",
			"trainers",
			"trainer",
			"jordans",
			"jordan",
			"shoes",
			"shoe"
		]
	},
	{
		category: "Outer",
		words: [
			"jean jacket",
			"denim jacket",
			"leather jacket",
			"overcoat",
			"cardigan",
			"trench",
			"bomber",
			"parka",
			"blazer",
			"puffer",
			"jacket",
			"coat"
		]
	},
	{
		category: "Bottoms",
		words: [
			"trousers",
			"trouser",
			"pants",
			"jeans",
			"joggers",
			"jogger",
			"cargos",
			"cargo",
			"slacks",
			"shorts",
			"skirt",
			"skirts",
			"jean",
			"slack"
		]
	},
	{
		category: "Tops",
		words: [
			"tank top",
			"crop top",
			"tube top",
			"polo shirt",
			"t-shirt",
			"tshirt",
			"hoodie",
			"sweater",
			"jumper",
			"jersey",
			"blouse",
			"shirt",
			"polo",
			"tank",
			"vest",
			"tee",
			"top",
			"tops"
		]
	},
	{
		category: "Accessories",
		words: [
			"sunglasses",
			"glasses",
			"bracelet",
			"earrings",
			"earring",
			"necklace",
			"pendant",
			"gloves",
			"glove",
			"chain",
			"watch",
			"scarf",
			"belt",
			"ring",
			"rings",
			"bag",
			"cuff"
		]
	}
];
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function findHits(text) {
	const entries = LEX.flatMap((entry) => entry.words.map((word) => ({
		word,
		category: entry.category
	}))).sort((a, b) => b.word.length - a.word.length);
	const taken = new Array(text.length).fill(false);
	for (const phrase of SKIP_PHRASES) {
		const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi");
		for (const match of text.matchAll(re)) {
			const index = match.index ?? 0;
			for (let i = index; i < index + match[0].length; i += 1) taken[i] = true;
		}
	}
	const hits = [];
	for (const entry of entries) {
		const re = new RegExp(`\\b${escapeRegExp(entry.word)}\\b`, "gi");
		for (const match of text.matchAll(re)) {
			const index = match.index ?? 0;
			const length = match[0].length;
			if (taken.slice(index, index + length).some(Boolean)) continue;
			for (let i = index; i < index + length; i += 1) taken[i] = true;
			hits.push({
				index,
				length,
				category: entry.category
			});
		}
	}
	hits.sort((a, b) => a.index - b.index);
	return hits;
}
var SKIP_PHRASES = [
	"short sleeve",
	"short-sleeve",
	"boot cut",
	"boot-cut",
	"bootcut"
];
var SEPARATORS = [
	",",
	";",
	" and ",
	" plus ",
	" tucked into ",
	" paired with "
];
function boundaryBefore(text, matchIndex, prevStart, prevEnd) {
	const lower = text.slice(prevStart, matchIndex).toLowerCase();
	let rel = -1;
	let sepLen = 0;
	for (const sep of SEPARATORS) {
		const at = lower.lastIndexOf(sep);
		if (at > rel) {
			rel = at;
			sepLen = sep.length;
		}
	}
	if (rel >= 0) return prevStart + rel + sepLen;
	const gap = text.slice(prevEnd, matchIndex).trim();
	const words = gap.length > 0 ? gap.split(/\s+/) : [];
	if (words.length === 0) return matchIndex;
	const give = Math.ceil(words.length / 2);
	const head = words.slice(0, words.length - give).join(" ");
	const tail = words.slice(words.length - give).join(" ");
	const tailAt = text.toLowerCase().lastIndexOf(tail.toLowerCase(), matchIndex);
	if (tailAt >= prevEnd) return tailAt;
	return prevEnd + (head.length > 0 ? head.length + 1 : 0);
}
function cleanEdge(value) {
	let next = value.trim();
	for (let pass = 0; pass < 3; pass += 1) next = next.replace(/^[\s,;]+/, "").replace(/[\s,;]+$/, "").replace(/^(and|plus|tucked into|paired with)\s+/i, "").replace(/\s+(and|plus|tucked into|paired with)$/i, "").trim();
	return next;
}
function splitPieces(transcript) {
	const text = transcript.trim();
	if (!text) return [];
	const hits = findHits(text);
	if (hits.length === 0) return [];
	if (hits.length === 1) {
		const spoken = cleanEdge(text);
		return spoken ? [{
			category: hits[0].category,
			spoken
		}] : [];
	}
	const limited = hits.slice(0, 4);
	const starts = [0];
	for (let i = 1; i < limited.length; i += 1) {
		const prev = limited[i - 1];
		starts.push(boundaryBefore(text, limited[i].index, starts[i - 1], prev.index + prev.length));
	}
	const pieces = [];
	for (let i = 0; i < limited.length; i += 1) {
		const end = i + 1 < limited.length ? starts[i + 1] : text.length;
		let spoken = cleanEdge(text.slice(starts[i], end));
		if (i === limited.length - 1 && hits.length > limited.length) spoken = cleanEdge(text.slice(starts[i]));
		if (!spoken) continue;
		if (!text.toLowerCase().includes(spoken.toLowerCase())) continue;
		pieces.push({
			category: limited[i].category,
			spoken
		});
	}
	return mergeSameCategory(pieces);
}
function mergeSameCategory(pieces) {
	const merged = [];
	for (const piece of pieces) {
		const prev = merged[merged.length - 1];
		if (prev && prev.category === piece.category) {
			if (!prev.spoken.toLowerCase().includes(piece.spoken.toLowerCase())) prev.spoken = cleanEdge(`${prev.spoken} ${piece.spoken}`);
			continue;
		}
		merged.push({ ...piece });
	}
	return merged;
}
function reactionIn(text) {
	const lower = text.toLowerCase();
	const boo = /\bboo/.test(lower);
	const cheer = /\bcheer/.test(lower);
	if (boo && cheer) return "both";
	if (/\bboth\b|\bsplit\b/.test(lower)) return "both";
	if (boo) return "boo";
	if (cheer) return "cheer";
}
function interpret(transcript) {
	const text = transcript.trim();
	if (!text) return { type: "unclear" };
	if (/^(stop|cancel|quiet|cut it|shut up)\b/i.test(text)) return { type: "stop" };
	if (text.length < 42 && /\b(try again|run it back|redo that|redo it|redo)\b/i.test(text)) return { type: "again" };
	if (text.length < 42 && /\b(save this|save it|keep this|keep it)\b/i.test(text)) return { type: "save" };
	if (text.match(/^(boo|boos|boo them|cheer|cheers|cheer them|both|split them)$/i)) return {
		type: "reaction",
		reaction: reactionIn(text) ?? "both"
	};
	if (text.length < 80 && /\b(runway|walk it|send it down)\b/i.test(text)) return {
		type: "runway",
		reaction: reactionIn(text)
	};
	const pieces = splitPieces(text);
	const wear = /\b(put it on( me)?|put them on|wear it|wear that)\b/i.test(text) || text.length < 32 && /\brun it\b/i.test(text);
	if (pieces.length > 0) return {
		type: "pieces",
		pieces,
		thenWear: wear,
		transcript: text
	};
	if (wear) return { type: "wear" };
	return { type: "unclear" };
}
function isCategory(value) {
	return CATEGORIES.includes(value);
}
var LOCK_LINE = "Keep the person's face, hair, body proportions, and lighting identical to the character references. Apply only the clothing described. Do not alter identity.";
function quote(value) {
	return value.replaceAll("\"", "'").replace(/\s+/g, " ").trim();
}
function piecePrompt(spoken, category) {
	return [
		`Isolated product photograph of one ${category.toLowerCase()} item alone on a plain light gray seamless background.`,
		"Whole item in frame, realistic fabric, true color, sharp detail, studio light.",
		`Exact item, unchanged: "${quote(spoken)}".`
	].join(" ");
}
function lookPrompt(spoken, characterCount, totalImages) {
	const clothing = Math.max(0, totalImages - characterCount);
	return [
		LOCK_LINE,
		"Full-body fashion photograph, head to shoes, standing, simple dark studio, realistic, no text.",
		characterCount <= 0 ? "The reference images are the clothes." : characterCount >= totalImages ? "The reference images are the same person." : characterCount === 1 ? "The first image is the person. The remaining images are the exact clothes." : `The first ${characterCount} images are the person. The remaining images are the exact clothes.`,
		clothing > 0 ? "Match the clothing references for fabric, cut, hardware, color, and fit." : "Match the clothing exactly as described.",
		`Dress them in exactly this: "${quote(spoken)}".`
	].join(" ");
}
function tweakPrompt(baseSpoken, change) {
	return [
		LOCK_LINE,
		"The first image is the current photograph. Any later images are the same person. Keep the face.",
		"Full-body fashion photograph, head to shoes, standing, simple dark studio, realistic, no text.",
		`Already dressed in: "${quote(baseSpoken)}".`,
		`Change only this: "${quote(change)}".`
	].join(" ");
}
var CROWD = {
	cheer: "Judges cheer, loud, on their feet.",
	boo: "Judges boo, loud and messy.",
	both: "Judges split. Some cheer, some boo. Both are loud."
};
function videoPrompt(reaction, spoken, hasFace) {
	const outfit = quote(spoken);
	const outfitLine = outfit ? ` Outfit, exact: "${outfit}".` : "";
	const crowd = CROWD[reaction];
	if (hasFace) return `Use the first image as the person and the outfit. Use the second image as the face lock. The same person walks a short dark runway toward the camera, steady stride, one spotlight.${outfitLine} ${crowd} Realistic live action, no on-screen text.`;
	return `The person in the still walks a short dark runway toward the camera, same face, same outfit, steady stride, one spotlight.${outfitLine} ${crowd} Realistic live action, no on-screen text.`;
}
//#endregion
export { isCategory as a, tweakPrompt as c, interpret as i, videoPrompt as l, LOCK_LINE as n, lookPrompt as o, REQUIRED_SLOTS as r, piecePrompt as s, CATEGORIES as t };
