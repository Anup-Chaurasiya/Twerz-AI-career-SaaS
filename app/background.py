import asyncio
import logging

logger = logging.getLogger(__name__)

active_tasks: set[asyncio.Task] = set()


def create_tracked_task(coro) -> asyncio.Task:
    """Schedule a coroutine as a tracked asyncio Task.

    Tracked tasks are awaited during graceful shutdown so in-flight background work
    (AI generation / PDF compilation / uploads) can finish before the process exits.
    """

    async def _safe_wrapper():
        try:
            await coro
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Unhandled exception in background task")

    task = asyncio.create_task(_safe_wrapper())
    active_tasks.add(task)
    task.add_done_callback(active_tasks.discard)
    return task


__all__ = ["active_tasks", "create_tracked_task"]

