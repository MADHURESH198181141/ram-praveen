"""
Billing routes - Bill creation, retrieval, and management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import logging

from ..database.db import get_db
from ..database.models import Bill, BillItem, Product, Customer
from ..utils.auth import get_current_user
from starlette.requests import Request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.post("/create")
async def create_bill(
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Create a new bill"""
    try:
        # Get next bill number
        last_bill = db.query(Bill).filter(
            Bill.store_id == current_user.store_id
        ).order_by(Bill.id.desc()).first()
        
        bill_number = (last_bill.bill_number + 1) if last_bill else 1001
        
        # Create bill
        bill = Bill(
            bill_id=str(uuid.uuid4()),
            bill_number=bill_number,
            customer_id=data.get("customer_id"),
            store_id=current_user.store_id,
            created_by=current_user.id,
            subtotal=data.get("subtotal", 0),
            tax_amount=data.get("tax_amount", 0),
            discount_amount=data.get("discount_amount", 0),
            total_amount=data.get("total_amount", 0),
            payment_status="PENDING",
            items=[]
        )
        
        # Add bill items
        for item_data in data.get("items", []):
            product = db.query(Product).filter(Product.id == item_data.get("product_id")).first()
            if product:
                # Decrement stock
                product.stock_quantity -= item_data.get("quantity", 0)
                
                bill_item = BillItem(
                    product_id=product.id,
                    quantity=item_data.get("quantity", 0),
                    unit_price=item_data.get("unit_price", 0),
                    tax_rate=item_data.get("tax_rate", 0),
                    line_total=item_data.get("line_total", 0)
                )
                bill.items.append(bill_item)
        
        db.add(bill)
        db.commit()
        db.refresh(bill)
        
        return {
            "success": True,
            "bill_id": bill.bill_id,
            "bill_number": bill.bill_number,
            "message": "Bill created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating bill: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating bill: {str(e)}")


@router.get("/bills")
async def get_bills(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Get all bills for the store"""
    try:
        bills = db.query(Bill).filter(
            Bill.store_id == current_user.store_id
        ).order_by(Bill.id.desc()).all()
        
        result = []
        for b in bills:
            result.append({
                "id": b.bill_id,
                "bill_number": b.bill_number,
                "customer_id": b.customer_id,
                "total_amount": b.total_amount,
                "payment_status": b.payment_status,
                "created_at": b.created_at.isoformat() if b.created_at else None
            })
        
        return result
    except Exception as e:
        logger.error(f"Error getting bills: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting bills")


@router.get("/{bill_id}")
async def get_bill(
    bill_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Get a specific bill"""
    try:
        bill = db.query(Bill).filter(
            Bill.bill_id == bill_id,
            Bill.store_id == current_user.store_id
        ).first()
        
        if not bill:
            raise HTTPException(status_code=404, detail="Bill not found")
        
        items = []
        for item in bill.items:
            items.append({
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_rate": item.tax_rate,
                "line_total": item.line_total
            })
        
        return {
            "id": bill.bill_id,
            "bill_number": bill.bill_number,
            "customer_id": bill.customer_id,
            "subtotal": bill.subtotal,
            "tax_amount": bill.tax_amount,
            "discount_amount": bill.discount_amount,
            "total_amount": bill.total_amount,
            "payment_status": bill.payment_status,
            "items": items,
            "created_at": bill.created_at.isoformat() if bill.created_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bill: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting bill")


@router.get("/search/by-number")
async def search_bill_by_number(
    number: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Search bill by bill number"""
    try:
        bill = db.query(Bill).filter(
            Bill.bill_number == number,
            Bill.store_id == current_user.store_id
        ).first()
        
        if not bill:
            return {"found": False}
        
        items = []
        for item in bill.items:
            items.append({
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_rate": item.tax_rate,
                "line_total": item.line_total
            })
        
        return {
            "found": True,
            "id": bill.bill_id,
            "bill_number": bill.bill_number,
            "customer_id": bill.customer_id,
            "total_amount": bill.total_amount,
            "payment_status": bill.payment_status,
            "items": items
        }
    except Exception as e:
        logger.error(f"Error searching bill: {str(e)}")
        raise HTTPException(status_code=500, detail="Error searching bill")
