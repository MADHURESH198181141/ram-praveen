"""
Reports API endpoints for viewing sales and billing analytics.
Admins can view all reports. Employees can view their own activity.
"""

from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from ..database.db import get_db
from ..database.models import (
    DailySalesReport, EmployeeBillingActivity, Bill, 
    User, Role, Customer
)
from ..utils.auth import get_current_user, check_employee_role

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"]
)


# ============================================================================
# SCHEMAS
# ============================================================================

class DailySalesReportResponse(BaseModel):
    report_date: str
    total_bills: int
    total_amount: float
    total_tax: float
    total_discount: float
    cash_sales: float
    upi_sales: float
    card_sales: float
    pending_amount: float
    
    class Config:
        from_attributes = True


class EmployeeActivityResponse(BaseModel):
    employee_id: int
    activity_type: str
    bill_total: float
    timestamp: str
    
    class Config:
        from_attributes = True


class BillingAnalyticsResponse(BaseModel):
    total_bills: int
    total_sales: float
    average_bill: float
    total_pending: float
    top_customers: List[dict] = []


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/daily-sales", response_model=List[DailySalesReportResponse])
async def get_daily_sales_report(
    store_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get daily sales reports.
    Admins can view all reports. Employees see aggregated data.
    """
    try:
        check_employee_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        query = db.query(DailySalesReport).filter(
            DailySalesReport.store_id == store_id
        )
        
        if start_date:
            query = query.filter(DailySalesReport.report_date >= start_date)
        if end_date:
            query = query.filter(DailySalesReport.report_date <= end_date)
        
        reports = query.order_by(DailySalesReport.report_date.desc()).all()
        return reports
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching daily sales report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch report"
        )


@router.get("/employee-activity")
async def get_employee_activity(
    store_id: int,
    employee_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get employee billing activity.
    Admins can view all employees. Employees see their own activity.
    """
    try:
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        query = db.query(EmployeeBillingActivity)
        
        # Employees see only their own activity
        if current_user.role == Role.EMPLOYEE:
            query = query.filter(EmployeeBillingActivity.employee_id == current_user.id)
        elif employee_id:
            query = query.filter(EmployeeBillingActivity.employee_id == employee_id)
        
        if start_date:
            query = query.filter(EmployeeBillingActivity.timestamp >= start_date)
        if end_date:
            query = query.filter(EmployeeBillingActivity.timestamp <= end_date)
        
        activities = query.order_by(EmployeeBillingActivity.timestamp.desc()).all()
        
        return {
            "total_activities": len(activities),
            "activities": activities
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employee activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch activity"
        )


@router.get("/analytics")
async def get_billing_analytics(
    store_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get billing analytics and summary statistics."""
    try:
        check_employee_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        query = db.query(Bill).filter(Bill.store_id == store_id)
        
        if start_date:
            query = query.filter(Bill.created_at >= start_date)
        if end_date:
            query = query.filter(Bill.created_at <= end_date)
        
        bills = query.all()
        
        total_bills = len(bills)
        total_sales = sum(b.total_amount for b in bills) if bills else 0
        average_bill = total_sales / total_bills if total_bills > 0 else 0
        total_pending = sum(b.pending_amount for b in bills) if bills else 0
        
        # Get top customers
        top_customers_query = db.query(
            Customer.name,
            Customer.customer_id
        ).join(Bill, Bill.customer_id == Customer.id).filter(
            Bill.store_id == store_id
        ).group_by(Customer.id)
        
        top_customers = [
            {"name": c.name, "customer_id": c.customer_id}
            for c in top_customers_query.limit(10).all()
        ]
        
        return BillingAnalyticsResponse(
            total_bills=total_bills,
            total_sales=total_sales,
            average_bill=average_bill,
            total_pending=total_pending,
            top_customers=top_customers
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analytics"
        )
