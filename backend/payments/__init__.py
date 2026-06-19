"""Payments module"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/payments", tags=["payments"])

@router.get("")
async def get_payments():
    return {"message": "Payments endpoint"}
