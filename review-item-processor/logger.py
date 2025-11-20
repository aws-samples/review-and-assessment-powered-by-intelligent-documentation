import logging

# Global logger instance
_logger = logging.getLogger(__name__)

def set_logger(logger):
    global _logger
    _logger = logger

class LoggerProxy:
    def __getattr__(self, name):
        return getattr(_logger, name)

logger = LoggerProxy()
