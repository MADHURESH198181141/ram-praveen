"""
Products API endpoints for managing products and categories.
Role-based access control: Only ADMIN can add/edit/delete products.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from ..database.db import get_db
from ..database.models import Product, Category, Inventory, User, Role
from ..auth.security import verify_token
from ..utils.auth import get_current_user, check_admin_role

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/products",
    tags=["products"]
)


# ============================================================================
# SCHEMAS
# ============================================================================

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    
    class Config:
        from_attributes = True


class InventoryResponse(BaseModel):
    quantity: int
    last_updated: str
    
    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    id: int
    product_id: str
    name: str
    hsn_code: Optional[str]
    description: Optional[str]
    price: float
    cost_price: Optional[float]
    category_id: int
    unit: str
    gst_rate: float
    is_active: bool
    inventory: Optional[InventoryResponse]
    
    class Config:
        from_attributes = True


class CreateProductRequest(BaseModel):
    name: str
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    category_id: int
    price: float
    cost_price: Optional[float] = None
    unit: str = "Piece"
    gst_rate: float = 5.0
    initial_quantity: int = 0


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    unit: Optional[str] = None
    gst_rate: Optional[float] = None
    is_active: Optional[bool] = None


class CreateCategoryRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateCategoryRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ============================================================================
# CATEGORIES
# ============================================================================

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all categories for a store."""
    try:
        # Verify user belongs to this store
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        categories = db.query(Category).filter(
            Category.store_id == store_id
        ).all()
        
        return categories
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch categories"
        )


@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    request: CreateCategoryRequest,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new category. Admin only."""
    try:
        await check_admin_role(current_user)
        
        # Verify user belongs to this store
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Check if category already exists
        existing = db.query(Category).filter(
            Category.name == request.name,
            Category.store_id == store_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category already exists"
            )
        
        category = Category(
            name=request.name,
            description=request.description,
            store_id=store_id
        )
        
        db.add(category)
        db.commit()
        db.refresh(category)
        
        logger.info(f"Category created: {category.name}")
        return category
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating category: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create category"
        )


# ============================================================================
# PRODUCTS
# ============================================================================

@router.get("", response_model=List[ProductResponse])
async def get_products(
    store_id: int,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get products for a store.
    Employees can only see active products.
    Admins can see all products.
    """
    try:
        # Verify user belongs to this store
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        query = db.query(Product).filter(Product.store_id == store_id)
        
        # Filter by category if provided
        if category_id:
            query = query.filter(Product.category_id == category_id)
        
        # Filter by search term
        if search:
            query = query.filter(
                (Product.name.ilike(f"%{search}%")) |
                (Product.hsn_code.ilike(f"%{search}%"))
            )
        
        # Employees see only active products
        if current_user.role == Role.EMPLOYEE:
            query = query.filter(Product.is_active == True)
        
        products = query.all()
        return products
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch products"
        )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific product."""
    try:
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.store_id == store_id
        ).first()
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        
        return product
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch product"
        )


@router.post("", response_model=ProductResponse)
async def create_product(
    request: CreateProductRequest,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new product. Admin only."""
    try:
        await check_admin_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Verify category exists
        category = db.query(Category).filter(
            Category.id == request.category_id,
            Category.store_id == store_id
        ).first()
        
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found"
            )
        
        product = Product(
            name=request.name,
            hsn_code=request.hsn_code,
            description=request.description,
            category_id=request.category_id,
            store_id=store_id,
            price=request.price,
            cost_price=request.cost_price,
            unit=request.unit,
            gst_rate=request.gst_rate
        )
        
        db.add(product)
        db.flush()  # Get product ID
        
        # Create inventory record
        inventory = Inventory(
            product_id=product.id,
            quantity=request.initial_quantity
        )
        db.add(inventory)
        db.commit()
        db.refresh(product)
        
        logger.info(f"Product created: {product.name}")
        return product
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating product: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create product"
        )


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    request: UpdateProductRequest,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a product. Admin only."""
    try:
        await check_admin_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.store_id == store_id
        ).first()
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        
        # Update fields
        if request.name is not None:
            product.name = request.name
        if request.description is not None:
            product.description = request.description
        if request.price is not None:
            product.price = request.price
        if request.cost_price is not None:
            product.cost_price = request.cost_price
        if request.unit is not None:
            product.unit = request.unit
        if request.gst_rate is not None:
            product.gst_rate = request.gst_rate
        if request.is_active is not None:
            product.is_active = request.is_active
        
        db.commit()
        db.refresh(product)
        
        logger.info(f"Product updated: {product.name}")
        return product
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating product: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update product"
        )


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    store_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a product. Admin only."""
    try:
        await check_admin_role(current_user)
        
        if current_user.store_id != store_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.store_id == store_id
        ).first()
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        
        db.delete(product)
        db.commit()
        
        logger.info(f"Product deleted: {product.name}")
        return {"message": "Product deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting product: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete product"
        )
