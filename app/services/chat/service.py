import json
import time
from logging import getLogger
from typing import Any, AsyncGenerator

import jsonpatch
from pydantic import ValidationError
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService
from google.adk.tools import ToolContext
from google.genai import types

from app.config import get_settings
from app.schemas.custom_resume import CustomResumeInfo
from app.services.ai.inference import _log_request
from app.services.chat.gemini_retry import run_agent_with_retry

logger = getLogger(__name__)

APP_NAME = "ats-beater-chat"

# ── Agent tools (module-level functions) ────────────────────────────────


def get_resume(tool_context: ToolContext) -> dict:
    """Read the current tailored resume. Call this to see the resume before making changes."""
    return tool_context.state.get("resume", {})


def edit_resume(operations: list[dict], tool_context: ToolContext) -> dict:
    """Apply changes to the resume using JSON Patch (RFC 6902).

    Args:
        operations: List of patch ops. Each has: op ("replace"/"add"/"remove"),
                    path (JSON pointer like "/past_experience/0/description/0"),
                    value (new value, not needed for "remove").
    """
    current = tool_context.state.get("resume", {})
    try:
        patch = jsonpatch.JsonPatch(operations)
        updated = patch.apply(current)
        validated = CustomResumeInfo.model_validate(updated)
        tool_context.state["resume"] = validated.model_dump()
        return {"status": "success", "changes_applied": len(operations)}
    except (jsonpatch.JsonPatchException, ValidationError) as e:
        return {"status": "error", "message": str(e)}


def set_template(
    template_id: str,
    tool_context: ToolContext,
    confirm_ats_tradeoff: bool = False,
) -> dict:
    """Switch resume layout template. Free — no credits.

    Valid template_id values: classic, modern_two_col, compact_one_page.
    For modern_two_col, set confirm_ats_tradeoff=true after explaining the ATS tradeoff.
    """
    from app.services.latex.templates import get_template_spec

    try:
        spec = get_template_spec(template_id)
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}

    if spec.ats_tier == "tradeoff" and not confirm_ats_tradeoff:
        return {
            "status": "needs_ack",
            "template_id": template_id,
            "message": (
                f"{spec.label} may score lower on blind ATS scans. "
                "Ask the user to confirm they understand the tradeoff, then call again with "
                "confirm_ats_tradeoff=true."
            ),
            "ats_warning": spec.ats_warning,
        }

    tool_context.state["pending_template_id"] = template_id
    return {
        "status": "success",
        "template_id": template_id,
        "message": f"Template switch to {spec.label} queued — PDF will recompile.",
    }


# ── System prompt template ──────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """You are a resume editing assistant. The user has a tailored resume for a specific job.
Help them refine it through conversation.

## How This Works
You edit **structured JSON data** (CustomResumeInfo), not the PDF directly. After each edit, the system
automatically compiles the updated data into a PDF using the user's selected LaTeX template. You can also
switch templates with set_template — free, no credits.

## Available templates
- **classic** — Classic ATS: single-column, maximum ATS parseability (default).
- **compact_one_page** — Compact One-Page: dense layout that fits more on one sheet.
- **modern_two_col** — Modern Two-Column: sidebar layout; may score lower on blind ATS scans. Requires
  confirm_ats_tradeoff=true after user acknowledges the tradeoff.

Template switching and PDF recompilation are free and do not cost credits.

## PDF Layout (selected template)
The compiled PDF uses one of the house templates above. Sections appear in a fixed order per template
(empty sections are automatically omitted):

1. **Header**: Name centered, then contact info (phone, email, DOB) and links (as clickable hyperlinks)
2. **Experience**: Each entry has company name, date range, role title, then bullet points
3. **Projects**: Each entry has project name (hyperlinked if URL provided), then bullet points
4. **Skills**: Table with categories — Languages, Frameworks, Databases, Platforms/Other Technologies
5. **Education**: Institution, grade, degree, date range
6. **Achievements**: Simple bullet list
7. **Certifications**: Bullet list, credential_id rendered as "Verify" hyperlink if it's a URL, otherwise "ID: ..."
8. **Patents**: Bullet list with optional date and description
9. **Publications**: Bullet list with optional date and description

