# TermBanner HTTP API

Generate colored ANSI banners by URL. The endpoint runs as a Cloudflare Pages
Function and produces output identical to the web app.

Base URL: `https://termbanner.com`

## `GET /api`

Renders a banner.

- **Terminal / scripts** (no `text/html` in `Accept`): responds
  `text/plain; charset=utf-8` with raw ANSI escape bytes, so the colors render
  when piped to a terminal.
- **Browsers** (`Accept: text/html`): responds with an HTML page that renders
  the banner in real color (ANSI escapes are not interpreted by browsers).

### Parameters

| Param | Required | Default | Description |
| --- | --- | --- | --- |
| `text` | yes | - | Banner text. Use `\n` (a literal backslash + n) for a new line. Max 200 characters. |
| `font` | no | `ANSI Shadow` | Font name or key. Matching is case-insensitive and treats spaces, `-`, and `_` as equivalent. |
| `mode` | no | `ansi` | `ansi` for color escapes, `plain` for uncolored ASCII. |
| `color` | no | - | Solid foreground hex (`ff0000` or `#ff0000`). FIGlet/ANSI fonts only. |
| `gradient` | no | `33ff00,0066ff` | Comma-separated hex stops for a vertical gradient. FIGlet/ANSI fonts only. Max 10 stops. |
| `depth` | no | `truecolor` | Color depth: `truecolor`, `256`, or `16`. |
| `letterspacing` | no | `0` | Extra space between characters. Range [-50, 50]. |
| `linespacing` | no | `1` | Blank lines between text lines (line gap). Range [-50, 50]. |
| `padleft` | no | `1` | Left padding. Range [-50, 100]. |
| `padtop` | no | `1` | Top padding. Range [-50, 100]. |
| `padbottom` | no | `1` | Bottom padding. Range [-50, 100]. |
| `palette` | no | - | TheDraw per-slot color override (see below). TheDraw fonts only. |
| `plaincolor` | no | - | Solid hex for `{{ }}` plain-text lines. Omitted: auto (solid color for FIGlet/ANSI, dominant color for TheDraw). |
| `format` | no | - | Return a ready-to-run script instead of raw ANSI (see below). |

### Color behavior by font type

- **FIGlet (`.flf`) and built-in ANSI fonts:** colored by `color` (solid) or
  `gradient`. If neither is given, the default gradient is used.
- **TheDraw (`.tdf`) fonts:** keep their built-in multi-color art. `color` and
  `gradient` are ignored; use `palette` to recolor individual slots. The
  background is transparent by default (only non-black backgrounds are drawn),
  matching the web app.

### Choosing a font

`font` accepts a display name (`ANSI Shadow`, `1911 Blue`) or a key. Because some
names collide after normalization, you can force an exact match with a kind
prefix:

- `font=flf:Roman` - the FIGlet font keyed `Roman`
- `font=tdf:Roman` - the TheDraw font keyed `Roman`

List every available font name:

```sh
curl 'https://termbanner.com/api/fonts'
```

### TheDraw palette override

`palette` is a comma-separated list of `SLOT-FGHEX[-BGHEX]` entries. Only the
slots you list are changed; the rest keep their built-in colors.

- `SLOT` - two hex digits from the font's color slots (with or without `0x`).
- `FGHEX` - required foreground hex.
- `BGHEX` - optional background hex; omit to keep the slot's built-in background.

```sh
curl 'https://termbanner.com/api?text=HI&font=1911&palette=01-ff0000-000000,07-00ff00'
```

### Script export (`format`)

With `format`, the API returns a complete, self-contained script that prints the
banner, instead of raw ANSI. The script embeds all color depths
(truecolor/256/16) plus a plain fallback and picks the right one at runtime, so
`mode` and `depth` are ignored when `format` is set. `color`, `gradient`,
`palette`, and spacing still apply.

| `format` | Output | Filename |
| --- | --- | --- |
| `bash` / `sh` | POSIX shell | `termbanner.sh` |
| `powershell` / `ps1` | PowerShell | `termbanner.ps1` |
| `python` / `py` | Python | `termbanner.py` |
| `go` | Go | `termbanner.go` |
| `rust` / `rs` | Rust | `termbanner.rs` |
| `javascript` / `js` | JavaScript | `termbanner.js` |

The response sets `Content-Disposition` with the suggested filename.

```sh
# print a colored banner from a startup script
curl -s 'https://termbanner.com/api?text=DEPLOY&font=Standard&color=ff8800&format=bash' | sh

# save a ready-to-run script
curl -s 'https://termbanner.com/api?text=DEPLOY&font=Standard&format=python' -o banner.py
```

### Plain text lines

Wrap literal text in `{{ }}` inside `text` to add non-font lines above, below, or
between the banner art. Blocks may span multiple lines (URL-encode newlines as
`%0A`) and preserve blank lines and leading spaces, so you can position the text.
All `{{ }}` lines use one solid color: `plaincolor`, or an auto default that
matches the font when `plaincolor` is omitted.

```sh
curl 'https://termbanner.com/api?text=%7B%7BCreated%20by%20BRADSEC%7D%7D%0ATERM&font=ANSI%20Shadow&plaincolor=00ddff'
```

### Errors

Plain-text responses:

- `400` - missing `text`; `text` too long; unknown `font`; invalid hex; too many
  gradient stops; spacing/padding out of range; unknown palette slot; rendered
  output too large.
- `405` - non-`GET` method.

## `GET /api/fonts`

Returns a `text/plain` newline-separated list of available font display names.

## Examples

```sh
# Gradient FIGlet banner
curl 'https://termbanner.com/api?text=HELLO&font=ANSI%20Shadow&gradient=33ff00,0066ff'

# Solid color, 256-color depth
curl 'https://termbanner.com/api?text=DEPLOY&font=Standard&color=ff8800&depth=256'

# Multi-line, extra spacing
curl 'https://termbanner.com/api?text=TERM%0ABANNER&font=ANSI%20Shadow&letterspacing=2&linespacing=2'

# Uncolored ASCII
curl 'https://termbanner.com/api?text=HI&font=Standard&mode=plain'

# TheDraw font, built-in colors
curl 'https://termbanner.com/api?text=HI&font=1911'
```

## Notes

- Successful responses send `Cache-Control: public, max-age=86400`; identical
  requests are served from the CDN edge cache.
- The API is public, read-only, and rate-limited at the edge.
- The web app shows a copyable `curl` command that reproduces the current banner,
  so a design built in the UI can be replayed from the command line.
