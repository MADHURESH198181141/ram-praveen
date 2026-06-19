"""
Authentication routes for user login and token management.
Uses JWT tokens and bcrypt password hashing.
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import jwt
import os
from dotenv import load_dotenv
import logging

from ..database.db import get_db
from ..database.models import User, Role
from .security import get_password_hash, verify_password, create_access_token, verify_token

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env.local'))

router = APIRouter(
    prefix="/api/auth",
    tags=["authentication"]
)


# ============================================================================
# SCHEMAS
# ============================================================================

class LoginRequest(BaseModel):
    username: str
    password: str
    store_id: int


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: int
    user_id: str
    username: str
    email: Optional[str]
    role: str
    store_id: int

    class Config:
        from_attributes = True


class TokenPayload(BaseModel):
    sub: str
    exp: datetime
    user_id: str
    username: str
    role: str
    store_id: int


# ============================================================================
# ROUTES
# ============================================================================

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    User login endpoint.
    Returns JWT access token if credentials are valid.
    """
    try:
        # Find user by username and store_id
        user = db.query(User).filter(
            User.username == request.username,
            User.store_id == request.store_id,
            User.is_active == True
        ).first()

        if not user:
            logger.warning(f"Login failed: User not found - {request.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify password
        if not verify_password(request.password, user.password_hash):
            logger.warning(f"Login failed: Invalid password - {request.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Create access token
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "user_id": user.user_id,
                "username": user.username,
                "role": user.role.value,
                "store_id": user.store_id
            }
        )

        logger.info(f"User logged in successfully: {user.username}")

        return LoginResponse(
            access_token=access_token,
            user={
                "id": user.id,
                "user_id": user.user_id,
                "username": user.username,
                "email": user.email,
                "role": user.role.value,
                "store_id": user.store_id
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/logout")
async def logout():
    """
    Logout endpoint.
    Note: JWT tokens are stateless, so logout is handled on client side.
    """
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    token: str = None,
    db: Session = Depends(get_db)
):
    """
    Get current user information from JWT token.
    """
    try:
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated"
            )

        payload = verify_token(token)
        user_id: str = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        user = db.query(User).filter(User.id == int(user_id)).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return UserResponse.from_orm(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token"
        )


@router.post("/refresh")
async def refresh_token(current_token: str):
    """
    Refresh access token.
    """
    try:
        payload = verify_token(current_token)
        
        # Create new token with same claims
        new_token = create_access_token(
            data={
                "sub": payload.get("sub"),
                "user_id": payload.get("user_id"),
                "username": payload.get("username"),
                "role": payload.get("role"),
                "store_id": payload.get("store_id")
            }
        )

        return {
            "access_token": new_token,
            "token_type": "bearer"
        }

    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh token"
        )


@router.post("/verify-token")
async def verify_access_token(token: str):
    """
    Verify if a JWT token is valid.
    """
    try:
        payload = verify_token(token)
        return {
            "valid": True,
            "user_id": payload.get("user_id"),
            "username": payload.get("username"),
            "role": payload.get("role")
        }
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return {
            "valid": False,
            "error": str(e)
        }

