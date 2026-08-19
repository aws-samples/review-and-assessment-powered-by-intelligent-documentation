import logging
import os

# ログレベルをハードコードの DEBUG 固定から環境変数 (LOG_LEVEL) 制御に変更する。
# 既定は INFO なので、文書内容を含みうる logger.debug は本番で出力されない
# （文書内容漏洩の防止）。詳細調査時のみ LOG_LEVEL=DEBUG を設定して
# 一時的に debug 出力を有効化する運用を想定する。
_DEFAULT_LOG_LEVEL = "INFO"


def _resolve_log_level() -> int:
    """環境変数 LOG_LEVEL からログレベル（int）を解決する。

    未設定・不正値（解釈不能なレベル名）の場合は INFO にフォールバックする。
    大文字小文字は無視する（例: "debug" / "DEBUG" のいずれも許容）。
    """
    name = os.environ.get("LOG_LEVEL", _DEFAULT_LOG_LEVEL).strip().upper()
    level = logging.getLevelName(name)
    # logging.getLevelName は既知レベル名なら int、未知名なら "Level <name>" の文字列を返す。
    if isinstance(level, int):
        return level
    return logging.INFO


# Global logger instance
_logger = logging.getLogger(__name__)
_logger.setLevel(_resolve_log_level())


def set_logger(logger):
    global _logger
    _logger = logger
    # 差し替えられた logger にも DEBUG 固定ではなく
    # 解決済みレベル（既定 INFO）を適用する。
    _logger.setLevel(_resolve_log_level())


class LoggerProxy:
    def __getattr__(self, name):
        return getattr(_logger, name)


logger = LoggerProxy()
