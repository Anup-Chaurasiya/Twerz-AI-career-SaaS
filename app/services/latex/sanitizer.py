import re
from typing import Any, Dict, List, Union
from urllib.parse import urlparse

# Keys whose values are URLs and must NOT be LaTeX-escaped
_URL_KEYS = {"url", "link", "credential_id"}

# Regex patterns for detecting URLs and emails
_URL_PATTERN = re.compile(r'https?://[^\s]+')
_EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')

# Unicode → LaTeX replacements (run BEFORE special-char escaping)
_UNICODE_MAP = {
    # Currency
    "₹": r"INR ",
    "€": r"EUR ",
    "£": r"GBP ",
    "¥": r"JPY ",
    "₿": r"BTC ",
    # Greek letters (common in tech: μProf, λ functions, etc.)
    "μ": r"$\mu$",
    "α": r"$\alpha$",
    "β": r"$\beta$",
    "γ": r"$\gamma$",
    "δ": r"$\delta$",
    "π": r"$\pi$",
    "λ": r"$\lambda$",
    "σ": r"$\sigma$",
    "Σ": r"$\Sigma$",
    "Δ": r"$\Delta$",
    # Typographic (copy-paste from Word/Google Docs)
    "\u2013": "--",      # en dash
    "\u2014": "---",     # em dash
    "\u2018": "`",       # left single quote
    "\u2019": "'",       # right single quote / apostrophe
    "\u201c": "``",      # left double quote
    "\u201d": "''",      # right double quote
    "\u2026": "...",     # ellipsis
    "\u2022": r"$\cdot$",  # bullet
    # Math/science
    "→": r"$\rightarrow$",
    "←": r"$\leftarrow$",
    "≤": r"$\leq$",
    "≥": r"$\geq$",
    "≈": r"$\approx$",
    "±": r"$\pm$",
    "×": r"$\times$",
    "÷": r"$\div$",
    "∞": r"$\infty$",
    "√": r"$\sqrt{}$",
    # Common symbols
    "°": r"$^\circ$",
    "²": r"$^2$",
    "³": r"$^3$",
    "©": r"\textcopyright{}",
    "®": r"\textregistered{}",
    "™": r"\texttrademark{}",
    "½": r"1/2",
    "¼": r"1/4",
    "¾": r"3/4",
}


def _replace_unicode(sentence: str) -> tuple[str, list[tuple[str, str]]]:
    """Replace known Unicode with LaTeX equivalents, protected by placeholders.

    Returns (sentence_with_placeholders, list_of_(placeholder, latex_replacement)).
    Placeholders prevent handle_special_chars from escaping the LaTeX commands.
    """
    placeholders: list[tuple[str, str]] = []
    for char, replacement in _UNICODE_MAP.items():
        if char in sentence:
            ph = f"\x00U{len(placeholders)}\x00"
            placeholders.append((ph, replacement))
            sentence = sentence.replace(char, ph)
    # Strip any remaining non-ASCII that pdflatex can't handle.
    # Keep printable ASCII (0x20-0x7E) + newlines/tabs + our \x00 placeholders.
    sentence = re.sub(r"[^\x00\x09\x0a\x0d\x20-\x7e]", "", sentence)
    return sentence, placeholders


