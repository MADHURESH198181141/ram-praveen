"""
Customers API endpoints for managing customer data and payment history.
Admins can manage customers. Employees can view customers.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from ..database.db import get_db
from ..database.models import Customer, Payment, Bill, User, Role
from ..utils.auth import get_current_user, check_employee_role

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/customers",
    tags=["customers"]
)


# ============================================================================
# SCHEMAS
# ============================================================================

class CreateCustomerRequest(BaseModel):
    name: str
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: str = "new"


class UpdateCustomerRequest(BaseModel):
    name: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: Optional[str] = None


class CustomerResponse(BaseModel):
    id: int
    customer_id: str
    name: str
    mobile_number: Optional[str]
    email: Optional[str]
    address: Optional[str]
    customer_type: str
    pending_amount: float
    total_purchase: float
    created_at: str
    
    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    id: int
    payment_id: str
    bill_id: int
    total_paid: float
    payment_method: str
    created_at: str
    
    class Config:
        from_attributes = True


class CustomerDetailResponse(CustomerResponse):
    bills: List[dict] = []
    payments: List[PaymentResponse] = []


# ============================================================================
# ROUTES
# ============================================================================

@router.post("/", response_model=CustomerResponse)
async def create_customer(
    request: CreateCustomerRequest,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new customer. Admin only."""
    try:
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Check if customer already exists
        existing = db.query(Customer).filter(
            Customer.mobile_number == request.mobile_number,
            Customer.store_id == store_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer already exists"
            )
        
        customer = Customer(
            name=request.name,
            mobile_number=request.mobile_number,
            email=request.email,
            address=request.address,
            customer_type=request.customer_type,
            store_id=store_id
        )
        
        db.add(customer)
        db.commit()
        db.refresh(customer)
        
        logger.info(f"Customer created: {customer.name}")
        return CustomerResponse.from_orm(customer)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating customer: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create customer"
        )


@router.get("/", response_model=List[CustomerResponse])
async def get_customers(
    store_id: int,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all customers for a store."""
    try:
        check_employee_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        query = db.query(Customer).filter(Customer.store_id == store_id)
        
        if search:
            query = query.filter(
                (Customer.name.ilike(f"%{search}%")) |
                (Customer.mobile_number.ilike(f"%{search}%")) |
                (Customer.email.ilike(f"%{search}%"))
            )
        
        customers = query.offset(skip).limit(limit).all()
        return customers
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch customers"
        )


@router.get("/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(
    customer_id: int,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get customer details with bill and payment history."""
    try:
        check_employee_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        customer = db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.store_id == store_id
        ).first()
        
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
        
        # Get customer bills
        bills = db.query(Bill).filter(Bill.customer_id == customer_id).all()
        
        # Get customer payments
        payments = db.query(Payment).filter(Payment.customer_id == customer_id).all()
        
        response = CustomerResponse.from_orm(customer)
        response.bills = [{"bill_id": b.id, "bill_number": b.bill_number, "amount": b.total_amount} for b in bills]
        response.payments = [PaymentResponse.from_orm(p) for p in payments]
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch customer"
        )


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    request: UpdateCustomerRequest,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update customer information. Admin only."""
    try:
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        customer = db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.store_id == store_id
        ).first()
        
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
        
        if request.name is not None:
            customer.name = request.name
        if request.mobile_number is not None:
            customer.mobile_number = request.mobile_number
        if request.email is not None:
            customer.email = request.email
        if request.address is not None:
            customer.address = request.address
        if request.customer_type is not None:
            customer.customer_type = request.customer_type
        
        db.commit()
        db.refresh(customer)
        
        logger.info(f"Customer updated: {customer.name}")
        return CustomerResponse.from_orm(customer)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating customer: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update customer"
        )


@router.get("/search/by-mobile")
async def search_customer_by_mobile(
    mobile_number: str,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search customer by mobile number."""
    try:
        check_employee_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        customer = db.query(Customer).filter(
            Customer.mobile_number == mobile_number,
            Customer.store_id == store_id
        ).first()
        
        if not customer:
            return {"found": False}
        
        return {
            "found": True,
            "customer": CustomerResponse.from_orm(customer)
        }
    
    except Exception as e:
        logger.error(f"Error searching customer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search customer"
        )
