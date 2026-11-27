from app.tts.text import clean_markdown, plan_script, split_clauses, split_sentences


def test_clean_markdown_strips_headings_quotes_lists_and_emphasis() -> None:
    text = "# Tiêu đề\n> Trích **dẫn**\n- Mục _một_\n1. Mục `hai`"
    assert clean_markdown(text) == "Tiêu đề\nTrích dẫn\nMục một\nMục hai"


def test_split_sentences_on_terminal_punctuation_and_newlines() -> None:
    paragraph = "Trời mưa. Em có nghe không? Nghe chứ!\n“Ừ… vậy thì tốt.” Thôi ngủ đi…"
    assert split_sentences(paragraph) == [
        "Trời mưa.",
        "Em có nghe không?",
        "Nghe chứ!",
        "“Ừ… vậy thì tốt.”",
        "Thôi ngủ đi…",
    ]


def test_split_sentences_keeps_numbers_with_dots() -> None:
    assert split_sentences("Có 3.000 người nghe. Tuyệt vời.") == [
        "Có 3.000 người nghe.",
        "Tuyệt vời.",
    ]


def test_split_clauses_merges_short_clauses() -> None:
    assert split_clauses("Ừ, có những ngày mình chỉ muốn ngồi yên.") == [
        "Ừ, có những ngày mình chỉ muốn ngồi yên."
    ]
    assert split_clauses("Những giọt mưa gõ nhịp trên mái, đều đặn, chậm rãi.") == [
        "Những giọt mưa gõ nhịp trên mái,",
        "đều đặn, chậm rãi.",
    ]


def test_plan_script_assigns_pauses() -> None:
    script = "Đoạn một có câu đầu tiên, và vế thứ hai. Câu thứ hai.\n\nĐoạn hai."
    paragraphs = plan_script(
        script, comma_pause_ms=250, sentence_pause_ms=600, paragraph_pause_ms=1000
    )

    assert [p.text for p in paragraphs] == [
        "Đoạn một có câu đầu tiên, và vế thứ hai. Câu thứ hai.",
        "Đoạn hai.",
    ]
    assert [(s.text, s.pause_after_ms) for s in paragraphs[0].segments] == [
        ("Đoạn một có câu đầu tiên,", 250),
        ("và vế thứ hai.", 600),
        ("Câu thứ hai.", 1000),
    ]
    assert [(s.text, s.pause_after_ms) for s in paragraphs[1].segments] == [("Đoạn hai.", 1000)]


def test_plan_script_without_comma_split() -> None:
    paragraphs = plan_script("Câu có dấu phẩy ở giữa, rồi kết thúc.", split_commas=False)
    assert [s.text for s in paragraphs[0].segments] == ["Câu có dấu phẩy ở giữa, rồi kết thúc."]


def test_plan_script_ignores_blank_input() -> None:
    assert plan_script("  \n\n  \n") == []