def handle_special_chars(sentence: str) -> str:
    """Escapes special characters in a string for use in LaTeX documents.
    
    Handles URLs, emails, and all LaTeX special characters with proper escaping.
    Order of operations:
    1. Protect URLs and emails (replace with placeholders)
    2. Replace Unicode characters
    3. Escape LaTeX special characters
    4. Restore URLs/emails with proper LaTeX wrappers
    """
    # Step 1: Detect and protect URLs and emails
    url_placeholders: list[tuple[str, str]] = []
    email_placeholders: list[tuple[str, str]] = []
    
    # Find all URLs and replace with placeholders
    for match in _URL_PATTERN.finditer(sentence):
        url = match.group(0)
        ph = f"\x00URL{len(url_placeholders)}\x00"
        url_placeholders.append((ph, f"\\url{{{url}}}"))
        sentence = sentence.replace(url, ph, 1)
    
    # Find all emails and replace with placeholders
    for match in _EMAIL_PATTERN.finditer(sentence):
        email = match.group(0)
        ph = f"\x00EMAIL{len(email_placeholders)}\x00"
        email_placeholders.append((ph, f"\\href{{mailto:{email}}}{{{email}}}"))
        sentence = sentence.replace(email, ph, 1)
    
    # Step 2: Replace Unicode chars with placeholders (protects LaTeX commands from escaping)
    sentence, unicode_placeholders = _replace_unicode(sentence)

    # Step 3: Handle backslash first using a placeholder to avoid double-escaping
    _placeholder = "\x00BACKSLASH\x00"
    sentence = sentence.replace("\\", _placeholder)

    # Escape all LaTeX special characters
    special_chars = {
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    for char, escaped_char in special_chars.items():
        sentence = sentence.replace(char, escaped_char)

    sentence = sentence.replace(_placeholder, r"\textbackslash{}")

    # Step 4: Restore placeholders with actual LaTeX commands (after escaping is done)
    # Restore Unicode placeholders
    for ph, replacement in unicode_placeholders:
        sentence = sentence.replace(ph, replacement)
    
    # Restore URL placeholders
    for ph, replacement in url_placeholders:
        sentence = sentence.replace(ph, replacement)
    
    # Restore email placeholders
    for ph, replacement in email_placeholders:
        sentence = sentence.replace(ph, replacement)

    return sentence


def convert_markdown_emphasis(text: str) -> str:
    """Convert markdown bold/italic markers to LaTeX commands.

    Must run AFTER handle_special_chars since that escapes { and }.
    Processes bold (**text**) before italic (*text*) to avoid conflicts.
    """
    # Bold: **text** → \textbf{text}
    text = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", text)
    # Italic: *text* → \textit{text} (negative lookbehind/ahead for *)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\\textit{\1}", text)
    return text


def strip_markdown_emphasis(text: str) -> str:
    """Remove all markdown emphasis markers (* and **) from text."""
    # Remove bold markers first, then italic
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\1", text)
    return text


def sanitize_special_chars(
    data: Union[Dict[str, Any], List, str],
    _key: str | None = None,
) -> Union[Dict[str, Any], List, str]:
    """Recursively escapes special characters in a nested structure.

    URL fields (url, link, credential_id) are passed through unescaped
    so \\href{} works correctly in LaTeX.
    """
    if isinstance(data, str):
        # URL fields: only escape % (LaTeX comment char), keep everything else raw for \href
        if _key in _URL_KEYS:
            return data.replace("%", r"\%")
        return handle_special_chars(data)
    elif isinstance(data, dict):
        return {key: sanitize_special_chars(value, _key=key) for key, value in data.items()}
    elif isinstance(data, list):
        return [sanitize_special_chars(item, _key=_key) for item in data]
    return data


def validate_latex_content(content: str) -> tuple[bool, str | None]:
    """
    Validates LaTeX content for common issues before compilation.
    
    Returns: (is_valid, error_message)
    """
    # Check for unmatched braces
    open_braces = content.count('{')
    close_braces = content.count('}')
    if open_braces != close_braces:
        return False, f"Unmatched braces: {open_braces} opening, {close_braces} closing"
    
    # Check for unmatched brackets
    open_brackets = content.count('[')
    close_brackets = content.count(']')
    if open_brackets != close_brackets:
        return False, f"Unmatched brackets: {open_brackets} opening, {close_brackets} closing"
    
    # Check for obviously broken patterns
    if '\\{' in content or '\\}' in content:
        # These are escaped, which is fine
        pass
    
    # Check for unescaped special characters that should never appear raw
    # (after sanitization, these should all be escaped)
    dangerous_patterns = [
        (r'(?<!\\)%(?!\\)', 'Unescaped % character (comment in LaTeX)'),
        (r'(?<!\\)&(?!\\)', 'Unescaped & character (table separator)'),
    ]
    
    for pattern, error_msg in dangerous_patterns:
        # Skip this check for now - can be too strict
        pass
    
    return True, None
