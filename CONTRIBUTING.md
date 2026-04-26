# Contributing to Vault Clipper

Thanks for your interest in contributing! This project is small and friendly — bug reports, feature ideas, and pull requests are all welcome.

## Code of Conduct

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs

Please open a [GitHub issue](https://github.com/Narong-Kanthanu/vault-clipper/issues) using the **Bug report** template. Include:

- Browser + version (Brave, Chrome, Chromium, …)
- macOS / Linux / Windows version
- Python 3 version (`python3 --version`)
- Steps to reproduce
- Expected vs. actual behavior
- Output of `cat /tmp/vault-clipper.log` if relevant

## Suggesting features

Open an issue with the **Feature request** template. Please describe the use case before the proposed solution — it helps us discuss the smallest change that solves the problem.

## Development setup

1. **Fork and clone** the repo.
2. **Load the extension** in your browser:
   - Open `brave://extensions/` (or `chrome://extensions/`)
   - Enable **Developer mode**
   - Click **Load unpacked** and select this repo's root folder
   - Copy the **extension ID**
3. **Register the native messaging host**:
   ```bash
   ./install.sh --extension-id <YOUR_EXTENSION_ID>
   ```
4. **Fully quit** and reopen the browser (Cmd+Q on macOS — closing the window is not enough).
5. **Configure vaults** via the extension's settings page (it opens automatically on first install).

After editing extension code, click the reload icon on the extension card. After editing `native-host/vault_clipper_host.py`, re-run `./install.sh` to copy the updated script.

## Project layout

```
.
├── manifest.json                 # MV3 manifest
├── popup/                        # Toolbar popup UI
├── options/                      # Settings page (vaults config)
├── background/service-worker.js  # Bridges popup ↔ native host
├── content/                      # (reserved for future content scripts)
├── lib/turndown.js               # Vendored HTML→Markdown library
├── native-host/                  # Python native messaging host
└── install.sh                    # Native host installer
```

## Code style

- **JavaScript**: vanilla ES2020+, no build step. Match the existing style — 2-space indent, single quotes, semicolons.
- **Python**: standard library only, PEP 8.
- **HTML/CSS**: keep the dark Obsidian-purple theme (`#7f6df2`).
- Avoid adding dependencies. The whole point of this extension is that it has none.

## Pull request checklist

- [ ] One logical change per PR
- [ ] Tested on at least Brave or Chrome with Manifest V3
- [ ] No hardcoded user-specific paths in committed code
- [ ] `install.sh` and `manifest.json` updated if file layout changed
- [ ] CHANGELOG.md updated under `## [Unreleased]`
- [ ] README updated if behavior or setup changed

## Compatibility goals

- **Output format** must remain interchangeable with [Obsidian Web Clipper](https://obsidian.md/clipper) — same frontmatter fields, same wikilink style for images.
- **No telemetry**, no remote calls except to fetch images that the user explicitly opted into.

## Releasing (maintainers)

1. Bump `version` in `manifest.json`
2. Move `## [Unreleased]` notes to a dated version section in `CHANGELOG.md`
3. Tag the release: `git tag v0.X.Y && git push --tags`
4. Optionally attach a zipped build to the GitHub release page

Thanks again — happy clipping!
