class ProfileNotFoundError(Exception):
    pass


class JobNotFoundError(Exception):
    pass


class LaTeXCompilationError(Exception):
    def __init__(self, message: str, full_log: str | None = None):
        super().__init__(message)
        self.full_log = full_log


class AIInferenceError(Exception):
    pass


class UsageLimitExceeded(Exception):
    pass


class AuthenticationError(Exception):
    pass


class ForbiddenError(Exception):
    pass


class RoastNotFoundError(Exception):
    pass


class NotFoundError(Exception):
    """Generic 404 for admin routes — use specific errors (JobNotFoundError, etc.) elsewhere."""
    pass


class BadRequestError(Exception):
    """Explicit 400 for validation errors in route handlers."""
    pass


class ConflictError(Exception):
    """409 — e.g. concurrent chat request on the same session."""
    pass
