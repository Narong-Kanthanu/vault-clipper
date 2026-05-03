# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] — 2026-05-03

### Changed

- Settings tab now closes itself shortly after a successful save, returning the user to whatever they were doing.
- Refactored popup and options pages into smaller single-responsibility sections for easier maintenance.

### Fixed

- Settings page can now be opened from the popup in Chrome. The manifest was missing an `options_ui` entry, so `chrome.runtime.openOptionsPage()` silently failed and the popup's ⚙ button and "Open Settings" CTA did nothing on Chrome.
- `install.sh` now auto-detects which Chromium-based browsers (Brave, Chrome, Chromium) are installed and registers the native messaging host for each. Previously the script defaulted to Brave + Chromium and silently skipped Chrome unless `--chrome` was passed, leaving Chrome users with "Specified native messaging host not found" on first clip. Pass `--brave` / `--chrome` / `--chromium` to override detection.

## [1.0.0] — 2026-04-26

### Added

- Initial open-source release of Vault Clipper.
- Manifest V3 browser extension for Brave and Chrome that clips web pages as Obsidian-compatible markdown.
- HTML-to-markdown conversion via vendored Turndown.js.
- Article content extraction with site-chrome filtering (nav, footer, ads, comments).
- Optional image downloading to `<folder>/assets/` with `![[wikilink]]` references.
- Output frontmatter is interchangeable with [Obsidian Web Clipper](https://obsidian.md/clipper).
- Native messaging host (Python, stdlib only) for direct filesystem writes.
- Settings page where users add as many vaults as they want, each with its own folder path.
- Toolbar popup with vault toggle, editable title, tags, and download-images toggle.
- `install.sh` registers the native host with Brave/Chrome/Chromium and copies the host script to `~/.config/vault-clipper/` to satisfy macOS sandbox rules.

[Unreleased]: https://github.com/Narong-Kanthanu/vault-clipper/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/Narong-Kanthanu/vault-clipper/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Narong-Kanthanu/vault-clipper/releases/tag/v1.0.0
