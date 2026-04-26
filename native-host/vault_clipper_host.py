#!/usr/bin/env python3
"""
Vault Clipper — Native Messaging Host

Receives clip data from the Vault Clipper browser extension and writes
markdown files to a local Obsidian-compatible vault directory.

Protocol: Chrome Native Messaging (4-byte LE length prefix + JSON)
"""

import json
import os
import re
import struct
import sys
import urllib.request
import urllib.error
from pathlib import Path


def read_message():
    """Read a native messaging message from stdin."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length or len(raw_length) < 4:
        return None
    length = struct.unpack('<I', raw_length)[0]
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode('utf-8'))


def send_message(obj):
    """Send a native messaging response to stdout."""
    encoded = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def get_image_extension(url):
    """Extract a safe file extension from an image URL."""
    path = url.split('?')[0].split('#')[0]
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico'):
        return ext
    return '.png'


def download_image(url, save_path, timeout=10, max_size=10 * 1024 * 1024):
    """Download an image to the specified path. Returns True on success."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/120.0.0.0 Safari/537.36'
        })
        with urllib.request.urlopen(req, timeout=timeout) as response:
            content_length = response.headers.get('Content-Length')
            if content_length and int(content_length) > max_size:
                return False

            data = response.read(max_size + 1)
            if len(data) > max_size:
                return False

            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, 'wb') as f:
                f.write(data)
            return True
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError):
        return False


def safe_relative_subpath(parts):
    """Validate that `parts` is a safe relative subpath (no abs paths, no `..`)."""
    p = Path(parts)
    if p.is_absolute():
        raise ValueError(f"absolute paths are not allowed: {parts!r}")
    if any(part == ".." for part in p.parts):
        raise ValueError(f"parent traversal not allowed: {parts!r}")
    return p


def safe_filename(name):
    """Validate a single filename: no path separators, no `..`, not empty."""
    if not name or name in (".", ".."):
        raise ValueError(f"invalid filename: {name!r}")
    if "/" in name or "\\" in name:
        raise ValueError(f"filename contains path separator: {name!r}")
    return name


def unique_filepath(filepath):
    """If filepath exists, append -2, -3, etc. until unique."""
    if not filepath.exists():
        return filepath
    stem = filepath.stem
    suffix = filepath.suffix
    parent = filepath.parent
    counter = 2
    while True:
        new_path = parent / f"{stem}-{counter}{suffix}"
        if not new_path.exists():
            return new_path
        counter += 1


def handle_clip(msg):
    """Handle a clip action: write markdown + download images."""
    vault_path_str = msg.get('vault_path')
    if not vault_path_str:
        return {'success': False, 'error': 'vault_path is required'}

    vault_path = Path(vault_path_str).expanduser()
    folder = msg.get('folder', 'raw')
    filename = msg['filename']
    content = msg['content']
    images = msg.get('images', [])
    download_imgs = msg.get('download_images', False)

    try:
        safe_folder = safe_relative_subpath(folder)
        safe_name = safe_filename(filename)
    except ValueError as e:
        return {'success': False, 'error': str(e)}

    if not vault_path.exists():
        return {
            'success': False,
            'error': f'Vault path does not exist: {vault_path}'
        }

    # Target: {vault_path}/{folder}/
    target_dir = vault_path / safe_folder
    target_dir.mkdir(parents=True, exist_ok=True)

    # Assets: {vault_path}/{folder}/assets/
    assets_dir = target_dir / 'assets'
    assets_dir.mkdir(parents=True, exist_ok=True)

    images_downloaded = 0
    if download_imgs and images:
        article_slug = Path(safe_name).stem
        for img in images:
            url = img.get('url', '')
            if not url:
                continue

            ext = get_image_extension(url)
            img_filename = f"{article_slug}-img-{img.get('index', 0):02d}{ext}"
            img_path = unique_filepath(assets_dir / img_filename)

            if download_image(url, img_path):
                images_downloaded += 1
                escaped_url = re.escape(url)
                content = re.sub(
                    r'!\[[^\]]*\]\(' + escaped_url + r'\)',
                    f'![[assets/{img_path.name}]]',
                    content
                )

    filepath = unique_filepath(target_dir / safe_name)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return {
        'success': True,
        'path': str(filepath),
        'images_downloaded': images_downloaded
    }


def log(msg):
    """Append a debug line to /tmp/vault-clipper.log (stderr is discarded by Chrome)."""
    import datetime
    log_path = Path('/tmp/vault-clipper.log')
    try:
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except OSError:
        pass


def main():
    try:
        log("Native host started")
        msg = read_message()
        if not msg:
            log("No message received")
            send_message({'success': False, 'error': 'No message received'})
            return

        log(f"Received action={msg.get('action')} vault_path={msg.get('vault_path')} filename={msg.get('filename')}")

        action = msg.get('action', '')
        if action == 'clip':
            result = handle_clip(msg)
            log(f"Result: {result}")
            send_message(result)
        else:
            send_message({'success': False, 'error': f'Unknown action: {action}'})

    except Exception as e:
        import traceback
        log(f"ERROR: {traceback.format_exc()}")
        try:
            send_message({'success': False, 'error': str(e)})
        except Exception:
            pass
        sys.exit(1)


if __name__ == '__main__':
    main()
