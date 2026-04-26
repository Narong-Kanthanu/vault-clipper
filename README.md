# Vault Clipper

A zero-dependency Brave/Chrome extension that clips web pages as Obsidian-compatible markdown files into local folders on your computer — **no Obsidian app, no cloud sync, no telemetry**.

Output frontmatter is interchangeable with [Obsidian Web Clipper](https://obsidian.md/clipper), so clips from both tools live happily side-by-side.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-blue)](manifest.json)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Why?

The official Obsidian Web Clipper requires the desktop app to be running and a configured vault. If you keep your notes in plain folders, sync them with `git`, or read on a machine where the desktop app is not installed, you still want a one-click way to capture the open page as clean markdown. This extension does exactly that and nothing more.

## Features

- **Configurable vaults.** Point each vault at any folder on disk via the settings page.
- **Smart article extraction.** Strips nav, footer, ads, comments; keeps the article body.
- **HTML → Markdown** via vendored [Turndown](https://github.com/mixmark-io/turndown) v7.2.
- **Optional image download** to `<folder>/assets/` with `![[wikilink]]` references.
- **Obsidian-friendly frontmatter** — quoted YAML, `[[wikilink]]` author lists, ISO dates.
- **No dependencies.** Vanilla JS in the extension; Python 3 stdlib only in the native host.

## How it works

```
Browser Extension (Manifest V3)              Native Host (Python 3)
┌────────────────────────────────┐           ┌──────────────────────────┐
│ popup: pick vault, edit title  │── JSON ──▶│ writes <folder>/<file>.md│
│ content: extract article HTML  │           │ downloads images         │
│ turndown.js: HTML → Markdown   │◀── JSON ──│ returns saved path       │
└────────────────────────────────┘           └──────────────────────────┘
                                                        │
                                                        ▼
                                              <your vault folder>/raw/
                                                My Page Title.md
```

## Output format

```markdown
---
title: "Article Title"
source: "https://example.com/article"
author:
  - "[[Author Name]]"
published: 2026-04-10
created: 2026-04-15T10:32:00+00:00
description: "A brief summary extracted from the page meta description"
tags:
  - "clippings"
  - "productivity"
---

Markdown content with ![[assets/image-name.png]] wikilinks...
```

| Field | Format |
|---|---|
| Frontmatter | YAML — Obsidian Properties / Dataview compatible |
| `title` | Quoted text |
| `source` | Quoted URL |
| `author` | YAML list with `[[wikilinks]]` |
| `published` | ISO date (`YYYY-MM-DD`), from page meta |
| `created` | ISO timestamp (`YYYY-MM-DDTHH:mm:ss+00:00`) |
| `description` | Quoted meta description |
| `tags` | YAML list — `clippings` is always first |
| Images | `![[assets/image-name.png]]` |
| Filename | Original page title (no kebab-case mangling) |
| Save location | `<vault folder>/<default folder>/` |

## Install

### Prerequisites

- **Brave** or **Chrome** (any Chromium-based browser with Manifest V3 support)
- **Python 3** (`python3 --version` should print 3.x — pre-installed on macOS, Linux; Windows users grab it from python.org)
- **macOS** is the primary tested platform; Linux should work; Windows is unsupported by `install.sh` today (PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md))

### Step 1 — load the extension

1. Clone this repo: `git clone https://github.com/Narong-Kanthanu/vault-clipper.git`
2. Open `brave://extensions/` (or `chrome://extensions/`)
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the cloned folder
5. Copy the **extension ID** shown on the card

### Step 2 — register the native messaging host

```bash
cd vault-clipper
./install.sh --extension-id <YOUR_EXTENSION_ID>
```

This copies the host script to `~/.config/vault-clipper/` and registers it with the browser. The script must live outside `~/Documents/` because macOS sandboxed browsers cannot execute files from protected folders.

| Flag | Purpose |
|---|---|
| `--extension-id <ID>` | Pass the ID non-interactively |
| `--chrome` | Also register for Chrome (default registers Brave + Chromium) |
| `--uninstall` | Remove native host registration and `~/.config/vault-clipper/` |

### Step 3 — fully restart the browser

**Cmd + Q** on macOS, then reopen. Closing the window is not enough — the browser process must restart for native messaging registration to take effect.

### Step 4 — configure vaults

The settings page opens automatically on first install. Add one or more vaults:

| Field | Example |
|---|---|
| Label | `Personal` |
| Folder path | `/Users/you/Documents/Vaults/Personal` |

The **Default folder** (e.g. `raw`) is the subfolder where clips land. Saved files end up at `<vault path>/<default folder>/<page title>.md`.

You can reopen settings any time via the ⚙ icon in the popup or `chrome://extensions/` → **Details** → **Extension options**.

### Step 5 — clip a page

1. Navigate to a web article
2. Click the **Vault Clipper** toolbar icon
3. Pick a vault, edit the title, optionally add tags
4. Click **Clip Page**

The markdown file is saved to `<vault path>/<default folder>/<title>.md`.

## Updating

After pulling new changes that touch `native-host/vault_clipper_host.py`, re-run the install script to copy the updated host:

```bash
./install.sh --extension-id <YOUR_EXTENSION_ID>
```

After pulling extension-only changes, just click the reload icon on the extension's card in `brave://extensions/`.

## Project layout

```
.
├── manifest.json                 # Manifest V3
├── popup/                        # Toolbar popup (vault toggle, title, tags)
├── options/                      # Settings page (vault config)
├── background/service-worker.js  # Bridges popup ↔ native host
├── lib/
│   ├── turndown.js               # Vendored HTML→Markdown (v7.2)
│   └── clip-utils.js             # Pure helpers (sanitize, frontmatter, extract)
├── icons/                        # Extension icons
├── native-host/
│   ├── vault_clipper_host.py     # Writes .md files + downloads images
│   └── com.vaultclipper.host.json
├── tests/
│   ├── js/                       # node:test + jsdom (extract, turndown, utils)
│   └── python/                   # pytest (path safety, host I/O, image rewriting)
├── .github/workflows/            # CI (lint + tests) and auto-release
├── package.json                  # jsdom dev dep for JS tests
└── install.sh                    # Registers native host
```

## Troubleshooting

### "Specified native messaging host not found"

- Re-run `install.sh` with the correct extension ID
- **Fully** quit and reopen the browser (Cmd+Q on macOS)
- Verify the manifest exists:
  ```bash
  cat ~/Library/Application\ Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.vaultclipper.host.json
  ```
- Verify the `chrome-extension://...` ID inside that file matches the one shown in `brave://extensions/`

> **Known issue — Brave 147+ on macOS 26 (Tahoe):** Brave's `launch_context.cc` logs `Can't find manifest for native messaging host com.vaultclipper.host` even when the manifest is in every documented search path (per-user, system-wide, and Chromium fallback). Native messaging works on the same machine with Chrome but not Brave, suggesting a Brave/Tahoe-specific regression. See [`docs/brave-issue.md`](docs/brave-issue.md) for the full reproduction. **Workaround:** use Chrome (`./install.sh --extension-id <ID> --chrome`) until upstream fixes it.

### "Native host has exited"

- Re-run `install.sh` (it copies the script to `~/.config/vault-clipper/`, outside macOS-protected folders)
- Check the debug log: `cat /tmp/vault-clipper.log`
- Verify Python 3: `python3 --version`

### "Failed to extract page content"

- Internal pages (`chrome://`, `brave://`, PDFs) don't allow content scripts. This is a browser limitation.
- Some auth-walled sites have limited extractable content. Try clipping after the article has finished loading.

### Images not downloading

- Some sites block hotlinked image requests. Failed images fall back to plain `![alt](url)` markdown.
- Images larger than 10 MB are skipped.

### Test the native host manually

```bash
echo '{"action":"clip","vault_path":"/tmp/test-vault","folder":"raw","filename":"test.md","content":"# Test\n","images":[],"download_images":false}' \
  | python3 -c "import struct,sys; d=sys.stdin.read().encode(); sys.stdout.buffer.write(struct.pack('<I',len(d))+d)" \
  | python3 ~/.config/vault-clipper/vault_clipper_host.py \
  | python3 -c "import struct,sys,json; raw=sys.stdin.buffer.read(); n=struct.unpack('<I',raw[:4])[0]; print(json.dumps(json.loads(raw[4:4+n]),indent=2))"
```

## Privacy

Vault Clipper makes **zero network requests** to any third party. The only outbound traffic is when **you** enable image downloading — and then only to the image URLs that appear inside the page you are clipping. No analytics, no telemetry, no auto-updates beyond what your browser does for any unpacked extension (which is none).

## Related

- [Obsidian Web Clipper](https://obsidian.md/clipper) — the official clipper. Same output format; requires the Obsidian app.
- [Andrej Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — the inspiration for storing clips as a curated wiki.

## Development

### Running tests locally

```bash
# JavaScript suite — node:test + jsdom + the vendored Turndown bundle
npm ci
node --test 'tests/js/**/*.test.js'

# Python suite — pytest against the native host
pip install pytest
pytest tests/python -v
```

Both suites run automatically on every PR via [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — JS on Node 20, Python on a 3.9 → 3.13 matrix. The aggregate `CI / required` job is the one to set as a required check in branch protection.

### Releasing

A new release is cut automatically when a versioned heading is added to [`CHANGELOG.md`](CHANGELOG.md) on `main`. The workflow at [`.github/workflows/release.yml`](.github/workflows/release.yml) parses the latest `## [X.Y.Z]` heading, verifies it matches `manifest.json`, tags `vX.Y.Z`, and publishes a GitHub release with notes extracted from the changelog and a packaged extension zip attached.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Narong Kanthanu
