from contextvars import ContextVar

_logger_ctx: ContextVar = ContextVar('logger')

def set_logger(logger):
    _logger_ctx.set(logger)

class LoggerProxy:
    def __getattr__(self, name):
        return getattr(_logger_ctx.get(), name)

logger = LoggerProxy()
