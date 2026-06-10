# Testing Exported Banner Scripts

Download a banner from the app then use the commands below to run it locally.
Each section also shows how to force a specific color mode for testing.

---

## Shell (.sh) — Linux / macOS

```bash
sh banner.sh
```

```bash
bash banner.sh
```

Force each color mode:

```bash
# Plain (no color)
NO_COLOR=1 sh banner.sh

# Truecolor
COLORTERM=truecolor sh banner.sh

# 256 color (override tput detection)
TERM=xterm-256color sh banner.sh

# 16 color
TERM=xterm sh banner.sh
```

---

## PowerShell (.ps1) — Windows / Linux / macOS

Requires PowerShell 5.1+ (Windows) or `pwsh` (PowerShell 7, cross-platform).

```powershell
.\banner.ps1
```

```bash
# Linux / macOS
pwsh banner.ps1
```

Force each color mode:

```powershell
# Plain
$env:NO_COLOR = '1'; .\banner.ps1; Remove-Item Env:NO_COLOR

# Truecolor (simulates Windows Terminal)
$env:COLORTERM = 'truecolor'; .\banner.ps1; Remove-Item Env:COLORTERM

# 256 color
$env:TERM = 'xterm-256color'; .\banner.ps1; Remove-Item Env:TERM

# 16 color (default fallback — just run normally without the above vars set)
.\banner.ps1
```

---

## Python (.py) — Linux / macOS / Windows

Requires Python 3.

```bash
python3 banner.py
```

```bash
# Windows
python banner.py
```

Force each color mode:

```bash
NO_COLOR=1 python3 banner.py
COLORTERM=truecolor python3 banner.py
TERM=xterm-256color python3 banner.py
TERM=xterm python3 banner.py
```

---

## Go (.go) — Linux / macOS / Windows

Requires the [Go toolchain](https://go.dev/dl/). No compilation step needed for a quick test.

```bash
go run banner.go
```

To compile a standalone binary:

```bash
go build -o banner banner.go
./banner
```

Force each color mode:

```bash
NO_COLOR=1 go run banner.go
COLORTERM=truecolor go run banner.go
TERM=xterm-256color go run banner.go
TERM=xterm go run banner.go
```

---

## Rust (.rs) — Linux / macOS / Windows

Requires [Rust](https://rustup.rs/) (`rustc` is included with any Rust install).

Compile and run in one step:

```bash
rustc banner.rs -o banner && ./banner
```

```cmd
# Windows
rustc banner.rs -o banner.exe && banner.exe
```

Or use Cargo for a throwaway project:

```bash
cargo new testbanner
cp banner.rs testbanner/src/main.rs
cd testbanner && cargo run
```

Force each color mode:

```bash
NO_COLOR=1 ./banner
COLORTERM=truecolor ./banner
TERM=xterm-256color ./banner
TERM=xterm ./banner
```

---

## JavaScript (.js) — Linux / macOS / Windows

Requires [Node.js](https://nodejs.org/).

```bash
node banner.js
```

The file has a `#!/usr/bin/env node` shebang, so on Linux/macOS you can also make it executable:

```bash
chmod +x banner.js
./banner.js
```

Force each color mode:

```bash
NO_COLOR=1 node banner.js
COLORTERM=truecolor node banner.js
TERM=xterm-256color node banner.js
TERM=xterm node banner.js
```

```powershell
# Windows PowerShell
$env:NO_COLOR = '1'; node banner.js; Remove-Item Env:NO_COLOR
$env:COLORTERM = 'truecolor'; node banner.js; Remove-Item Env:COLORTERM
```

---

## Quick checklist

| Check | What to look for |
|---|---|
| Truecolor | Smooth gradient with 24-bit RGB colors |
| 256 color | Colors visible, slightly quantized vs truecolor |
| 16 color | Colors visible, more limited palette |
| Plain / NO_COLOR | No escape codes, clean readable text |
| Piped output | `./banner \| cat` — plain text should flow through cleanly |
