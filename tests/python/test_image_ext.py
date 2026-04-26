import pytest
import vault_clipper_host as host


@pytest.mark.parametrize(
    "url, expected",
    [
        ("https://x.test/photo.jpg", ".jpg"),
        ("https://x.test/photo.JPEG", ".jpeg"),
        ("https://x.test/photo.PNG", ".png"),
        ("https://x.test/icon.svg?v=2", ".svg"),
        ("https://x.test/anim.gif#frag", ".gif"),
        ("https://x.test/photo.webp?w=400&h=300", ".webp"),
        ("https://x.test/no-extension", ".png"),
        ("https://x.test/weird.bin", ".png"),
        ("https://x.test/photo.avif", ".avif"),
    ],
)
def test_get_image_extension(url, expected):
    assert host.get_image_extension(url) == expected


def test_unique_filepath_returns_input_when_free(tmp_path):
    p = tmp_path / "note.md"
    assert host.unique_filepath(p) == p


def test_unique_filepath_appends_counter_on_collision(tmp_path):
    p = tmp_path / "note.md"
    p.write_text("first")
    second = host.unique_filepath(p)
    assert second.name == "note-2.md"

    second.write_text("second")
    third = host.unique_filepath(p)
    assert third.name == "note-3.md"
