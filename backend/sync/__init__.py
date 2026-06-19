"""Sync module for offline-online synchronization"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/sync", tags=["sync"])

@router.get("")
async def get_sync_status():
    return {"message": "Sync endpoint"}

@router.post("/sync-item")
async def sync_item(item: dict):
    return {"message": "Item synced", "status": "success"}
