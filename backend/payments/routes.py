"""
Payment management routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from ..database.db import get_db
from ..database.models import Payment, Bill, Customer
from ..utils.auth import get_current_user
from starlette.requests import Request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.post("/")
async def record_payment(
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Record a payment for a bill"""
    try:
        bill = db.query(Bill).filter(Bill.id == data.get("bill_id")).first()
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")
        
        payment = Payment(
            bill_id=bill.id,
            amount=data.get("amount"),
            payment_method=data.get("payment_method", "CASH"),
            reference_id=data.get("reference_id"),
            store_id=current_user.store_id,
            created_by=current_user.id
        )
        
        db.add(payment)
        
        # Update bill payment status
        bill.total_paid = (bill.total_paid or 0) + data.get("amount", 0)
        if bill.total_paid >= bill.total_amount:
            bill.payment_status = "COMPLETED"
        else:
            bill.payment_status = "PARTIAL"
        
        db.commit()
        
        return {
            "success": True,
            "message": "Payment recorded successfully",
            "payment_id": payment.id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording payment: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error recording payment")


@router.get("/bill/{bill_id}")
async def get_bill_payments(
    bill_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Get all payments for a bill"""
    try:
        payments = db.query(Payment).filter(Payment.bill_id == bill_id).all()
        return [
            {
                "id": p.id,
                "amount": p.amount,
                "method": p.payment_method,
                "timestamp": p.created_at.isoformat() if p.created_at else None
            }
            for p in payments
        ]
    except Exception as e:
        logger.error(f"Error getting payments: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting payments")