**Formatting**: Use **bold** (double asterisks) in bullet text for key metrics and technologies — it converts
to bold in the PDF. No other markdown is supported.

## Your Tools
- get_resume: Read the current tailored resume. Call this first if you need to see the current state.
- edit_resume: Apply changes using JSON Patch (RFC 6902) operations.
  Supported ops: "replace", "add", "remove"
  Example: [{{"op": "replace", "path": "/past_experience/0/description/0", "value": "New bullet text"}}]
- set_template: Switch layout template (classic, compact_one_page, modern_two_col). Free recompile.
  For modern_two_col, explain the ATS tradeoff first, get user confirmation, then call with
  confirm_ats_tradeoff=true.

## Resume Structure (CustomResumeInfo)
- /name, /email, /mobile_number, /date_of_birth — personal info
- /links/N — {{name, url}}
- /past_experience/N — {{company_name, role, start_date, end_date, description: [bullet strings]}}
- /projects/N — {{name, link, description: [bullet strings]}}
- /skills — {{languages: [], frameworks: [], databases: [], other_technologies: []}}
- /educations/N — {{degree, institution, start_date, end_date, grade}}
- /achievements — [strings]
- /certifications/N — {{name, credential_id}}
- /patents/N — {{name, date, description}}
- /papers/N — {{name, date, description}}

Array operations: use index (e.g. /past_experience/0) or "/-" to append.

## Downloading the PDF
The user is on the Job page where their tailored resume has already been generated. Once the status is READY,
they click the **"DOWNLOAD PDF"** button at the top of this page to get their PDF.
If the user asks "how do I download?" or "give me the PDF" — point them to this button. Do NOT render the
resume as markdown/text in chat. Do NOT fabricate buttons or UI elements that don't exist.

## Rules
- Always call get_resume before your first edit to see the current state.
- Make ONLY the changes the user asks for. Don't "improve" other sections unprompted.
- Use **bold** for key metrics and technologies in bullet points.
- After editing, briefly explain what you changed in plain language.
- If the request is ambiguous, ask for clarification before editing.
- If an edit fails, explain the error and suggest alternatives.
- **Keep responses concise** unless the user explicitly asks for a detailed explanation or analysis. Get to the point.
- If the user asks to change the format, layout, fonts, or template: use set_template (free). For modern_two_col,
  explain the ATS tradeoff and require explicit confirmation before confirm_ats_tradeoff=true.
- If the user asks to rearrange or reorder sections: explain that the section order (Experience → Projects →
  Skills → Education → Achievements → Certifications) is already optimized for maximum ATS compatibility.
  Most ATS parsers expect Experience and Skills near the top. This ordering is based on how recruiters and
  ATS systems scan resumes — putting the highest-signal sections first. Reassure the user that this is the
  industry-standard ordering used by top resume tools, and that changing it could actually hurt their chances.
- If the user pastes a new job description and asks you to regenerate or re-tailor the entire resume: decline.
  Explain that full re-tailoring must be done by creating a new job from the dashboard. You can only make
  targeted edits to the existing tailored resume.

## ATS Readiness & Resume Scoring (CRITICAL — users ask about this constantly)
If the user asks about their "ATS score", "resume score", "resume rating", asks you to "rate" their resume,
or asks anything about ATS compatibility — you MUST follow these rules:

**NEVER output a numerical score, rating, or percentage.** No "8.5/10", no "88/100", no "ATS score: 75%".
These numbers are completely fabricated and meaningless. Any tool or website claiming to give an "ATS score
out of 100" or a "resume rating" is making it up — there is no such metric.

**ATS systems are parsers and keyword matchers, not scorers.** They extract structured data from resumes and
match keywords against job descriptions. They do NOT assign scores.

