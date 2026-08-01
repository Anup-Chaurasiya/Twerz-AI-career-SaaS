from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, Request, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.config import get_settings
from app.models.user import User
from app.models.tenant import Tenant, TenantDomainRule
from app.models.credit import UserCredit, TransactionType
from app.services.credit.service import CreditService
from app.services.auth import google_oauth
from app.services.auth.google_oauth import OAUTH_CSRF_COOKIE
from app.services.auth.referral import ensure_user_referral_code, generate_unique_referral_code
from typing import Optional
from app.services.auth.jwt_handler import create_access_token, verify_guest_token
from app.services.auth.cookies import (
    set_refresh_token_cookie,
    clear_refresh_token_cookie,
    set_oauth_csrf_cookie,
    clear_oauth_csrf_cookie,
)
from app.services.auth.refresh_tokens import (
    REFRESH_TOKEN_COOKIE,
    create_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
)
from app.dependencies import get_current_user
from app.exceptions import AuthenticationError, ProfileNotFoundError, ConflictError
from app.services.profile.service import ProfileService
from logging import getLogger

logger = getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
profile_service = ProfileService()
credit_service = CreditService()


def _get_redirect_uri() -> str:
    """OAuth callback on the frontend origin (must match Google Console).

    Google redirects to FRONTEND_URL/auth/google/callback; the Next.js route
    forwards the code to this API where CSRF validation runs.
    """
    settings = get_settings()
    return f"{settings.FRONTEND_URL.rstrip('/')}/auth/google/callback"


async def _resolve_referrer_id(db: AsyncSession, ref: str | None) -> str | None:
    if not ref:
        return None
    referrer_result = await db.execute(
        select(User).where(User.referral_code == ref.strip())
    )
    referrer = referrer_result.scalar_one_or_none()
    if referrer:
        logger.info("Referral code matched referrer %s (code: %s)", referrer.id, ref)
        return referrer.id
    return None


from app.utils.client_ip import client_ip as _client_ip


def _guest_claim_error_code(exc: Exception) -> str:
    """Map claim failures to stable codes for the login page."""
    if isinstance(exc, ConflictError):
        return "already_claimed"
    if isinstance(exc, AuthenticationError):
        msg = str(exc)
        if msg == "guest_token_expired":
            return "expired"
        return "invalid"
    if isinstance(exc, ProfileNotFoundError):
        msg = str(exc).lower()
        if "expired" in msg:
            return "expired"
        return "invalid"
    return "invalid"


@router.get("/google/login")
async def google_login(
    response: Response,
    ref: Optional[str] = Query(default=None, max_length=32),
    guest_token: Optional[str] = Query(default=None, max_length=512),
):
    """Return Google OAuth URL. Optional `ref` referral code and `guest_token` embedded in OAuth state."""
    csrf = google_oauth.new_oauth_csrf_token()
    state = google_oauth.encode_oauth_state(ref=ref, csrf=csrf, guest_token=guest_token)
    url = google_oauth.get_login_url(_get_redirect_uri(), state=state)
    set_oauth_csrf_cookie(response, csrf)
    return {"url": url}


