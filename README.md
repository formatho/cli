# formatho — privacy-first dev tools in your terminal

<p align="center"><img src=".github/logo.png" width="120" alt="Formatho logo"></p>

100% local. Zero dependencies. Zero telemetry. Your data never leaves your machine.

Web versions with 100+ tools: **[formatho.com](https://formatho.com)**

## Install / run instantly

```bash
npx formatho json data.json
echo '{"b":2,"a":1}' | npx formatho json
npx formatho base64 encode "hello world"
npx formatho uuid 10
```

## Commands

| Command | Example |
|---|---|
| `json <file\|->` | `npx formatho json package.json` |
| `json-min <file\|->` | `cat x.json \| npx formatho json-min` |
| `base64 encode\|decode` | `npx formatho base64 encode hi` |
| `url encode\|decode` | `npx formatho url encode "a b&c"` |
| `hash <algo>` | `npx formatho hash sha256 "secret"` |
| `uuid [n]` | `npx formatho uuid 5` |
| `random [len]` | `npx formatho random 64` |
| `slug` | `npx formatho slug "Hello World!"` |
| `timestamp [ts\|iso]` | `npx formatho timestamp 1756051200` |

## AI-agent friendly

- `--json` flag outputs structured, parseable results: `npx formatho uuid --json`
- All tools read stdin — pipe-friendly for scripts and agents
- Deterministic exit codes; errors are machine-readable with `--json`
- No network calls at runtime — safe for sandboxed agents

## Privacy

No analytics. No config files. No phone-home. Read the source — it's ~150 lines using only Node built-ins.

## License

MIT © [Formatho](https://formatho.com)
