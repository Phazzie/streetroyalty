// file-size: small files regenerate cleanly. Fails any code file over cfg.maxLines (default 200).
import { finding, isCode, listFiles, readText, underAny } from '../lib.mjs';

export function checkFileSize(ctx) {
  const { dir, cfg } = ctx;
  const out = [];
  const dirs = [...new Set([...cfg.codeDirs, 'tests'])];
  for (const file of listFiles(dir, cfg)) {
    if (!underAny(file, dirs) || !isCode(file, cfg)) continue;
    const n = readText(dir, file).split('\n').length;
    if (n > cfg.maxLines) out.push(finding('file-size', `${n} lines (limit ${cfg.maxLines}). Split it along a seam in the blueprint, then regenerate.`, file));
  }
  return out;
}