@router.get("/google/callback")
async def google_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    state: Optional[str] = None,
    ref: Optional[str] = None,  # legacy fallback only
):
    redirect_uri = _get_redirect_uri()
    state_data = google_oauth.decode_oauth_state(state)
    cookie_csrf = request.cookies.get(OAUTH_CSRF_COOKIE)
    state_csrf = (state_data.get("csrf") or "").strip()
    if not cookie_csrf or not state_csrf or cookie_csrf != state_csrf:
        logger.warning("OAuth callback rejected: CSRF state mismatch")
        raise AuthenticationError("Invalid OAuth state")

    try:
        tokens = await google_oauth.exchange_code(code, redirect_uri)
        user_info = await google_oauth.get_user_info(tokens["access_token"])
    except Exception as e:
        logger.exception(f"Google OAuth exchange failed: {e}")
        raise AuthenticationError("Failed to authenticate with Google")

    referral_code = (state_data.get("ref") or ref or "").strip() or None

    google_id = user_info["id"]
    email = user_info["email"]
    name = user_info.get("name", "")
    picture = user_info.get("picture")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        email_domain = email.split("@")[-1].lower() if "@" in email else ""
        tenant_id = None
        if email_domain:
            rule_result = await db.execute(
                select(TenantDomainRule).where(TenantDomainRule.domain == email_domain)
            )
            rule = rule_result.scalar_one_or_none()
            if rule:
                tenant_id = rule.tenant_id

        referred_by_user_id = await _resolve_referrer_id(db, referral_code)
        new_referral_code = await generate_unique_referral_code(db)
        signup_ip = _client_ip(request)

        user = User(
            google_id=google_id,
            email=email,
            name=name,
            picture_url=picture,
            consent_accepted=True,
            consent_accepted_at=datetime.now(timezone.utc),
            tenant_id=tenant_id,
            referral_code=new_referral_code,
            referred_by_user_id=referred_by_user_id,
            signup_ip=signup_ip,
        )
        db.add(user)
        await db.flush()

        # Prevent self-referral if codes ever collide
        if user.referred_by_user_id == user.id:
            user.referred_by_user_id = None

        user_credit = UserCredit(
            user_id=user.id,
            balance=0,
            daily_free_used=0,
            daily_free_reset_date=datetime.now(timezone.utc).date(),
        )
        db.add(user_credit)
        await db.flush()

        signup_bonus = get_settings().SIGNUP_BONUS_CREDITS
        if signup_bonus > 0:
            await credit_service.add_credits(
                db,
                user.id,
                signup_bonus,
                TransactionType.ADMIN_GRANT,
                description="Welcome bonus — first signup",
            )

        await db.commit()

        logger.info(
            "New user created: %s, referral_code: %s, referred_by: %s",
            email,
            new_referral_code,
            user.referred_by_user_id,
        )
    else:
        user.name = name
        user.picture_url = picture

        if not user.tenant_id:
            email_domain = email.split("@")[-1].lower() if "@" in email else ""
            if email_domain:
                rule_result = await db.execute(
                    select(TenantDomainRule).where(TenantDomainRule.domain == email_domain)
                )
                rule = rule_result.scalar_one_or_none()
                if rule:
                    user.tenant_id = rule.tenant_id

        await ensure_user_referral_code(db, user)
        await db.commit()

    jwt_token = create_access_token(user.id, user.email)
    refresh_raw = await create_refresh_token(
        db,
        user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=_client_ip(request),
    )
    await db.commit()

    guest_token = (state_data.get("guest") or "").strip()
    claimed_profile_id: int | None = None
    claim_error: str | None = None
    if guest_token:
        try:
            profile_id = verify_guest_token(guest_token)
            claimed = await profile_service.claim_guest_profile(db, profile_id, user.id, guest_token)
            claimed_profile_id = claimed.id
            logger.info("Guest profile %s claimed by user %s during OAuth", profile_id, user.id)
        except (ProfileNotFoundError, ConflictError, AuthenticationError) as e:
            claim_error = _guest_claim_error_code(e)
            logger.warning("Guest profile claim during OAuth failed for user %s: %s", user.id, e)

    settings = get_settings()
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    redirect_url = f"{frontend_url}/login#token={jwt_token}"
    if claimed_profile_id is not None:
        redirect_url += f"&claimed_profile={claimed_profile_id}"
    elif claim_error:
        redirect_url += f"&claim_error={claim_error}"
    redirect = RedirectResponse(url=redirect_url)
    clear_oauth_csrf_cookie(redirect)
    set_refresh_token_cookie(redirect, refresh_raw)
    return redirect


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Issue a new access token using the HttpOnly refresh-token cookie."""
    raw = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if not raw:
        clear_refresh_token_cookie(response)
        raise AuthenticationError("refresh_token_invalid")

    try:
        new_raw, user = await rotate_refresh_token(db, raw)
        await db.commit()
    except AuthenticationError:
        await db.rollback()
        clear_refresh_token_cookie(response)
        raise

    access_token = create_access_token(user.id, user.email)
    set_refresh_token_cookie(response, new_raw)
    return {"access_token": access_token}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Revoke refresh session and clear cookie."""
    raw = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if raw:
        await revoke_refresh_token(db, raw)
        await db.commit()
    clear_refresh_token_cookie(response)
    return {"success": True}


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user information including onboarding status and referral code."""
    tenant_name = None
    if current_user.tenant_id:
        tenant = await db.get(Tenant, current_user.tenant_id)
        if tenant:
            tenant_name = tenant.name

    assigned = await ensure_user_referral_code(db, current_user)
    if assigned:
        await db.commit()
        await db.refresh(current_user)

    time_since_creation = datetime.now(timezone.utc) - current_user.created_at
    is_new_user = time_since_creation.total_seconds() < 300

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture_url": current_user.picture_url,
        "consent_accepted": current_user.consent_accepted,
        "onboarding_completed": current_user.onboarding_completed,
        "is_new_user": is_new_user,
        "is_super_admin": current_user.is_super_admin,
        "tenant_id": current_user.tenant_id,
        "tenant_name": tenant_name,
        "referral_code": current_user.referral_code,
    }


@router.post("/claim-guest-profile")
async def claim_guest_profile(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bind an unclaimed guest profile to the authenticated user."""
    guest_token = (payload.get("guest_token") or "").strip()
    if not guest_token:
        raise AuthenticationError("guest_token_required")
    profile_id = verify_guest_token(guest_token)
    profile = await profile_service.claim_guest_profile(
        db, profile_id, current_user.id, guest_token
    )
    return {
        "success": True,
        "profile_id": profile.id,
        "status": profile.status.value,
    }


@router.post("/onboarding-complete")
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark onboarding as completed for the current user."""
    user = await db.get(User, current_user.id)
    if not user:
        raise AuthenticationError("User not found")
    user.onboarding_completed = True
    await db.commit()
    return {"success": True, "onboarding_completed": True}


@router.post("/attribution")
async def set_signup_attribution(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set signup_source / signup_share_id once (first-write wins)."""
    user = await db.get(User, current_user.id)
    if not user:
        raise AuthenticationError("User not found")

    source = (payload.get("source") or payload.get("utm_source") or "").strip()[:64]
    share_id = (payload.get("share_id") or "").strip()[:32] or None
    if not source:
        return {
            "success": False,
            "updated": False,
            "signup_source": user.signup_source,
            "signup_share_id": user.signup_share_id,
        }

    updated = False
    if not user.signup_source:
        user.signup_source = source
        updated = True
    if share_id and not user.signup_share_id:
        user.signup_share_id = share_id
        updated = True
    if updated:
        await db.commit()
    return {
        "success": True,
        "updated": updated,
        "signup_source": user.signup_source,
        "signup_share_id": user.signup_share_id,
    }
