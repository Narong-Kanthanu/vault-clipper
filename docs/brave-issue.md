# Brave bug report draft — native messaging host not discovered on macOS 26

This file is a ready-to-paste reproduction for filing as a Brave issue at
<https://github.com/brave/brave-browser/issues>. Search existing issues for
`native messaging macOS 26` or `launch_context.cc:148` first to avoid filing a
duplicate.

---

## Summary

On **macOS 26 (Tahoe)** with **Brave 147.1.89.143**, `chrome.runtime.sendNativeMessage()`
returns `Specified native messaging host not found.` even when the host
manifest is present in every documented Chromium NMH search path.

The same machine, same host manifest works with Google Chrome.

## Environment

- macOS 26.4.1 (build 25E253), Apple Silicon
- Brave Browser 147.1.89.143 (Chromium 147)
- Unpacked extension loaded from a developer-mode profile

## Repro

1. Build any Manifest V3 extension that calls `chrome.runtime.sendNativeMessage('com.example.host', ...)` with `nativeMessaging` permission granted
2. Place the host manifest at every documented Chromium location:
   ```
   ~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.example.host.json
   /Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.example.host.json   # via sudo
   ~/Library/Application Support/Chromium/NativeMessagingHosts/com.example.host.json
   ```
3. Manifest content (verified valid JSON, UTF-8 no BOM, LF line endings):
   ```json
   {
     "name": "com.example.host",
     "description": "Test",
     "path": "/Users/<you>/.config/example/host.py",
     "type": "stdio",
     "allowed_origins": ["chrome-extension://<EXTENSION_ID>/"]
   }
   ```
4. `chmod +x` the host script. Confirm it runs from the terminal.
5. **Fully** quit Brave (`⌘Q`), reopen, click the extension's "send native message" trigger.

### Expected

The host process launches and the extension receives a reply.

### Actual

```
WARNING:chrome/browser/extensions/api/messaging/launch_context.cc:148
Can't find manifest for native messaging host com.example.host
```

…in the popup/console as `Specified native messaging host not found.`

## Things ruled out

- ✅ Manifest content is valid (JSON parses, UTF-8 no BOM, LF, no hidden chars)
- ✅ Host name in manifest matches `sendNativeMessage()` argument
- ✅ Extension ID in `allowed_origins` matches `brave://extensions/` ID, with trailing slash
- ✅ `nativeMessaging` permission granted in `Default/Secure Preferences` → `extensions.settings.<id>.granted_permissions.api`
- ✅ Host script is executable, has absolute shebang to `/opt/homebrew/bin/python3`
- ✅ Brave restarted *after* manifests were written (verified via `ps -p <pid> -o lstart`)
- ✅ No admin policies (`brave://policy/` empty)
- ✅ No `--user-data-dir` or other override in Brave's process args
- ✅ No quarantine xattr on manifest or script
- ✅ Same files readable from any non-Brave process (`os.path.exists` and `os.access(p, R_OK)` both `True`)
- ✅ `find` confirms manifests present in all 5 paths attempted: `BraveSoftware/Brave-Browser/`, `/Library/Application Support/BraveSoftware/Brave-Browser/`, `Chromium/`, `com.brave.Browser/`, `Brave Browser/`
- ✅ Same machine, **Chrome works** with the host manifest in `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`

## Suspected cause

macOS 26 introduced stricter App Management protections. The
`com.apple.provenance` xattr on directories created by non-Brave processes
(e.g. an installer running under `zsh`/`bash`) carries a different tag than
Brave's own user-data directories, and Brave's `base::PathExists()` check in
`LaunchContext::FindManifest` returns false for those files.

`/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/`
created via `sudo mkdir` was *also* not seen, so the cause may be deeper than
provenance — possibly a Tahoe-introduced TCC restriction on `~/Library` reads
for non-Apple browsers, or Brave's NMH search path on macOS 26 is different
from what the public docs and Chromium source describe.

## What would help confirm

- An `fs_usage -w -f filesys` trace of the Brave process during `sendNativeMessage` to show which paths it actually attempts to `open()` and what errno it gets
- A controlled test on macOS 15 (Sequoia) with the same Brave 147 build — if the bug doesn't repro there, this is Tahoe-specific
