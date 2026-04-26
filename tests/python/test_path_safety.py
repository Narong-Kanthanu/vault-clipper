import pytest
import vault_clipper_host as host


@pytest.mark.parametrize("good", ["raw", "Notes", "a/b/c", "deep/nested/folder"])
def test_safe_relative_subpath_accepts_simple_relatives(good):
    p = host.safe_relative_subpath(good)
    assert not p.is_absolute()


@pytest.mark.parametrize(
    "bad",
    [
        "/etc",
        "/etc/passwd",
        "..",
        "../etc",
        "../../etc",
        "foo/../bar",
        "a/b/../../etc",
    ],
)
def test_safe_relative_subpath_rejects_traversal_and_absolute(bad):
    with pytest.raises(ValueError):
        host.safe_relative_subpath(bad)


@pytest.mark.parametrize("good", ["note.md", "Hello World.md", "u-2026.txt"])
def test_safe_filename_accepts_plain_names(good):
    assert host.safe_filename(good) == good


@pytest.mark.parametrize(
    "bad",
    [
        "",
        ".",
        "..",
        "../note.md",
        "sub/note.md",
        "sub\\note.md",
        "C:\\evil.md",
    ],
)
def test_safe_filename_rejects_separators_and_traversal(bad):
    with pytest.raises(ValueError):
        host.safe_filename(bad)


def test_handle_clip_rejects_folder_traversal(tmp_path):
    result = host.handle_clip({
        "vault_path": str(tmp_path),
        "folder": "../escape",
        "filename": "note.md",
        "content": "hi",
    })
    assert result["success"] is False
    assert "traversal" in result["error"].lower()
    # And nothing should have been written outside the vault.
    escape = tmp_path.parent / "escape"
    assert not escape.exists()


def test_handle_clip_rejects_absolute_folder(tmp_path):
    result = host.handle_clip({
        "vault_path": str(tmp_path),
        "folder": "/etc",
        "filename": "note.md",
        "content": "hi",
    })
    assert result["success"] is False
    assert "absolute" in result["error"].lower()


def test_handle_clip_rejects_filename_with_separator(tmp_path):
    result = host.handle_clip({
        "vault_path": str(tmp_path),
        "folder": "raw",
        "filename": "../../etc/passwd",
        "content": "hi",
    })
    assert result["success"] is False
