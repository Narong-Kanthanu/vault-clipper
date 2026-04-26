import vault_clipper_host as host


def test_handle_clip_writes_markdown_to_target_folder(tmp_path):
    result = host.handle_clip({
        "vault_path": str(tmp_path),
        "folder": "raw",
        "filename": "hello.md",
        "content": "# hello\n\nbody\n",
    })

    assert result["success"] is True
    written = tmp_path / "raw" / "hello.md"
    assert written.read_text() == "# hello\n\nbody\n"
    assert result["path"] == str(written)
    assert result["images_downloaded"] == 0


def test_handle_clip_appends_counter_on_collision(tmp_path):
    msg = {
        "vault_path": str(tmp_path),
        "folder": "raw",
        "filename": "note.md",
        "content": "v1",
    }
    first = host.handle_clip(msg)
    second = host.handle_clip({**msg, "content": "v2"})

    assert first["success"] is True and second["success"] is True
    assert first["path"].endswith("/raw/note.md")
    assert second["path"].endswith("/raw/note-2.md")
    assert (tmp_path / "raw" / "note.md").read_text() == "v1"
    assert (tmp_path / "raw" / "note-2.md").read_text() == "v2"


def test_handle_clip_creates_assets_dir_even_without_images(tmp_path):
    host.handle_clip({
        "vault_path": str(tmp_path),
        "folder": "raw",
        "filename": "note.md",
        "content": "hi",
    })
    assert (tmp_path / "raw" / "assets").is_dir()


def test_handle_clip_rewrites_image_urls_after_download(tmp_path, monkeypatch):
    """When download_image succeeds, markdown image refs get rewritten to wikilinks."""

    def fake_download(url, save_path, timeout=10, max_size=10 * 1024 * 1024):
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_bytes(b"fake-image-bytes")
        return True

    monkeypatch.setattr(host, "download_image", fake_download)

    md = (
        "# title\n\n"
        "![alt](https://cdn.example.com/photo.jpg)\n"
        "![](https://cdn.example.com/diagram.png)\n"
    )

    result = host.handle_clip({
        "vault_path": str(tmp_path),
        "folder": "raw",
        "filename": "post.md",
        "content": md,
        "download_images": True,
        "images": [
            {"url": "https://cdn.example.com/photo.jpg", "index": 0},
            {"url": "https://cdn.example.com/diagram.png", "index": 1},
        ],
    })

    assert result["success"] is True
    assert result["images_downloaded"] == 2
    written = (tmp_path / "raw" / "post.md").read_text()
    assert "https://cdn.example.com/photo.jpg" not in written
    assert "https://cdn.example.com/diagram.png" not in written
    assert "![[assets/post-img-00.jpg]]" in written
    assert "![[assets/post-img-01.png]]" in written
    assert (tmp_path / "raw" / "assets" / "post-img-00.jpg").exists()
    assert (tmp_path / "raw" / "assets" / "post-img-01.png").exists()


def test_handle_clip_skips_image_rewrite_when_download_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(host, "download_image", lambda *a, **kw: False)

    md = "![alt](https://cdn.example.com/photo.jpg)\n"
    result = host.handle_clip({
        "vault_path": str(tmp_path),
        "folder": "raw",
        "filename": "post.md",
        "content": md,
        "download_images": True,
        "images": [{"url": "https://cdn.example.com/photo.jpg", "index": 0}],
    })

    assert result["success"] is True
    assert result["images_downloaded"] == 0
    assert "https://cdn.example.com/photo.jpg" in (tmp_path / "raw" / "post.md").read_text()


def test_handle_clip_returns_error_when_vault_missing(tmp_path):
    missing = tmp_path / "does-not-exist"
    result = host.handle_clip({
        "vault_path": str(missing),
        "folder": "raw",
        "filename": "note.md",
        "content": "hi",
    })
    assert result["success"] is False
    assert "vault path" in result["error"].lower()


def test_handle_clip_requires_vault_path():
    result = host.handle_clip({"filename": "x.md", "content": "y"})
    assert result["success"] is False
    assert "vault_path" in result["error"]
