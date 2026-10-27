"""history/ (dialog archive) and other committed text must never contain credentials."""
from pdd import secretscan
from pdd.paths import REPO

FAKE_GHP = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
FAKE_PAT = "github_pat_" + "11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345"


def test_finds_github_tokens_and_other_keys():
    text = f"token {FAKE_GHP} and {FAKE_PAT}; aws AKIA" + "ABCDEFGHIJKLMNOP" + "; Authorization: Bea" + "rer abcdefabcdefabcdef1234"
    kinds = {f.kind for f in secretscan.find(text)}
    assert {"github-token", "github-pat", "aws-key", "auth-header"} <= kinds


def test_private_key_and_password_assignment():
    text = "-----BEGIN OPENSSH " + "PRIVATE KEY-----\nxxx\n" + "pass" + "word=hunter2secret"
    kinds = {f.kind for f in secretscan.find(text)}
    assert {"private-key", "password"} <= kinds


def test_env_variable_references_are_not_secrets():
    text = 'git -c http.extraHeader="Authorization: Basic $(printf x-access-token:%s "$GITHUB_TOKEN")" ; Bearer $GITHUB_TOKEN ; process.env.GITHUB_TOKEN'
    assert secretscan.find(text) == []


def test_redact_replaces_every_finding():
    out = secretscan.redact(f"a {FAKE_GHP} b")
    assert FAKE_GHP not in out and "[REDACTED]" in out
    assert secretscan.find(out) == []


def test_history_folder_has_no_secrets():
    files = [p for p in (REPO / "history").rglob("*") if p.is_file()]
    assert files, "history/ is expected to hold the dialog archive"
    leaks = [(p.relative_to(REPO).as_posix(), f.kind) for p in files
             for f in secretscan.find(p.read_text(encoding="utf-8", errors="replace"))]
    assert leaks == []


def test_tracked_text_files_have_no_secrets():
    import subprocess
    names = subprocess.run(["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True).stdout.split("\n")
    binary = (".png", ".jpg", ".jpeg", ".mp4", ".webp", ".gif", ".ico", ".woff", ".woff2", ".pdf")
    leaks = []
    for name in filter(None, names):
        p = REPO / name
        if name.endswith(binary) or not p.is_file():
            continue
        leaks += [(name, f.kind) for f in secretscan.find(p.read_text(encoding="utf-8", errors="replace"))]
    assert leaks == []
