"""
Customer management routes.
Handles CRUD operations for customers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
import logging

from ..database.db import get_db
from ..database.models import Customer, Bill, Payment
from ..utils.auth import get_current_user
from starlette.requests import Request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/customers", tags=["customers"])


class CustomerCreate:
    """Customer creation schema"""
    def __init__(self, name: str, mobile: str = None, email: str = None, 
                 address: str = None, store_id: int = None):
        self.name = name
        self.mobile = mobile
        self.email = email
        self.address = address
        self.store_id = store_id


class CustomerUpdate:
    """Customer update schema"""
    def __init__(self, name: str = None, mobile: str = None, email: str = None, 
                 address: str = None):
        self.name = name
        self.mobile = mobile
        self.email = email
        self.address = address


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Create a new customer"""
    try:
        customer = Customer(
            name=data.get("name"),
            mobile=data.get("mobile"),
            email=data.get("email"),
            address=data.get("address"),
            store_id=current_user.store_id,
            created_by=current_user.id
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        
        return {
            "id": customer.id,
            "name": customer.name,
            "mobile": customer.mobile,
            "email": customer.email,
            "address": customer.address,
            "pending_amount": 0,
            "created_at": customer.created_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Error creating customer: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating customer")


@router.get("/", response_model=List[dict])
async def get_customers(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Get all customers for the store"""
    try:
        customers = db.query(Customer).filter(
            Customer.store_id == current_user.store_id
        ).all()
        
        result = []
        for c in customers:
            pending = db.query(Bill).filter(
                Bill.customer_id == c.id,
                Bill.payment_status == "PENDING"
            ).all()
            pending_amount = sum(b.total_amount for b in pending)
            
            result.append({
                "id": c.id,
                "name": c.name,
                "mobile": c.mobile,
                "email": c.email,
                "address": c.address,
                "pending_amount": pending_amount,
                "created_at": c.created_at.isoformat()
            })
        
        return result
    except Exception as e:
        logger.error(f"Error getting customers: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting customers")


@router.get("/{customer_id}")
async def get_customer(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Get a specific customer"""
    try:
        customer = db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.store_id == current_user.store_id
        ).first()
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        pending = db.query(Bill).filter(
            Bill.customer_id == customer.id,
            Bill.payment_status == "PENDING"
        ).all()
        pending_amount = sum(b.total_amount for b in pending)
        
        return {
            "id": customer.id,
            "name": customer.name,
            "mobile": customer.mobile,
            "email": customer.email,
            "address": customer.address,
            "pending_amount": pending_amount,
            "created_at": customer.created_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting customer: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting customer")


@router.put("/{customer_id}")
async def update_customer(
    customer_id: int,
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Update a customer"""
    try:
        customer = db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.store_id == current_user.store_id
        ).first()
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        if data.get("name"):
            customer.name = data["name"]
        if data.get("mobile"):
            customer.mobile = data["mobile"]
        if data.get("email"):
            customer.email = data["email"]
        if data.get("address"):
            customer.address = data["address"]
        
        db.commit()
        db.refresh(customer)
        
        return {"success": True, "message": "Customer updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating customer: {str(e)}")
        raise HTTPException(status_code=500, detail="Error updating customer")


@router.get("/search/by-mobile")
async def search_by_mobile(
    mobile: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Search customer by mobile number"""
    try:
        customer = db.query(Customer).filter(
            Customer.mobile == mobile,
            Customer.store_id == current_user.store_id
        ).first()
        
        if not customer:
            return {"found": False}
        
        pending = db.query(Bill).filter(
            Bill.customer_id == customer.id,
            Bill.payment_status == "PENDING"
        ).all()
        pending_amount = sum(b.total_amount for b in pending)
        
        return {
            "found": True,
            "id": customer.id,
            "name": customer.name,
            "mobile": customer.mobile,
            "email": customer.email,
            "address": customer.address,
            "pending_amount": pending_amount
        }
    except Exception as e:
        logger.error(f"Error searching customer: {str(e)}")
        raise HTTPException(status_code=500, detail="Error searching customer")