Instead, evaluate their resume against this **ATS readiness checklist** (explain each item, then assess):
1. **Machine-readable format** — Already handled. LaTeX compiles to a clean, single-column PDF. Always passes.
2. **Standard section headers** — Already handled. Our template uses recognized headings. Always passes.
3. **Contact information** — Email and phone present for candidate profile creation.
4. **Profile links** — LinkedIn, GitHub, portfolio for recruiter verification.
5. **Skills & keywords** — ATS matches JD keywords against skills. Since this resume is already tailored to the
   job description, keyword coverage should be strong. Call get_resume to verify.
6. **Experience with dates** — ATS calculates tenure. Missing dates can trigger auto-rejection.
7. **Quantified achievements** — Numbers and metrics in descriptions improve both ATS ranking and human review.
8. **Action-oriented language** — Strong verbs (Built, Led, Reduced) signal ownership.

**Workflow**: First call get_resume to check the actual data. Then explain why ATS scores aren't real, and
walk through the checklist telling the user specifically which criteria are met and which need improvement
based on what you found in their tailored resume. Frame it as: "Passes / Needs attention."
NEVER give a number. If the user insists on a score, firmly explain why scores don't exist.

## Job Description
{job_description_json}

## Original Profile
{profile_info_json}
"""


# ── ChatService ─────────────────────────────────────────────────────────


class ChatService:
    def __init__(self):
        settings = get_settings()
        self.session_service = DatabaseSessionService(
            db_url=settings.DATABASE_URL
        )
        self.flash_model = settings.GEMINI_FLASH_MODEL

    def _build_system_prompt(self, job_description: dict, profile_info: dict) -> str:
        return CHAT_SYSTEM_PROMPT.format(
            job_description_json=json.dumps(job_description, indent=2),
            profile_info_json=json.dumps(profile_info, indent=2),
        )

    def _build_agent(
        self,
        job_description: dict,
        profile_info: dict,
        user_id: str,
        job_id: int,
    ) -> Agent:
        system_prompt = self._build_system_prompt(job_description, profile_info)
        model_name = self.flash_model
        _job_id = job_id
        _user_id = user_id

        async def _after_model_callback(callback_context, llm_response):
            """Log LLM call metrics to llm_requests table."""
            usage = llm_response.usage_metadata
            await _log_request(
                model_name=model_name,
                user_id=_user_id,
                purpose="resume_chat_edit",
                reference_id=str(_job_id),
                input_tokens=getattr(usage, "prompt_token_count", 0) if usage else 0,
                output_tokens=getattr(usage, "candidates_token_count", 0) if usage else 0,
                total_tokens=getattr(usage, "total_token_count", 0) if usage else 0,
                cached_tokens=getattr(usage, "cached_content_token_count", 0) if usage else 0,
                response_time_ms=0,  # ADK doesn't expose per-call timing
                success=True,
                error_message=None,
            )
            return llm_response

        return Agent(
            model=self.flash_model,
            name="resume_editor",
            instruction=system_prompt,
            tools=[get_resume, edit_resume, set_template],
            after_model_callback=_after_model_callback,
        )

    async def chat(
        self,
        job_id: int,
        user_id: str,
        message: str,
        job_description: dict,
        profile_info: dict,
        current_resume: dict,
    ) -> dict[str, Any]:
        session_id = f"job_chat_{job_id}"

        agent = self._build_agent(job_description, profile_info, user_id, job_id)
        runner = Runner(
            agent=agent,
            app_name=APP_NAME,
            session_service=self.session_service,
        )

        # Get or create session
        session = await self.session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )
        if not session:
            session = await self.session_service.create_session(
                app_name=APP_NAME,
                user_id=user_id,
                session_id=session_id,
                state={"resume": current_resume},
            )

        new_message = types.Content(
            role="user", parts=[types.Part.from_text(text=message)]
        )

        response_text = ""
        resume_modified = False
        pending_template_id: str | None = None
        t0 = time.monotonic()

        async for event in run_agent_with_retry(
            runner,
            user_id=user_id,
            session_id=session_id,
            new_message=new_message,
        ):
            if event.actions and event.actions.state_delta:
                if "resume" in event.actions.state_delta:
                    resume_modified = True
                if "pending_template_id" in event.actions.state_delta:
                    pending_template_id = event.actions.state_delta["pending_template_id"]
            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        logger.info(f"Chat turn for job {job_id}: {elapsed_ms}ms, modified={resume_modified}")

        # Get updated resume from session state
        updated_session = await self.session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )
        updated_resume = updated_session.state.get("resume") if updated_session else None
        if updated_session and not pending_template_id:
            pending_template_id = updated_session.state.get("pending_template_id")

        return {
            "response": response_text,
            "resume_modified": resume_modified,
            "custom_resume_data": updated_resume,
            "pending_template_id": pending_template_id,
        }

    _TOOL_LABELS = {
        "get_resume": "Reading resume...",
        "edit_resume": "Editing resume...",
        "set_template": "Switching template...",
    }

    async def chat_stream(
        self,
        job_id: int,
        user_id: str,
        message: str,
        job_description: dict,
        profile_info: dict,
        current_resume: dict,
    ) -> AsyncGenerator[dict, None]:
        """Like chat() but yields SSE-friendly events as they happen."""
        session_id = f"job_chat_{job_id}"

        agent = self._build_agent(job_description, profile_info, user_id, job_id)
        runner = Runner(
            agent=agent,
            app_name=APP_NAME,
            session_service=self.session_service,
        )

        session = await self.session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )
        if not session:
            session = await self.session_service.create_session(
                app_name=APP_NAME,
                user_id=user_id,
                session_id=session_id,
                state={"resume": current_resume},
            )

        new_message = types.Content(
            role="user", parts=[types.Part.from_text(text=message)]
        )

        response_text = ""
        resume_modified = False
        pending_template_id: str | None = None
        t0 = time.monotonic()

        async for event in run_agent_with_retry(
            runner,
            user_id=user_id,
            session_id=session_id,
            new_message=new_message,
        ):
            # Detect tool calls and yield them
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.function_call:
                        label = self._TOOL_LABELS.get(part.function_call.name, part.function_call.name)
                        yield {"type": "tool_call", "name": part.function_call.name, "label": label}

            if event.actions and event.actions.state_delta:
                if "resume" in event.actions.state_delta:
                    resume_modified = True
                if "pending_template_id" in event.actions.state_delta:
                    pending_template_id = event.actions.state_delta["pending_template_id"]

            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        logger.info(f"Chat turn for job {job_id}: {elapsed_ms}ms, modified={resume_modified}")

        updated_session = await self.session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )
        updated_resume = updated_session.state.get("resume") if updated_session else None
        if updated_session and not pending_template_id:
            pending_template_id = updated_session.state.get("pending_template_id")

        yield {
            "type": "response",
            "response": response_text,
            "resume_modified": resume_modified,
            "custom_resume_data": updated_resume,
            "pending_template_id": pending_template_id,
        }

    async def get_history(self, job_id: int, user_id: str) -> list[dict]:
        session_id = f"job_chat_{job_id}"
        session = await self.session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )
        if not session:
            return []

        messages = []
        for event in session.events:
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.function_call:
                        label = self._TOOL_LABELS.get(part.function_call.name, part.function_call.name)
                        messages.append({
                            "type": "tool_call",
                            "name": part.function_call.name,
                            "label": label,
                            "timestamp": event.timestamp,
                        })
                    elif part.text:
                        messages.append({
                            "role": event.content.role,
                            "content": part.text,
                            "timestamp": event.timestamp,
                        })
        return messages

    async def clear_pending_template(self, job_id: int, user_id: str) -> None:
        session_id = f"job_chat_{job_id}"
        session = await self.session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )
        if session and session.state.get("pending_template_id"):
            session.state.pop("pending_template_id", None)
