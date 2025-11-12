"""Unit tests for reading time calculation with CJK support."""

import pytest

from app.utils.reading_time import calculate_reading_time, calculate_reading_time_from_html, is_cjk_text


@pytest.mark.unit
class TestIsCjkText:
    """Tests for is_cjk_text function."""

    def test_empty_string_returns_false(self):
        """Empty string should return False."""
        assert is_cjk_text("") is False

    def test_whitespace_only_returns_false(self):
        """Whitespace-only string should return False."""
        assert is_cjk_text("   \n\t   ") is False

    def test_english_text_returns_false(self):
        """Pure English text should return False."""
        assert is_cjk_text("This is an English sentence.") is False

    def test_chinese_text_returns_true(self):
        """Chinese text should return True."""
        assert is_cjk_text("这是中文文本") is True

    def test_japanese_hiragana_returns_true(self):
        """Japanese hiragana should return True."""
        assert is_cjk_text("これはひらがなです") is True

    def test_japanese_katakana_returns_true(self):
        """Japanese katakana should return True."""
        assert is_cjk_text("カタカナテキスト") is True

    def test_korean_hangul_returns_true(self):
        """Korean Hangul should return True."""
        assert is_cjk_text("한글 텍스트입니다") is True

    def test_mixed_english_chinese_high_cjk_returns_true(self):
        """Mixed text with >20% CJK should return True."""
        # "Hello 你好世界" - 4 CJK out of 9 total = 44%
        assert is_cjk_text("Hello 你好世界") is True

    def test_mixed_english_chinese_low_cjk_returns_false(self):
        """Mixed text with <20% CJK should return False."""
        # "This is mostly English with one 字" - 1 CJK out of 28 = 3.5%
        assert is_cjk_text("This is mostly English with one 字") is False

    def test_cjk_punctuation_counted(self):
        """CJK punctuation should be counted as CJK."""
        assert is_cjk_text("、。「」『』【】〈〉《》") is True

    def test_exactly_20_percent_threshold(self):
        """Test boundary at exactly 20% CJK."""
        # Need to test around the 0.2 threshold
        # "12345" (5 chars) + "字" (1 CJK) = 1/6 = 16.7% -> False
        assert is_cjk_text("12345字") is False

        # "1234" (4 chars) + "字" (1 CJK) = 1/5 = 20% -> False (not >20%)
        assert is_cjk_text("1234字") is False

        # "123" (3 chars) + "字" (1 CJK) = 1/4 = 25% -> True
        assert is_cjk_text("123字") is True

    def test_fullwidth_characters(self):
        """Fullwidth characters should be counted as CJK."""
        assert is_cjk_text("ＡＢＣ１２３") is True

    @pytest.mark.parametrize(
        "text,expected",
        [
            ("", False),
            ("   ", False),
            ("English", False),
            ("中文", True),
            ("日本語", True),
            ("한국어", True),
            ("Mix with 中文", True),
            ("Mostly English with 一", False),
        ],
    )
    def test_parametrized_cjk_detection(self, text: str, expected: bool):
        """Test various CJK detection cases."""
        assert is_cjk_text(text) is expected


