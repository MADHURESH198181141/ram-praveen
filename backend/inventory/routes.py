"""
Inventory management routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from ..database.db import get_db
from ..database.models import Product
from ..utils.auth import get_current_user
from starlette.requests import Request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/stock-levels")
async def get_stock_levels(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Get current stock levels for all products"""
    try:
        products = db.query(Product).filter(
            Product.store_id == current_user.store_id,
            Product.is_active == True
        ).all()
        
        return [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "stock_quantity": p.stock_quantity,
                "reorder_level": p.reorder_level or 10,
                "status": "low" if p.stock_quantity < (p.reorder_level or 10) else "ok"
            }
            for p in products
        ]
    except Exception as e:
        logger.error(f"Error getting stock levels: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting stock levels")


@router.post("/update-stock")
async def update_stock(
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(lambda req, db: get_current_user(req, db))
):
    """Update product stock quantity"""
    try:
        product = db.query(Product).filter(Product.id == data.get("product_id")).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product.stock_quantity += data.get("quantity", 0)
        db.commit()
        
        return {
            "success": True,
            "message": "Stock updated successfully",
            "new_quantity": product.stock_quantity
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating stock: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating stock")
