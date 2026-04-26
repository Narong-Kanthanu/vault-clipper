# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Narong-Kanthanu/vault-clipper/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Narong-Kanthanu/vault-clipper/releases/tag/v1.0.0
