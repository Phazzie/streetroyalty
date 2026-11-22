// env-reads + hardcoded-keys: settings are read in exactly one place (src/config/), and no keys live in the repo.
import path from 'node:path';
import { finding, isCode, listFiles, readText, underAny } from '../lib.mjs';

const ENV_READ = /\bprocess\s*\.\s*env\b|\bprocess\s*\[\s*['"]env['"]\s*\]|\bimport\s*\.\s*meta\s*\.\s*env\b|\bDeno\s*\.\s*env\b|\bBun\s*\.\s*env\b|\bos\s*\.\s*environ\b|\bos\s*\.\s*getenv\b/;

export const KEY_PATTERNS = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['OpenAI/Anthropic-style secret key', /\bsk-(?:proj-|ant-|live-)?[A-Za-z0-9_-]{24,}/],
  ['Stripe live key', /\b[rs]k_live_[0-9a-zA-Z]{20,}/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Hugging Face token', /\bhf_[A-Za-z0-9]{30,}\b/],
  ['Replicate token', /\br8_[A-Za-z0-9]{30,}\b/],
  ['private key block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/],
  ['JWT (often a Supabase/Firebase service key)', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['hardcoded secret assignment', /\b(?:api[_-]?key|apikey|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["'][A-Za-z0-9_\-/+=.]{16,}["']/i],
];

export function checkEnvReads(ctx) {
  const { dir, cfg } = ctx;
  const out = [];
  for (const file of listFiles(dir, cfg)) {
    if (!underAny(file, cfg.codeDirs) || underAny(file, [cfg.configDir]) || !isCode(file, cfg)) continue;
    readText(dir, file).split('\n').forEach((ln, i) => {
      if (ENV_READ.test(ln)) out.push(finding('env-reads', `reads environment settings outside ${cfg.configDir}/. Import the value from ${cfg.configDir} instead.`, file, i + 1));
    });
  }
  return out;
}

export function checkHardcodedKeys(ctx) {
  const { dir, cfg } = ctx;
  const out = [];
  for (const file of listFiles(dir, cfg)) {
    const base = path.posix.basename(file);
    if (/^\.env(\..+)?$/.test(base) && !/\.(example|sample|template)$/.test(base)) {
      out.push(finding('hardcoded-keys', 'an .env file is being committed. Real settings files must stay out of git (only .env.example is allowed).', file));
      continue;
    }
    if (cfg.secretScanSkip.includes(base) || cfg.secretAllowlist.includes(file)) continue;
    let text;
    try {
      text = readText(dir, file);
    } catch (e) {
      throw new Error(`could not read ${file} for the secret scan: ${e.message}`);
    }
    if (text.includes('\u0000') || text.length > 2_000_000) continue; // binary or huge
    text.split('\n').forEach((ln, i) => {
      for (const [name, re] of KEY_PATTERNS) {
        if (re.test(ln)) out.push(finding('hardcoded-keys', `looks like a ${name}. Move it to .env and read it in src/config/.`, file, i + 1));
      }
    });
  }
  return out;
}
