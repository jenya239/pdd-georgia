"""Pure detector of credential-like strings (tokens, keys, passwords) in text.

Used by tests/py/test_secretscan.py to keep history/ (the dialog archive) and similar text free of secrets,
and by tools/dialog_export.py to redact them. References to environment variables ($GITHUB_TOKEN) are not secrets.
"""
import re
from dataclasses import dataclass

PATTERNS = [
    ("github-token", r"\bgh[pousr]_[A-Za-z0-9]{30,}"),
    ("github-pat", r"\bgithub_pat_[A-Za-z0-9_]{20,}"),
    ("aws-key", r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    ("google-key", r"\bAIza[0-9A-Za-z_\-]{35}"),
    ("slack-token", r"\bxox[abposr]-[A-Za-z0-9-]{10,}"),
    ("openai-key", r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}"),
    ("private-key", r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    ("auth-header", r"(?i)\b(?:Bearer|Basic|token)\s+(?![$<\[{])[A-Za-z0-9+/_\-=.]{20,}"),
    ("password", r"(?i)\b(?:password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*(?![$<\[{\s])[^\s'\"`]{6,}"),
]
_COMPILED = [(kind, re.compile(rx)) for kind, rx in PATTERNS]


@dataclass(frozen=True)
class Finding:
    kind: str
    start: int
    end: int


def find(text: str) -> list:
    out = [Finding(kind, m.start(), m.end()) for kind, rx in _COMPILED for m in rx.finditer(text)]
    return sorted(out, key=lambda f: f.start)


def redact(text: str, mark: str = "[REDACTED]") -> str:
    for f in sorted(find(text), key=lambda f: -f.start):
        text = text[:f.start] + mark + text[f.end:]
    return text if not find(text) else redact(text, mark)