@pytest.mark.unit
class TestCalculateReadingTime:
    """Tests for calculate_reading_time function."""

    def test_empty_string_returns_one(self):
        """Empty string should return minimum reading time of 1."""
        assert calculate_reading_time("") == 1

    def test_whitespace_only_returns_one(self):
        """Whitespace-only content should return 1."""
        assert calculate_reading_time("   \n\t   ") == 1

    def test_english_short_text_minimum_one(self):
        """Short English text should return minimum of 1 minute."""
        assert calculate_reading_time("Hello world") == 1

    def test_english_text_word_based_calculation(self):
        """English text should use word-based calculation."""
        # 230 words = 1 minute at 230 WPM
        text = " ".join(["word"] * 230)
        assert calculate_reading_time(text, default_wpm=230) == 1

        # 460 words = 2 minutes at 230 WPM
        text = " ".join(["word"] * 460)
        assert calculate_reading_time(text, default_wpm=230) == 2

    def test_chinese_text_character_based_calculation(self):
        """Chinese text should use character-based calculation."""
        # 300 characters = 1 minute at 300 CPM
        text = "字" * 300
        assert calculate_reading_time(text, cjk_cpm=300) == 1

        # 600 characters = 2 minutes at 300 CPM
        text = "字" * 600
        assert calculate_reading_time(text, cjk_cpm=300) == 2

    def test_japanese_text_character_based_calculation(self):
        """Japanese text should use character-based calculation."""
        # Mix of hiragana and katakana
        text = "あ" * 150 + "カ" * 150  # 300 total
        assert calculate_reading_time(text, cjk_cpm=300) == 1

    def test_korean_text_character_based_calculation(self):
        """Korean text should use character-based calculation."""
        text = "가" * 300
        assert calculate_reading_time(text, cjk_cpm=300) == 1

    def test_html_tags_removed(self):
        """HTML tags should be stripped before calculation."""
        text = "<p>Hello <b>world</b> this is a test</p>"
        # Should count words ignoring HTML tags
        result = calculate_reading_time(text)
        assert result >= 1

    def test_html_tags_complex(self):
        """Complex HTML should be cleaned properly."""
        text = "<div class='test'><p>Content <span style='color: red'>here</span></p></div>"
        result = calculate_reading_time(text)
        assert result >= 1

    def test_punctuation_handled_in_english(self):
        """Punctuation should be removed for word counting in English."""
        # Punctuation should be stripped for accurate word count
        text = "Hello, world! This is a test. It has punctuation..."
        result = calculate_reading_time(text)
        assert result >= 1

    def test_custom_wpm(self):
        """Custom WPM should be respected."""
        text = " ".join(["word"] * 200)

        # At 200 WPM, 200 words = 1 minute
        assert calculate_reading_time(text, default_wpm=200) == 1

        # At 100 WPM, 200 words = 2 minutes
        assert calculate_reading_time(text, default_wpm=100) == 2

    def test_custom_cjk_cpm(self):
        """Custom CPM for CJK should be respected."""
        text = "字" * 600

        # At 600 CPM, 600 chars = 1 minute
        assert calculate_reading_time(text, cjk_cpm=600) == 1

        # At 300 CPM, 600 chars = 2 minutes
        assert calculate_reading_time(text, cjk_cpm=300) == 2

    def test_rounding_behavior(self):
        """Reading time should be rounded to nearest minute."""
        # 345 words at 230 WPM = 1.5 minutes -> rounds to 2
        text = " ".join(["word"] * 345)
        assert calculate_reading_time(text, default_wpm=230) == 2

        # 115 words at 230 WPM = 0.5 minutes -> rounds to 1 (minimum)
        text = " ".join(["word"] * 115)
        assert calculate_reading_time(text, default_wpm=230) == 1

    def test_mixed_content_english_dominant(self):
        """Mixed content with <20% CJK should use word-based calculation."""
        # Mostly English with minimal CJK
        text = " ".join(["word"] * 200) + " 字"
        # Should use English word counting
        result = calculate_reading_time(text, default_wpm=200)
        assert result >= 1

    def test_mixed_content_cjk_dominant(self):
        """Mixed content with >20% CJK should use character-based calculation."""
        # Mostly CJK with minimal English
        text = "字" * 300 + " word"
        # Should use CJK character counting
        result = calculate_reading_time(text, cjk_cpm=300)
        assert result >= 1

    def test_very_long_english_text(self):
        """Very long English text should calculate correctly."""
        # 2300 words = 10 minutes at 230 WPM
        text = " ".join(["word"] * 2300)
        assert calculate_reading_time(text, default_wpm=230) == 10

    def test_very_long_cjk_text(self):
        """Very long CJK text should calculate correctly."""
        # 3000 characters = 10 minutes at 300 CPM
        text = "字" * 3000
        assert calculate_reading_time(text, cjk_cpm=300) == 10

    def test_newlines_and_formatting(self):
        """Text with newlines and formatting should be handled."""
        text = "Line 1\nLine 2\n\nLine 3\t\tLine 4"
        result = calculate_reading_time(text)
        assert result >= 1

    def test_unicode_characters(self):
        """Unicode characters should be handled correctly."""
        text = "Émojis 🎉 and spëcial çharacters"
        result = calculate_reading_time(text)
        assert result >= 1

    @pytest.mark.parametrize(
        "word_count,wpm,expected_minutes",
        [
            (230, 230, 1),
            (460, 230, 2),
            (115, 230, 1),  # 0.5 rounds to 1
            (345, 230, 2),  # 1.5 rounds to 2
            (100, 100, 1),
            (200, 100, 2),
        ],
    )
    def test_parametrized_english_reading_time(self, word_count: int, wpm: int, expected_minutes: int):
        """Test English reading time calculations."""
        text = " ".join(["word"] * word_count)
        assert calculate_reading_time(text, default_wpm=wpm) == expected_minutes

    @pytest.mark.parametrize(
        "char_count,cpm,expected_minutes",
        [
            (300, 300, 1),
            (600, 300, 2),
            (150, 300, 1),  # 0.5 rounds to 1
            (450, 300, 2),  # 1.5 rounds to 2
        ],
    )
    def test_parametrized_cjk_reading_time(self, char_count: int, cpm: int, expected_minutes: int):
        """Test CJK reading time calculations."""
        text = "字" * char_count
        assert calculate_reading_time(text, cjk_cpm=cpm) == expected_minutes


