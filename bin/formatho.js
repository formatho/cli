#!/usr/bin/env node
/**
 * formatho — privacy-first dev tools in your terminal
 * 100% local. No network calls. No telemetry. Ever.
 * Web versions: https://formatho.com
 */
import { createHash, randomUUID } from "node:crypto";

const VERSION = "0.1.0";
const HELP = `formatho v${VERSION} — privacy-first dev tools, 100% local (https://formatho.com)

Usage: formatho <command> [options]
       echo "input" | formatho <command>

Commands:
  json <file|->             Pretty-print JSON (reads stdin with -)
  json-min <file|->         Minify JSON
  base64 encode [text]      Base64-encode (stdin if no text)
  base64 decode [text]      Base64-decode
  url encode|decode [text]  URL encode/decode
  hash <algo> [text]        Hash text (md5, sha1, sha256, sha512; stdin ok)
  uuid [n]                  Generate n UUID v4 (default 1, max 100)
  random [length]           Random alphanumeric string (default 32)
  slug [text]               URL slugify
  timestamp [ts|iso]        Convert unix<->ISO (default: now)
  help                      Show this help
  version                   Show version

Options:
  --json                    Machine-readable JSON output (agent-friendly)

No telemetry, no network. Your data never leaves this machine.`;

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const a = args.filter(x => x !== "--json");

const readStdin = async () => {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8").trimEnd();
};
const readArgOrStdin = async (v) => v !== undefined ? v : await readStdin();

const out = (result, extra = {}) => {
  if (jsonOut) console.log(JSON.stringify({ ok: true, tool: a[0], result, ...extra }));
  else console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
};
const die = (msg, code = 1) => {
  if (jsonOut) console.log(JSON.stringify({ ok: false, tool: a[0] || null, error: msg }));
  else console.error(`error: ${msg}`);
  process.exit(code);
};

const [cmd, sub, ...rest] = a;

try {
  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
      console.log(HELP);
      break;
    case "version":
    case "--version":
      out(VERSION);
      break;
    case "json":
    case "json-min": {
      const src = sub === "-" || sub === undefined ? await readStdin() : sub;
      const parsed = JSON.parse(src);
      out(cmd === "json" ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed));
      break;
    }
    case "base64": {
      const mode = sub || "encode";
      const text = await readArgOrStdin(rest[0]);
      if (mode === "encode") out(Buffer.from(text, "utf8").toString("base64"));
      else if (mode === "decode") out(Buffer.from(text.trim(), "base64").toString("utf8"));
      else die("usage: formatho base64 encode|decode [text]");
      break;
    }
    case "url": {
      const mode = sub || "encode";
      const text = await readArgOrStdin(rest[0]);
      if (mode === "encode") out(encodeURIComponent(text));
      else if (mode === "decode") out(decodeURIComponent(text));
      else die("usage: formatho url encode|decode [text]");
      break;
    }
    case "hash": {
      const algo = (sub || "sha256").toLowerCase();
      const text = await readArgOrStdin(rest[0]);
      if (!["md5", "sha1", "sha256", "sha512"].includes(algo))
        die(`unsupported algorithm "${algo}" (md5|sha1|sha256|sha512)`);
      out(createHash(algo).update(text).digest("hex"), { algorithm: algo });
      break;
    }
    case "uuid": {
      const n = Math.min(parseInt(sub || "1", 10) || 1, 100);
      out(Array.from({ length: n }, () => randomUUID()), { count: n });
      break;
    }
    case "random": {
      const len = Math.min(parseInt(sub || "32", 10) || 32, 1024);
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const buf = new Uint8Array(len);
      crypto.getRandomValues(buf);
      out(Array.from(buf, b => chars[b % chars.length]).join(""), { length: len });
      break;
    }
    case "slug": {
      const text = await readArgOrStdin(sub);
      out(text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, ""));
      break;
    }
    case "timestamp": {
      const v = sub;
      if (!v) out({ unix: Math.floor(Date.now() / 1000), iso: new Date().toISOString() });
      else if (/^\d+$/.test(v)) out({ unix: Number(v), iso: new Date(Number(v) * 1000).toISOString() });
      else {
        const d = new Date(v);
        if (isNaN(d)) die("invalid timestamp or ISO date");
        out({ unix: Math.floor(d.getTime() / 1000), iso: d.toISOString() });
      }
      break;
    }
    default:
      die(`unknown command "${cmd}" — try: formatho help`);
  }
} catch (e) {
  if (e instanceof SyntaxError) die(`invalid JSON input: ${e.message}`);
  die(e.message);
}
