"""
Billing API endpoints for creating and managing bills.
Employees can create bills. Admins can view and manage all billing data.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import logging

from ..database.db import get_db
from ..database.models import (
    Bill, BillItem, Product, Customer, Payment, User, Role,
    Inventory, DailySalesReport, EmployeeBillingActivity
)
from ..utils.auth import get_current_user, check_employee_role

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/billing",
    tags=["billing"]
)


# ============================================================================
# SCHEMAS
# ============================================================================

class BillItemRequest(BaseModel):
    product_id: int
    quantity: float
    unit_price: float
    discount_percent: float = 0.0
    tax_percent: float


class CreateBillRequest(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    mobile_number: Optional[str] = None
    items: List[BillItemRequest]
    payment_method: str
    discount: float = 0.0


class BillItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: float
    unit_price: float
    discount_percent: float
    tax_percent: float
    line_total: float
    
    class Config:
        from_attributes = True


class BillResponse(BaseModel):
    id: int
    bill_id: str
    bill_number: str
    customer_id: Optional[int]
    employee_id: int
    subtotal: float
    total_tax: float
    discount: float
    total_amount: float
    paid_amount: float
    pending_amount: float
    payment_method: str
    created_at: str
    items: List[BillItemResponse]
    
    class Config:
        from_attributes = True


class BillHistoryResponse(BaseModel):
    id: int
    bill_number: str
    customer_name: Optional[str]
    total_amount: float
    payment_method: str
    created_at: str
    
    class Config:
        from_attributes = True


# ============================================================================
# ROUTES
# ============================================================================

def generate_bill_number(store_id: int, db: Session) -> str:
    """Generate a unique bill number for the store."""
    from datetime import date
    today = date.today().strftime("%Y%m%d")
    count = db.query(Bill).filter(
        Bill.bill_number.like(f"BILL-{today}-%")
    ).count() + 1
    return f"BILL-{today}-{count:06d}"


@router.post("/create", response_model=BillResponse)
async def create_bill(
    request: CreateBillRequest,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new bill.
    Employees can create bills. Only one bill at a time per employee.
    """
    try:
        check_employee_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        if not request.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bill must contain at least one item"
            )
        
        # Get or create customer
        customer = None
        if request.customer_id:
            customer = db.query(Customer).filter(
                Customer.id == request.customer_id,
                Customer.store_id == store_id
            ).first()
            if not customer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Customer not found"
                )
        elif request.customer_name:
            # Create new customer or get existing
            customer = db.query(Customer).filter(
                Customer.name == request.customer_name,
                Customer.store_id == store_id
            ).first()
            if not customer:
                customer = Customer(
                    name=request.customer_name,
                    mobile_number=request.mobile_number,
                    store_id=store_id
                )
                db.add(customer)
                db.flush()
        
        # Calculate bill totals
        subtotal = 0.0
        total_tax = 0.0
        
        bill_items = []
        for item in request.items:
            product = db.query(Product).filter(
                Product.id == item.product_id,
                Product.store_id == store_id
            ).first()
            
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product {item.product_id} not found"
                )
            
            # Calculate line total
            line_subtotal = item.quantity * item.unit_price
            discount_amount = (line_subtotal * item.discount_percent) / 100
            taxable_amount = line_subtotal - discount_amount
            tax_amount = (taxable_amount * item.tax_percent) / 100
            line_total = taxable_amount + tax_amount
            
            subtotal += line_subtotal - discount_amount
            total_tax += tax_amount
            
            bill_items.append(BillItem(
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_percent=item.discount_percent,
                tax_percent=item.tax_percent,
                line_total=line_total
            ))
            
            # Update inventory
            inventory = db.query(Inventory).filter(
                Inventory.product_id == item.product_id
            ).first()
            if inventory:
                inventory.quantity -= item.quantity
                if inventory.quantity < 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Insufficient stock for {product.name}"
                    )
        
        # Create bill
        total_amount = subtotal + total_tax - request.discount
        bill_number = generate_bill_number(store_id, db)
        
        bill = Bill(
            bill_number=bill_number,
            customer_id=customer.id if customer else None,
            employee_id=current_user.id,
            store_id=store_id,
            subtotal=subtotal,
            total_tax=total_tax,
            discount=request.discount,
            total_amount=total_amount,
            paid_amount=total_amount if request.payment_method != "pending" else 0,
            pending_amount=0 if request.payment_method != "pending" else total_amount,
            payment_method=request.payment_method
        )
        
        bill.items = bill_items
        db.add(bill)
        db.flush()
        
        # Record employee activity
        activity = EmployeeBillingActivity(
            employee_id=current_user.id,
            bill_id=bill.id,
            activity_type="bill_created",
            bill_total=total_amount
        )
        db.add(activity)
        
        db.commit()
        db.refresh(bill)
        
        logger.info(f"Bill created: {bill.bill_number} by {current_user.username}")
        
        return BillResponse.from_orm(bill)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating bill: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create bill"
        )


@router.get("/bills", response_model=List[BillHistoryResponse])
async def get_bills(
    store_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get bill history.
    Employees see only their bills. Admins see all bills.
    """
    try:
        check_employee_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        query = db.query(Bill).filter(Bill.store_id == store_id)
        
        # Employees see only their bills
        if current_user.role == Role.EMPLOYEE:
            query = query.filter(Bill.employee_id == current_user.id)
        
        bills = query.order_by(Bill.created_at.desc()).offset(skip).limit(limit).all()
        return bills
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bills: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch bills"
        )


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(
    bill_id: int,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific bill."""
    try:
        check_employee_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        bill = db.query(Bill).filter(
            Bill.id == bill_id,
            Bill.store_id == store_id
        ).first()
        
        if not bill:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bill not found"
            )
        
        # Employees can only see their own bills
        if current_user.role == Role.EMPLOYEE and bill.employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return BillResponse.from_orm(bill)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bill: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch bill"
        )


@router.get("/search/by-number")
async def get_bill_by_number(
    bill_number: str,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a bill by bill number."""
    try:
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        bill = db.query(Bill).filter(
            Bill.bill_number == bill_number,
            Bill.store_id == store_id
        ).first()
        
        if not bill:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bill not found"
            )
        
        return BillResponse.from_orm(bill)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching bill: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search bill"
        )