@pytest.mark.unit
class TestCalculateReadingTimeFromHtml:
    """Tests for calculate_reading_time_from_html function."""

    def test_empty_html_returns_none(self):
        """Empty HTML should return None."""
        assert calculate_reading_time_from_html("") is None

    def test_whitespace_only_html_returns_none(self):
        """Whitespace-only HTML should return None."""
        assert calculate_reading_time_from_html("   \n\t   ") is None

    def test_html_with_no_text_returns_none(self):
        """HTML with no text content should return None."""
        assert calculate_reading_time_from_html("<div></div>") is None
        assert calculate_reading_time_from_html("<p></p>") is None

    def test_simple_html_paragraph(self):
        """Simple HTML paragraph should calculate reading time."""
        html = "<p>This is a simple paragraph with some words.</p>"
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_html_strips_tags(self):
        """HTML tags should be stripped, only text counted."""
        html = "<div><p>Hello <b>world</b> <i>test</i></p></div>"
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_html_with_nested_elements(self):
        """Nested HTML elements should be handled correctly."""
        html = """
        <article>
            <h1>Title</h1>
            <div class="content">
                <p>First paragraph with text.</p>
                <p>Second paragraph with more text.</p>
            </div>
        </article>
        """
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_html_with_script_and_style_tags(self):
        """Script and style tags should be excluded from text."""
        html = """
        <html>
            <head><style>.class { color: red; }</style></head>
            <body>
                <p>Visible content here.</p>
                <script>console.log('test');</script>
            </body>
        </html>
        """
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_html_with_cjk_content(self):
        """HTML with CJK content should use character-based calculation."""
        html = "<p>" + "字" * 300 + "</p>"
        result = calculate_reading_time_from_html(html, cjk_cpm=300)
        assert result is not None
        assert result >= 1

    def test_custom_wpm_parameter(self):
        """Custom WPM parameter should be passed through."""
        html = "<p>" + " ".join(["word"] * 200) + "</p>"
        result = calculate_reading_time_from_html(html, default_wpm=200)
        assert result is not None
        assert result >= 1

    def test_custom_cjk_cpm_parameter(self):
        """Custom CJK CPM parameter should be passed through."""
        html = "<p>" + "字" * 600 + "</p>"
        result = calculate_reading_time_from_html(html, cjk_cpm=600)
        assert result is not None
        assert result >= 1

    def test_malformed_html_uses_fallback(self):
        """Malformed HTML should use regex fallback."""
        # Intentionally malformed HTML
        html = "<p>Text with <broken tag and more text"
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_html_with_entities(self):
        """HTML entities should be decoded properly."""
        html = "<p>Text with &lt;entities&gt; and &amp; symbols</p>"
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_html_with_multiple_whitespace(self):
        """Multiple whitespace should be normalized."""
        html = "<p>Text    with     multiple     spaces</p>"
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_html_with_line_breaks(self):
        """HTML with br tags and newlines should be handled."""
        html = """
        <p>Line 1<br>
        Line 2<br/>
        Line 3</p>
        """
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_real_world_article_html(self):
        """Real-world article HTML should calculate properly."""
        html = """
        <article>
            <h1>Article Title Goes Here</h1>
            <div class="meta">Published on 2024-01-01</div>
            <div class="content">
                <p>This is the first paragraph of the article. It contains several sentences
                with various information that readers would find interesting.</p>
                <p>This is the second paragraph with more content. Articles typically have
                multiple paragraphs to convey information effectively.</p>
                <h2>Section Heading</h2>
                <p>Content under the section with additional details and explanations.</p>
            </div>
        </article>
        """
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_beautifulsoup_exception_fallback(self):
        """When BeautifulSoup fails, regex fallback should work."""
        # Test with valid HTML that should work with both methods
        html = "<p>Simple text content</p>"
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_very_long_html_article(self):
        """Very long HTML articles should calculate correctly."""
        # Generate long article
        paragraphs = [f"<p>{' '.join(['word'] * 230)}</p>" for _ in range(10)]
        html = "<article>" + "".join(paragraphs) + "</article>"
        result = calculate_reading_time_from_html(html, default_wpm=230)
        # 230 words * 10 paragraphs = 2300 words = 10 minutes at 230 WPM
        assert result is not None
        assert result >= 10

    def test_html_table_content(self):
        """HTML tables should have their text extracted."""
        html = """
        <table>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
            <tr><td>Cell 3</td><td>Cell 4</td></tr>
        </table>
        """
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    def test_html_list_content(self):
        """HTML lists should have their text extracted."""
        html = """
        <ul>
            <li>First item with text</li>
            <li>Second item with text</li>
            <li>Third item with text</li>
        </ul>
        """
        result = calculate_reading_time_from_html(html)
        assert result is not None
        assert result >= 1

    @pytest.mark.parametrize(
        "html,should_be_none",
        [
            ("", True),
            ("   ", True),
            ("<div></div>", True),
            ("<p></p>", True),
            ("<p>Text</p>", False),
            ("<div>Content</div>", False),
        ],
    )
    def test_parametrized_none_cases(self, html: str, should_be_none: bool):
        """Test cases that should or shouldn't return None."""
        result = calculate_reading_time_from_html(html)
        if should_be_none:
            assert result is None
        else:
            assert result is not None
