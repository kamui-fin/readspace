#!/usr/bin/env python3
"""Simple test script to verify CJK reading time calculation."""

import sys
sys.path.append('server')

from app.utils.reading_time import calculate_reading_time, is_cjk_text

# Test cases
english_text = "This is a simple English text with multiple words to test the reading time calculation."
japanese_text = "これは日本語のテキストです。読み時間の計算をテストしています。ひらがなとカタカナと漢字が含まれています。"
chinese_text = "这是一个中文文本示例。我们正在测试阅读时间的计算功能。中文不使用空格分隔词语。"
korean_text = "이것은 한국어 텍스트 예시입니다. 읽기 시간 계산 기능을 테스트하고 있습니다."
mixed_text = "This is mixed text with some 中文 and 日本語 content mixed together."

print("Testing CJK detection:")
print(f"English: {is_cjk_text(english_text)} (should be False)")
print(f"Japanese: {is_cjk_text(japanese_text)} (should be True)")
print(f"Chinese: {is_cjk_text(chinese_text)} (should be True)")  
print(f"Korean: {is_cjk_text(korean_text)} (should be True)")
print(f"Mixed: {is_cjk_text(mixed_text)} (should be True)")

print("\nTesting reading time calculation:")
print(f"English ({len(english_text.split())} words): {calculate_reading_time(english_text)} minutes")
print(f"Japanese ({len(japanese_text.replace(' ', ''))} chars): {calculate_reading_time(japanese_text)} minutes")
print(f"Chinese ({len(chinese_text.replace(' ', ''))} chars): {calculate_reading_time(chinese_text)} minutes")
print(f"Korean ({len(korean_text.replace(' ', ''))} chars): {calculate_reading_time(korean_text)} minutes") 
print(f"Mixed ({len(mixed_text.split())} words/{len(mixed_text.replace(' ', ''))} chars): {calculate_reading_time(mixed_text)} minutes")