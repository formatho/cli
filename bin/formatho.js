#!/usr/bin/env node
/**
 * formatho — privacy-first dev tools in your terminal
 * 100% local. No network calls. No telemetry. Ever.
 * Web versions: https://formatho.com
 */
import { createHash, createHmac, randomUUID, randomBytes } from "node:crypto";

const VERSION = "0.2.0";
const HELP = `formatho v${VERSION} — privacy-first dev tools, 100% local (https://formatho.com)

Usage: formatho <command> [options]
       echo \input\ | formatho <command>

Data:
  json <file|->             Pretty-print JSON (reads stdin with -)
  json-min <file|->         Minify JSON
  base64 encode|decode       Base64 encode/decode (stdin ok)
  hex encode|decode          Hex encode/decode
  url encode|decode          URL encode/decode
  env [file|-]               Parse .env to JSON

IDs:
  uuid [n]                  Generate n UUID v4 (default 1, max 100)
  ulid [n]                  Generate n ULIDs (timestamp-sortable)
  random [length]           Random alphanumeric string (default 32)

Text:
  case <style> [text]       camel|snake|kebab|pascal|constant|title
  slug [text]               URL slugify
  regex <pattern> [text]    Test regex with capture groups

Security:
  hash <algo> [text]        md5|sha1|sha256|sha512 (stdin ok)
  hmac <algo> <key> [text]  HMAC with key
  jwt [token]               Decode JWT header + claims (no verification)

Time:
  timestamp [ts|iso]        Convert unix<->ISO (default: now)

help | version

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

    case "hex": {
      const mode = sub || "encode";
      const text = await readArgOrStdin(rest[0]);
      if (mode === "encode") out(Buffer.from(text, "utf8").toString("hex"));
      else if (mode === "decode") out(Buffer.from(text.trim(), "hex").toString("utf8"));
      else die("usage: formatho hex encode|decode [text]");
      break;
    }
    case "env": {
      const src = sub === "-" || sub === undefined ? await readStdin()
        : (await import("node:fs")).readFileSync(sub, "utf8");
      const result = {};
      for (const line of src.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        result[key] = val;
      }
      out(result);
      break;
    }
    case "ulid": {
      const n = Math.min(parseInt(sub || "1", 10) || 1, 100);
      const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      const gen = () => {
        let time = Date.now(), ts = "";
        for (let i = 0; i < 10; i++) { ts = CROCKFORD[time % 32] + ts; time = Math.floor(time / 32); }
        const rnd = randomBytes(16);
        let rs = "";
        for (let i = 0; i < 16; i++) rs += CROCKFORD[rnd[i] % 32];
        return ts + rs;
      };
      out(Array.from({ length: n }, gen), { count: n });
      break;
    }
    case "case": {
      const style = (sub || "").toLowerCase();
      const styles = ["camel", "snake", "kebab", "pascal", "constant", "title"];
      if (!styles.includes(style)) die(`style must be one of: ${styles.join(", ")}`);
      const text = await readArgOrStdin(rest[0]);
      const words = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").split(/[\s_-]+/).filter(Boolean);
      const result = {
        camel: words.map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()).join(""),
        snake: words.map(w => w.toLowerCase()).join("_"),
        kebab: words.map(w => w.toLowerCase()).join("-"),
        pascal: words.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(""),
        constant: words.map(w => w.toUpperCase()).join("_"),
        title: words.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ")
      }[style];
      out(result, { style });
      break;
    }
    case "regex": {
      const pattern = sub;
      if (!pattern) die("usage: formatho regex <pattern> [text]");
      const text = await readArgOrStdin(rest[0]);
      const re = new RegExp(pattern);
      const match = text.match(re);
      if (!match) out({ matched: false }, { pattern });
      else out({ matched: true, match: match[0], groups: match.slice(1), index: match.index }, { pattern });
      break;
    }
    case "hmac": {
      const algo = (sub || "sha256").toLowerCase();
      const key = rest[0];
      if (!key) die("usage: formatho hmac <algo> <key> [text]");
      const text = await readArgOrStdin(rest[1]);
      if (!["sha256", "sha512"].includes(algo)) die(`unsupported algorithm "${algo}" (sha256|sha512)`);
      const { createHmac } = await import("node:crypto");
      out(createHmac(algo, key).update(text).digest("hex"), { algorithm: algo });
      break;
    }
    case "jwt": {
      const token = await readArgOrStdin(sub);
      const parts = token.split(".");
      if (parts.length < 2) die("not a JWT (expected 3 dot-separated segments)");
      const decode = (s) => JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="), "base64").toString("utf8"));
      const result = { header: decode(parts[0]), payload: decode(parts[1]) };
      if (result.payload.exp) {
        result.expired = Date.now() / 1000 > result.payload.exp;
        result.expiresAt = new Date(result.payload.exp * 1000).toISOString();
      }
      out(result);
      break;
    }
    default:
      die(`unknown command "${cmd}" — try: formatho help`);
  }
} catch (e) {
  if (e instanceof SyntaxError) die(`invalid JSON input: ${e.message}`);
  die(e.message);
}
