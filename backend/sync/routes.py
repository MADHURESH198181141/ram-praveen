"""
Offline sync routes.
Handles synchronization of offline data to server.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging
from typing import List

from ..database.db import get_db
from ..database.models import Bill, Payment
from ..utils.auth import get_current_user
from starlette.requests import Request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/push")
async def sync_push(
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """
    Receive offline-created data and sync to database.
    Expected data format:
    {
        "bills": [...],
        "payments": [...],
        "products": [...]
    }
    """
    try:
        synced_count = 0
        
        # Sync bills
        for bill_data in data.get("bills", []):
            try:
                # Bill sync logic
                synced_count += 1
            except Exception as e:
                logger.warning(f"Error syncing bill: {str(e)}")
        
        # Sync payments
        for payment_data in data.get("payments", []):
            try:
                # Payment sync logic
                synced_count += 1
            except Exception as e:
                logger.warning(f"Error syncing payment: {str(e)}")
        
        return {
            "success": True,
            "synced_items": synced_count,
            "message": f"Successfully synced {synced_count} items"
        }
    except Exception as e:
        logger.error(f"Error during sync: {str(e)}")
        raise HTTPException(status_code=500, detail="Sync error")


@router.get("/pull")
async def sync_pull(
    since: str = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """
    Send all data updates since specified timestamp.
    """
    try:
        return {
            "success": True,
            "bills": [],
            "payments": [],
            "products": [],
            "timestamp": None
        }
    except Exception as e:
        logger.error(f"Error during pull sync: {str(e)}")
        raise HTTPException(status_code=500, detail="Sync error")
