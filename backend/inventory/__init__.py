"""Inventory module"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

@router.get("")
async def get_inventory():
    return {"message": "Inventory endpoint"}
