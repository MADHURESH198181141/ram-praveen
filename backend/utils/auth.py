"""
Authentication utility functions.
Provides helpers for JWT verification and role-based access control.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from starlette.requests import Request
from sqlalchemy.orm import Session
import logging

from ..database.db import get_db
from ..database.models import User, Role
from ..auth.security import verify_token

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """
    Extract and validate JWT token from request headers.
    Returns the current authenticated user.
    """
    try:
        # Extract Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No credentials provided"
            )
        
        token = auth_header.replace("Bearer ", "")
        payload = verify_token(token)
        
        user_id: int = int(payload.get("sub"))
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user"
            )
        
        return user
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


async def check_admin_role(user: User):
    """
    Check if user has admin role.
    Raises HTTPException if user is not admin.
    """
    if user.role != Role.ADMIN:
        logger.warning(f"Unauthorized access attempt by {user.username} (role: {user.role})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


def check_employee_role(user: User):
    """
    Check if user has employee role.
    """
    if user.role not in [Role.EMPLOYEE, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee access required"
        )
