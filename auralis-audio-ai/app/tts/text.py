"""Tách kịch bản tiếng Việt thành đoạn văn và các cụm đọc có khoảng lặng tự nhiên."""

import re
from dataclasses import dataclass

_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")
# Kết thúc câu: . ! ? … (có thể lặp) kèm ngoặc/nháy đóng, theo sau là khoảng trắng
_SENTENCE_SPLIT = re.compile(r"(?:(?<=[.!?…])|(?<=[.!?…][\"'”’)\]]))\s+")
# Ngắt cụm: dấu phẩy, chấm phẩy, hai chấm theo sau là khoảng trắng
_CLAUSE_SPLIT = re.compile(r"(?<=[,;:])\s+")
_MARKDOWN_LINE_PREFIX = re.compile(r"^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)")
_MARKDOWN_EMPHASIS = re.compile(r"(\*\*|__|\*|_|`)")
_MIN_CLAUSE_WORDS = 3


@dataclass(frozen=True)
class Segment:
    text: str
    pause_after_ms: int


@dataclass(frozen=True)
class Paragraph:
    index: int
    text: str
    segments: list[Segment]


def clean_markdown(text: str) -> str:
    lines = [_MARKDOWN_LINE_PREFIX.sub("", line) for line in text.splitlines()]
    return _MARKDOWN_EMPHASIS.sub("", "\n".join(lines))


def split_paragraphs(script: str) -> list[str]:
    cleaned = clean_markdown(script.replace("\r\n", "\n"))
    return [p.strip() for p in _PARAGRAPH_SPLIT.split(cleaned) if p.strip()]


def split_sentences(paragraph: str) -> list[str]:
    sentences: list[str] = []
    # Xuống dòng đơn trong một đoạn cũng là ranh giới câu
    for line in paragraph.split("\n"):
        line_sentences: list[str] = []
        for piece in (p.strip() for p in _SENTENCE_SPLIT.split(line.strip())):
            if not piece:
                continue
            # "Ừ… vậy thì tốt": sau dấu câu mà chữ tiếp theo viết thường thì vẫn là cùng một câu
            if line_sentences and piece[0].islower():
                line_sentences[-1] = f"{line_sentences[-1]} {piece}"
            else:
                line_sentences.append(piece)
        sentences.extend(line_sentences)
    return sentences


def split_clauses(sentence: str) -> list[str]:
    """Tách theo dấu phẩy, gộp cụm quá ngắn (VD: "Ừ,") vào cụm sau để giữ ngữ điệu."""
    clauses: list[str] = []
    carry = ""
    for part in _CLAUSE_SPLIT.split(sentence):
        part = f"{carry} {part}".strip() if carry else part.strip()
        if len(part.split()) < _MIN_CLAUSE_WORDS:
            carry = part
            continue
        clauses.append(part)
        carry = ""
    if carry:
        if clauses:
            clauses[-1] = f"{clauses[-1]} {carry}"
        else:
            clauses.append(carry)
    return clauses


def plan_script(
    script: str,
    *,
    split_commas: bool = True,
    comma_pause_ms: int = 250,
    sentence_pause_ms: int = 600,
    paragraph_pause_ms: int = 1000,
) -> list[Paragraph]:
    paragraphs: list[Paragraph] = []
    for index, text in enumerate(split_paragraphs(script)):
        segments: list[Segment] = []
        for sentence in split_sentences(text):
            clauses = split_clauses(sentence) if split_commas else [sentence]
            for i, clause in enumerate(clauses):
                is_last_clause = i == len(clauses) - 1
                segments.append(
                    Segment(clause, sentence_pause_ms if is_last_clause else comma_pause_ms)
                )
        if segments:
            last = segments[-1]
            segments[-1] = Segment(last.text, paragraph_pause_ms)
            paragraphs.append(Paragraph(index=index, text=text, segments=segments))
    return paragraphs
