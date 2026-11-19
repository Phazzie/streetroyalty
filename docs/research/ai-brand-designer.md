# AI Brand Designer: research and recommended architecture

I checked every source on 2026-11-19. Items marked **[UNCONFIRMED]** come from a single source, from third-party sources only, or from sources that disagree with each other.

## 1. Existing AI apparel and brand tools: what users like and dislike

- **Kittl** describes itself as an AI-first design platform with 15+ image models, mockups and a chat assistant that proposes changes and helps with layout. One 2026 review judges the assistant "useful but less powerful than Canva's Magic Studio" ([stigstack](https://stigstack.pages.dev/reviews/kittl-ai-review), [toolsforhumans](https://www.toolsforhumans.ai/ai-tools/kittl)). The most consistent complaint is credits running out after a few renders ([Trustpilot](https://ca.trustpilot.com/review/kittl.com?page=4)).
- **Printify and Printful AI makers.** Beginners praise the built-in AI generators. Complaints are about the editor: in Jan 2026, a reviewer reported that edited AI text reverted and uploaded mockups were deleted ([Shopify reviews](https://apps.shopify.com/printify/reviews?page=2), [Shopify](https://apps.shopify.com/reviews/2102537)).
- **Logo generators (Looka, Brandmark).** Complaints cover limited editing after purchase, one logo per plan, generic output, and some logos that "resemble existing designs" ([G2](https://www.g2.com/sellers/looka), [toolsforhumans](https://www.toolsforhumans.ai/ai-tools/looka), [Cropink](https://cropink.com/best-ai-logo-generators)). Reviewers see Brandmark as more curated **[UNCONFIRMED, affiliate sources]**.
- **Fashion-specific tools (Vizcom, CALA, NewArc).** I found no credible user-sentiment data. One industry guide says most fashion AI tools "generate visuals, not product-ready outputs" ([OnbrandPLM](https://www.onbrandplm.com/blog/best-ai-tools-for-fashion-designers)).
- **Patterned.ai** is the closest analog for all-over print (AOP). It offers text-to-seamless-pattern and an upscaler from 2× to 16×, capped at 8,200×8,200 px with "tile edges intact" ([patterned.ai upscaler](https://www.patterned.ai/pattern-upscaler)). These are vendor claims, and independent reviews are thin.

**Takeaways:**
- Users hate opaque credit burn and AI edits they can't undo or adjust by hand.
- They like getting a starting point fast.
- Nobody has shipped "AI that outputs a print-ready cut-and-sew file". That is the gap Street Royalty can fill.

## 2. Seamless patterns, resolution and upscaling

**Native output sizes as published:**

| Model | Max output | Price | Source |
|---|---|---|---|
| xAI `grok-imagine-image-2.0` | `resolution`: `1k` (default) or `2k`. 2k is about 2048×2048 at 1:1 **[UNCONFIRMED, third-party: Atlas Cloud, apiyi]** | $0.04/image (xAI lists one flat price. Third parties charge more for 2k **[UNCONFIRMED]**) | [xAI docs](https://docs.x.ai/developers/model-capabilities/images/generation), [xAI models](https://docs.x.ai/developers/models), [Atlas](https://www.atlascloud.ai/nl/models/xai/grok-imagine-image-2.0/text-to-image/llms.txt) |
| OpenAI `gpt-image-2` | Any size with a max edge of 3840 px, sides in multiples of 16 (per the guide's custom-size rules), 655,360 to 8,294,400 total px. Transparent PNG/WebP supported | $0.006 / $0.053 / $0.211 for low / medium / high at 1024² | [OpenAI guide](https://developers.openai.com/api/docs/guides/image-generation) |
| Google `gemini-3-pro-image` | 1K, 2K or 4K | $0.134 at 1K/2K, $0.24 at 4K | [AI Studio pricing](https://aistudio.google.com/docs/pricing) |
| Google `gemini-nano-banana-2.1` | 1K, 2K or 4K | $0.0336 / $0.0504 / $0.113. Batch is half price | same |
| Recraft V4 vector | Native editable SVG | $0.08/image (Pro $0.30). Vectorize costs $0.01, crisp upscale $0.004 | [Recraft pricing](https://www.recraft.ai/docs/api-reference/pricing) |

**Tileability.**
- None of the xAI, OpenAI or Google docs I read expose a seamless or tile parameter. Treat tiling as your job, not the model's.
- Open-weight models get tiling by switching Conv2d padding to circular. Enabling it on all layers "significantly harms FID/CLIP". A workaround is to switch it on only late in sampling ([pattern-diffusion card](https://huggingface.co/Arrexel/pattern-diffusion), [Texturaizer node](https://www.runcomfy.com/comfyui-nodes/ComfyUI-Texturaizer/texturaizer-seamless-tiling-patch)).
- Tiled Diffusion produces tileable output from any latent diffusion model ([arXiv 2412.15185](https://arxiv.org/html/2412.15185v4)).
- I found no Flux-native tiling method. Flux is mostly transformer layers, so the circular-padding trick may not carry over **[UNCONFIRMED]**.
- The model-agnostic fallback:
  1. Generate a tile.
  2. Offset it 50%/50% to expose the seams ([offset method](https://www.runcomfy.com/comfyui-nodes/ComfyUI-seamless-tiling/OffsetImage)).
  3. Repair the cross-shaped seam with an image-edit call.
  4. Re-check at 25% and 75% offsets.
- xAI edits take URL, base64 or `file_id` input. No mask parameter is documented. The edit output follows the size of the first input image **[UNCONFIRMED, apiyi]** ([xAI editing](https://docs.x.ai/developers/model-capabilities/images/editing)).
- The deterministic option is mirror or half-drop repeats done in code. They are seamless by construction.

**Resolution math, the key insight.**
- At Printful's 150 DPI for AOP ([Printful](https://www.printful.com/blog/everything-you-need-to-know-to-prepare-the-perfect-printfile)), a 2048 px tile covers 13.6 in.
- A **repeating** pattern therefore never needs a 6600×7500 px generation. Code tiles the native 2k output across the sheet at a chosen physical repeat size. Upscaling is optional and only buys a larger repeat.
- Upscaling is needed only for **placed / engineered** art: a full-panel graphic, or a hero print larger than about 13 in.
- gpt-image-2 at 3840 px covers 25.6 in natively. Nano Banana 4K is about 16 MP, roughly 4000 px on a side, or about 27 in ([Google model doc](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-pro-image?authuser=1)).

**Upscaling.**
- Real-ESRGAN processed in tiles leaves seams at tile borders unless you use padding or overlap (`tile_pad`). A 2023 paper fixes this with local padding that needs no retraining ([arXiv 2309.02340](https://arxiv.org/pdf/2309.02340), [Clore guide](https://docs.clore.ai/guides/image-processing/real-esrgan-upscaling)).
- When upscaling a tile, wrap-pad it (copy the opposite edges in first) so the upscaled tile still repeats. ESRGAN forks ship "tiled/mirrored seamless" modes for this ([joeyballentine/esrgan](https://github.com/joeyballentine/esrgan)).
- Hosted alternatives: Recraft crisp upscale at $0.004 per request, and the Patterned.ai upscaler.

**Vector output, for crisp stripes, logos and type.**
- Stripes, checks, color blocking and wordmarks should be **code-generated SVG**, never pixels from a model.
- For AI marks, use Recraft V4 vector output (true SVG) or trace a raster with VTracer. VTracer is MIT-licensed, handles color, and runs in Rust, Python or JS, while Potrace takes black-and-white input only ([vtracer](https://github.com/visioncortex/vtracer)).

## 3. Agent tool-calling patterns in design editors

- **Figma `use_figma`** writes native content through the remote MCP server. It is free in beta and will later be usage-billed ([Figma docs](https://developers.figma.com/docs/figma-mcp-server/write-to-canvas)).
- Bitovi's field test (Mar 2026) found the agent hardcoded colors instead of using variables, mixed library components with raw frames, and gave inconsistent results across runs. Their conclusion: "It's optimizing for the literal goal you gave it." The fix was encoded conventions (skills) ([Bitovi](https://bitovi.com/blog/figma-just-opened-the-canvas-to-agents.-heres-what-actually-happens)).
- **tldraw agent starter kit**, the best public reference architecture ([tldraw](https://tldraw.dev/starter-kits/agent)):
  - Context is a screenshot plus simplified structured shapes, with off-screen content summarized as clusters, and lints.
  - Every action has a schema. A `sanitizeAction()` step fixes model mistakes or cancels the action before it applies.
  - Actions stream and apply one by one.
  - `schedule()` queues follow-up "review" passes, and modes restrict which actions are available.
- **Canva** exposes a remote MCP server so agents can create designs from templates, fill them, edit and export. Its "Design Model" outputs layered, editable designs rather than flat images **[UNCONFIRMED, secondary source]** ([Canva MCP](https://canva.dev/docs/mcp/), [DEV](https://dev.to/jangwook_kim_e31e7291ad98/canva-ai-20-agentic-suite-developer-guide-2026-1l0e)).
- **Adobe Express AI Assistant** (Oct 2025): edits are chat-based and layer-scoped, the underlying design is never destroyed, and users can toggle back to the manual editor. Adobe picks the model per task. The **Firefly AI Assistant** (Apr 2026) runs multi-app "creative agent" workflows ([BusinessWire](https://www.businesswire.com/news/home/20251028348613/en/Adobe-Introduces-New-AI-Assistant-in-Adobe-Express-that-Unlocks-Creativity-for-All-with-Conversational-Creation-and-Editing), [Adobe help](https://helpx.adobe.com/th_th/express/web/ai-assistant/adobe-express-ai-assistant-overview.html), [TechRepublic](https://www.techrepublic.com/article/news-adobe-agentic-firefly-workflows/)).
- **xAI function calling** takes JSON-Schema `parameters` with an object root. Parallel calls are on by default. `tool_choice` accepts `auto`, `required`, `none` or a named function. The limit is 350 tools per request. I found no strict-mode flag ([xAI function calling](https://docs.x.ai/developers/tools/function-calling)). Combining structured outputs with tools works only on the Grok 4 family ([xAI structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs)).

**Patterns that work:**
1. Describe, then act: read state from `describe()`, apply commands, then call `describe()` again.
2. Validate and repair every command in code.
3. Keep the action vocabulary small and give each action a clear name and description.
4. Make every action undoable and show the user a diff.
5. Encode house rules (brand tokens, never hardcode a hex) in the system prompt and in validators, not just in hope.

## 4. Brand identity generation and IP risk

**What works.** LLMs are good at names, story and copy, and at palettes and type pairings when they choose from a curated list. Raster logos look generic and can resemble existing marks ([Cropink](https://cropink.com/best-ai-logo-generators), [Gerben Law](https://www.gerbenlaw.com/blog/ai-guided-trademark-development-mitigating-infringement-risks/)).

**Copyright.** The US Copyright Office's Part 2 report (Jan 29, 2025) says prompts alone do not make the user the author. Human modification and arrangement can support authorship ([IPWatchdog](https://ipwatchdog.com/2025/01/29/part-two-copyright-office-ai-report-says-creative-prompting-doesnt-constitute-authorship/), [Perkins Coie](https://perkinscoie.com/insights/update/copyright-office-solidifies-stance-copyrightability-ai-generated-works)). In practice, a purely AI-generated logo or print is likely unprotectable by copyright, so copycats can lift it.

**Trademark.** Generating a mark with AI is not itself a bar to registration. The real risk is likelihood of confusion with prior marks for related goods, and apparel is Class 25 (class number from general knowledge, not from a fetched source) ([Renderforest](https://www.renderforest.com/blog/trademark-ai-generated-logo), [Foley](https://www.foley.com/de/news/2025/06/foley-attorneys-explore-ip-considerations-for-ai-generated-logos)).

**Name checking.**
- The USPTO's official APIs are TSDR (status and documents by serial number, key required), assignment search, and bulk data. I found **no official wordmark full-text search API** **[UNCONFIRMED: absence of evidence]** ([TSDR](https://developer.uspto.gov/node/165462), [bulk data](https://www.uspto.gov/trademarks-application-process/checking-application-status-view-documents/trademark-bulk-data)).
- Realistic options:
  - Index USPTO bulk data yourself.
  - Use a paid third-party search API.
  - Run an exact or fuzzy screen and label it "not legal clearance".
- The USPTO suspended TSDR access in 2019 over scraping ([WTR](https://www.worldtrademarkreview.com/article/unprecedented-uspto-suspends-api-access-pledges-work-ip-service-providers-mitigate-impact)). Don't build on scraping.

## 5. xAI image API as published

- **Models:** `grok-imagine-image-2.0` at $0.04/image and `grok-imagine-image` at $0.02/image ([xAI models](https://docs.x.ai/developers/models)).
- **Endpoints:** `POST /v1/images/generations` and `/v1/images/edits`. Edits accept JSON only, so the OpenAI SDK's multipart `images.edit()` does not work. Multi-image edit takes up to 5 source images ([xAI guides](https://docs.x.ai/docs/guides/image-generations), [editing](https://docs.x.ai/developers/model-capabilities/images/editing)).
- **Generation parameters:**
  - `aspect_ratio`: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `2:1`, `1:2`, `19.5:9`, `9:19.5`, `20:9`, `9:20`, `21:9`, `5:2` or `auto`
  - `resolution`: `1k` or `2k`
  - `quality`: `low`, `medium` or `auto`
  - `n`: 1 to 10
  - `response_format`: `url` or `b64_json`
  - `deferred`: `true` gives you a `request_id` to poll, results are kept for 24 h, and completion webhooks are available ([xAI generation](https://docs.x.ai/developers/model-capabilities/images/generation))
- **Billing:** edits are billed for both the input and the output image.
- **Not published:** rate limits, exact pixel sizes, and whether `2k` costs more **[UNCONFIRMED]**. No 4K tier exists.
- **Text model for the agent loop:** `grok-4.3` costs $1.25 in / $2.50 out per M tokens. `grok-4.7` costs $2 in / $6 out ([xAI models](https://docs.x.ai/developers/models)).

## 6. Recommended architecture

**Split of responsibilities: the model proposes, code disposes.**
- **The LLM decides** creative intent:
  - concept, name and story options
  - which panels get which treatment
  - palette choice from generated candidates
  - motif prompts, pattern scale, and colorway variations
- **Code decides:**
  - pixel dimensions and DPI math
  - tiling and repeat construction, seam checks and bleed
  - color snapping to the brand palette (ΔE)
  - contrast checks, print-area validity, and cost and credit gates
  - all file assembly for Printful

**Agent loop.**
1. Grok 4.x with function calling reads `describe()`. Keep it compact: panels, roles, colorways, layers and asset IDs, plus a small rendered thumbnail when vision helps.
2. Grok emits a batch of commands.
3. A `sanitize()` step validates each command against zod schemas, clamps values and resolves IDs.
4. Commands apply as **one undoable transaction per agent turn**. The UI shows a before/after diff with Accept, Undo and Tweak buttons.
5. An optional `schedule review` pass re-reads `describe()` and lints the result (contrast, clashing colorways, empty panels).
6. The agent is capped at about 6 tool rounds per user message.

**Commands needed.** Existing:
- `setPanelFill`
- `setRoleColor`
- `addColorway`
- `addLayer`

Add:
- `setPalette(roles)`
- `generateMotif({prompt, style, transparent, size:'1k'|'2k'})`. This is the **only** command that costs money, and it returns an assetId.
- `makeRepeat({assetId, mode: 'mirror'|'half-drop'|'seam-repair'|'grid', repeatInches})`
- `procedural({kind: 'stripes'|'check'|'gradient'|'colorblock', params})`, rendered as vector
- `placeGraphic({assetId, panel, x, y, scaleInches})`
- `setText({panel, text, font from allow-list})`
- `recolorAsset({assetId, map})`
- `removeLayer` / `reorderLayer`
- `brand.set({name, story, tagline})`
- `checkName(name)`
- `previewMockup()`

**Cost cap.**
- Text turns are cheap, at roughly 1–3 cents each by estimate.
- Gate `generateMotif` with a per-user daily image budget. Draft at `1k` / `quality: low` ($0.04 each), and spend `2k` only on the variant the user picks.
- Never let the agent fan out `n` > 4 unasked.
- Use `deferred` plus webhooks so serverless functions don't block.
- Cache motif assets per brand.
- Recolors and colorways are code (palette mapping), not new generations.

**Print-resolution pipeline.**
1. Generate at 2k.
2. Seamlessness: either code-mirror the tile, or run the offset-then-edit seam repair (one extra $0.04+ edit) and verify with offset checks in code.
3. Tile at the chosen physical repeat across a 6600×7500 canvas server-side, with sharp or canvas.
4. Upscale (wrap-padded Real-ESRGAN, or Recraft crisp at $0.004) only when the repeat exceeds about 13.6 in, or for placed art.
5. Stripes, logos and text stay vector and rasterize at 150 DPI last.

## 7. Five biggest risks

1. **Visible seams or soft art on real garments.** A model output only "looks" tileable, and a 4× upscale looks plasticky at full print size. Mitigate with code-enforced repeats, automated offset seam checks, and ordering physical samples.
2. **Cost runaway.** Agent loops plus image fan-out plus billed-twice edits add up quickly. Mitigate with hard per-user budgets, generation as the only paid command, and drafts at 1k.
3. **Trademark and IP collisions.** Generated names and logos can resemble existing marks, there is no official USPTO search API, and pure-AI art likely has no copyright. Mitigate with a name screen labeled "not legal clearance", by encouraging human edits, and with prompt filters for brand names.
4. **Agent unpredictability.** The agent may hardcode colors, overwrite user work, or do something different on each run (as Bitovi saw with Figma). Mitigate with schema validation, palette-role-only colors, one undo transaction per turn, and a visible diff.
5. **Vendor and spec drift.** Pixel sizes and 2k pricing for xAI are unpublished, and models churn fast: GPT Image 1 shut down Oct 23, 2026 ([OpenAI guide](https://developers.openai.com/api/docs/guides/image-generation)). Mitigate with a provider-agnostic `generateMotif` adapter, checking the output size of every image, and logging the actual cost of each call.
