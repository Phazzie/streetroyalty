import { a as isCategory, c as tweakPrompt, l as videoPrompt, o as lookPrompt, s as piecePrompt } from "./tickets-B6Ik5l_m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/imagine.server-DbSdO04R.js
var IMAGE_MODEL = "grok-imagine-image-2.0";
var IMAGE_FALLBACK = "grok-imagine-image";
var VIDEO_MODEL = "grok-imagine-video-1.5";
function key() {
	const value = process.env.XAI_API_KEY;
	return value && value.trim() ? value : void 0;
}
async function postJson(path, body) {
	const apiKey = key();
	if (!apiKey) return null;
	try {
		const res = await fetch(`https://api.x.ai${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(9e4)
		});
		const text = await res.text();
		let json = null;
		try {
			json = text ? JSON.parse(text) : null;
		} catch {
			json = null;
		}
		if (!res.ok) console.error("xai", path, res.status, text.slice(0, 400));
		return {
			status: res.status,
			json
		};
	} catch (error) {
		console.error("xai", path, error);
		return {
			status: 0,
			json: null
		};
	}
}
function bytesToDataUrl(bytes, mime) {
	let binary = "";
	const size = 32768;
	for (let i = 0; i < bytes.length; i += size) binary += String.fromCharCode(...bytes.subarray(i, i + size));
	return `data:${mime};base64,${btoa(binary)}`;
}
async function inlineClip(url) {
	if (!url.startsWith("https://")) return null;
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(3e4) });
		if (!res.ok) return null;
		const bytes = new Uint8Array(await res.arrayBuffer());
		if (bytes.byteLength === 0 || bytes.byteLength > 25e5) return null;
		const mime = res.headers.get("content-type")?.split(";")[0] || "video/mp4";
		if (!mime.startsWith("video/")) return null;
		return bytesToDataUrl(bytes, mime);
	} catch (error) {
		console.error("xai clip", error);
		return null;
	}
}
async function imageFromPayload(json) {
	const data = json?.data?.[0];
	if (!data) return null;
	if (data.b64_json) return data.b64_json.startsWith("data:") ? data.b64_json : `data:image/jpeg;base64,${data.b64_json}`;
	if (!data.url?.startsWith("https://")) return null;
	try {
		const res = await fetch(data.url, { signal: AbortSignal.timeout(3e4) });
		if (!res.ok) return null;
		const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
		return bytesToDataUrl(new Uint8Array(await res.arrayBuffer()), mime);
	} catch (error) {
		console.error("xai image fetch", error);
		return null;
	}
}
async function generateImage(path, body) {
	if (!key()) return {
		ok: false,
		kind: "unavailable"
	};
	let result = await postJson(path, body);
	if (!result) return {
		ok: false,
		kind: "unavailable"
	};
	if ((result.status === 400 || result.status === 404) && body.model === IMAGE_MODEL) {
		const fallback = {
			...body,
			model: IMAGE_FALLBACK
		};
		delete fallback.quality;
		result = await postJson(path, fallback);
		if (!result) return {
			ok: false,
			kind: "unavailable"
		};
	}
	if (result.status < 200 || result.status >= 300) return {
		ok: false,
		kind: "missed"
	};
	const image = await imageFromPayload(result.json);
	if (!image) return {
		ok: false,
		kind: "missed"
	};
	return {
		ok: true,
		image,
		prompt: String(body.prompt ?? "")
	};
}
async function runPiece(input) {
	if (!input.spoken || !isCategory(input.category)) return {
		ok: false,
		kind: "missed"
	};
	return generateImage("/v1/images/generations", {
		model: IMAGE_MODEL,
		prompt: piecePrompt(input.spoken, input.category),
		n: 1,
		aspect_ratio: "1:1",
		resolution: "1k",
		quality: "low",
		response_format: "b64_json"
	});
}
async function runLook(input) {
	if (!input.spoken) return {
		ok: false,
		kind: "missed"
	};
	const faces = input.characterImages.slice(0, 3);
	let images = [];
	let prompt = "";
	if (input.mode === "tweak") {
		if (!input.lookImage) return {
			ok: false,
			kind: "missed"
		};
		images = [input.lookImage, ...faces].slice(0, 5).map((url) => ({
			type: "image_url",
			url
		}));
		prompt = tweakPrompt(input.baseSpoken || input.spoken, input.spoken);
	} else {
		if (faces.length === 0) return {
			ok: false,
			kind: "missed"
		};
		const clothes = input.clothingImages.slice(0, Math.max(0, 5 - faces.length));
		const refs = [...faces, ...clothes];
		images = refs.map((url) => ({
			type: "image_url",
			url
		}));
		prompt = lookPrompt(input.spoken, faces.length, refs.length);
	}
	return generateImage("/v1/images/edits", {
		model: IMAGE_MODEL,
		prompt,
		images,
		aspect_ratio: "2:3",
		resolution: "1k",
		quality: "low",
		response_format: "b64_json"
	});
}
async function runStart(input) {
	if (!input.lookImage) return {
		ok: false,
		kind: "missed"
	};
	if (!key()) return {
		ok: false,
		kind: "unavailable"
	};
	const hasFace = Boolean(input.faceImage);
	const prompt = videoPrompt(input.reaction, input.spoken, hasFace);
	let result = await postJson("/v1/videos/generations", hasFace ? {
		model: VIDEO_MODEL,
		prompt,
		reference_images: [input.lookImage, input.faceImage].filter((url) => Boolean(url)).map((url) => ({ url })),
		duration: 6,
		aspect_ratio: "9:16",
		resolution: "720p"
	} : {
		model: VIDEO_MODEL,
		prompt,
		image: { url: input.lookImage },
		duration: 6,
		aspect_ratio: "9:16",
		resolution: "720p"
	});
	if (!result) return {
		ok: false,
		kind: "unavailable"
	};
	if (hasFace && (result.status < 200 || result.status >= 300)) {
		result = await postJson("/v1/videos/generations", {
			model: VIDEO_MODEL,
			prompt: videoPrompt(input.reaction, input.spoken, false),
			image: { url: input.lookImage },
			duration: 6,
			aspect_ratio: "9:16",
			resolution: "720p"
		});
		if (!result) return {
			ok: false,
			kind: "unavailable"
		};
	}
	const requestId = result.json?.request_id;
	if (!requestId || result.status < 200 || result.status >= 300) return {
		ok: false,
		kind: "missed"
	};
	return {
		ok: true,
		requestId,
		prompt
	};
}
async function runPoll(requestId) {
	if (!/^[\w-]{8,80}$/.test(requestId)) return {
		ok: false,
		kind: "missed"
	};
	const apiKey = key();
	if (!apiKey) return {
		ok: false,
		kind: "unavailable"
	};
	try {
		const res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(2e4)
		});
		const json = await res.json();
		if (!res.ok) {
			console.error("xai poll", res.status);
			return {
				ok: false,
				kind: "missed"
			};
		}
		if (json.status === "done" && json.video?.url) return {
			ok: true,
			status: "done",
			url: await inlineClip(json.video.url) ?? json.video.url
		};
		if (json.status === "failed" || json.status === "expired") return {
			ok: true,
			status: "failed"
		};
		return {
			ok: true,
			status: "pending"
		};
	} catch (error) {
		console.error("xai poll", error);
		return {
			ok: false,
			kind: "missed"
		};
	}
}
//#endregion
export { runLook, runPiece, runPoll, runStart };
