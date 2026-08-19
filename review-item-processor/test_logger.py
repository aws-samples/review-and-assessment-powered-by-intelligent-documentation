#!/usr/bin/env python3
"""
logger のログレベルが DEBUG ハードコードから
環境変数 LOG_LEVEL 制御（既定 INFO）に変わったことを検証するユニットテスト。

文書内容を含みうる logger.debug が本番（既定 INFO）で出力されないことが目的であり、
ここでは「レベル解決ロジック」と「set_logger が解決レベルを適用すること」を担保する。
AWS リソース非依存・ネットワーク非依存。
"""
import logging

import pytest

from logger import _resolve_log_level, set_logger


def test_resolve_log_level_default_is_info(monkeypatch):
    # 未設定なら INFO（debug は出力されない）。
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    assert _resolve_log_level() == logging.INFO


def test_resolve_log_level_debug(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    assert _resolve_log_level() == logging.DEBUG


def test_resolve_log_level_lowercase_debug(monkeypatch):
    # 大文字小文字は無視する。
    monkeypatch.setenv("LOG_LEVEL", "debug")
    assert _resolve_log_level() == logging.DEBUG


def test_resolve_log_level_with_whitespace(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "  warning  ")
    assert _resolve_log_level() == logging.WARNING


def test_resolve_log_level_invalid_falls_back_to_info(monkeypatch):
    # 解釈不能な値は INFO にフォールバック（フェイルセーフ: debug を漏らさない）。
    monkeypatch.setenv("LOG_LEVEL", "NOPE")
    assert _resolve_log_level() == logging.INFO


def test_resolve_log_level_empty_falls_back_to_info(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "")
    assert _resolve_log_level() == logging.INFO


def test_set_logger_applies_resolved_level_default(monkeypatch):
    # 既定（LOG_LEVEL 未設定）では差し替え logger に INFO が適用される。
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    custom = logging.getLogger("test_set_logger_default")
    custom.setLevel(logging.DEBUG)  # わざと DEBUG にしておく
    set_logger(custom)
    assert custom.level == logging.INFO


def test_set_logger_applies_resolved_level_debug(monkeypatch):
    # LOG_LEVEL=DEBUG なら差し替え logger に DEBUG が適用される。
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    custom = logging.getLogger("test_set_logger_debug")
    custom.setLevel(logging.WARNING)
    set_logger(custom)
    assert custom.level == logging.DEBUG


if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
