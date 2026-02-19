"""Authentication routes (better-auth integration)"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/session")
async def get_session(request: Request):
    """
    Validate session from better-auth cookie.
    This endpoint will validate the session cookie set by better-auth on the frontend.
    """
    # TODO: Implement session validation
    # better-auth sets session cookies that need to be validated
    # For Phase 1, this is a placeholder
    return {"authenticated": False, "message": "Session validation not yet implemented"}


@router.get("/me")
async def get_current_user(request: Request):
    """
    Get current authenticated user information.
    Validates session and returns user data.
    """
    # TODO: Implement user retrieval from validated session
    return {"user": None, "message": "User retrieval not yet implemented"}
