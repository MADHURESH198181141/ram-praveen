"""
SQLAlchemy models for the retail billing system.
Defines all database tables and relationships.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Enum, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import enum
import uuid

from .db import Base


class Role(str, enum.Enum):
    """User roles in the system."""
    ADMIN = "admin"
    EMPLOYEE = "employee"


class PaymentMethod(str, enum.Enum):
    """Payment methods for bills."""
    CASH = "cash"
    UPI = "upi"
    CARD = "card"
    CHEQUE = "cheque"
    PENDING = "pending"


class CustomerType(str, enum.Enum):
    """Customer types."""
    NEW = "new"
    REGULAR = "regular"


# ============================================================================
# USER AND AUTHENTICATION
# ============================================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(Role), default=Role.EMPLOYEE, nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    store = relationship("Store", back_populates="users")
    bills = relationship("Bill", back_populates="employee")

    def __repr__(self):
        return f"<User(username={self.username}, role={self.role})>"


# ============================================================================
# STORE AND CONFIGURATION
# ============================================================================

class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="store", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="store", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="store", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="store", cascade="all, delete-orphan")
    settings = relationship("Settings", back_populates="store", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Store(name={self.name})>"


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, unique=True)
    low_stock_threshold = Column(Integer, default=10)
    tax_rate = Column(Float, default=5.0)
    currency = Column(String(3), default="INR")
    date_format = Column(String(20), default="DD/MM/YYYY")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    store = relationship("Store", back_populates="settings")

    def __repr__(self):
        return f"<Settings(store_id={self.store_id})>"


# ============================================================================
# PRODUCTS AND INVENTORY
# ============================================================================

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    store = relationship("Store", back_populates="categories")
    products = relationship("Product", back_populates="category", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Category(name={self.name})>"


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    hsn_code = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=True)
    unit = Column(String(50), default="Piece")
    gst_rate = Column(Float, default=5.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    category = relationship("Category", back_populates="products")
    store = relationship("Store", back_populates="products")
    inventory = relationship("Inventory", back_populates="product", uselist=False, cascade="all, delete-orphan")
    bill_items = relationship("BillItem", back_populates="product")

    def __repr__(self):
        return f"<Product(name={self.name}, price={self.price})>"


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, unique=True)
    quantity = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="inventory")

    def __repr__(self):
        return f"<Inventory(product_id={self.product_id}, quantity={self.quantity})>"


# ============================================================================
# CUSTOMERS AND BILLING
# ============================================================================

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    mobile_number = Column(String(20), nullable=True, index=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    customer_type = Column(Enum(CustomerType), default=CustomerType.NEW)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    pending_amount = Column(Float, default=0.0)
    total_purchase = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    store = relationship("Store", back_populates="customers")
    bills = relationship("Bill", back_populates="customer")
    payments = relationship("Payment", back_populates="customer")

    def __repr__(self):
        return f"<Customer(name={self.name}, mobile={self.mobile_number})>"


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)
    bill_number = Column(String(50), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Bill amounts
    subtotal = Column(Float, default=0.0)
    total_tax = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    pending_amount = Column(Float, default=0.0)
    
    # Payment details
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.CASH)
    
    # Status
    is_synced = Column(Boolean, default=False)  # For offline-online sync
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="bills")
    employee = relationship("User", back_populates="bills")
    store = relationship("Store", back_populates="bills")
    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="bill")

    def __repr__(self):
        return f"<Bill(bill_number={self.bill_number}, total={self.total_amount})>"


class BillItem(Base):
    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    discount_percent = Column(Float, default=0.0)
    tax_percent = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bill = relationship("Bill", back_populates="items")
    product = relationship("Product", back_populates="bill_items")

    def __repr__(self):
        return f"<BillItem(bill_id={self.bill_id}, quantity={self.quantity})>"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    
    # Payment amounts
    cash_amount = Column(Float, default=0.0)
    upi_amount = Column(Float, default=0.0)
    card_amount = Column(Float, default=0.0)
    cheque_amount = Column(Float, default=0.0)
    
    total_paid = Column(Float, nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bill = relationship("Bill", back_populates="payments")
    customer = relationship("Customer", back_populates="payments")

    def __repr__(self):
        return f"<Payment(payment_id={self.payment_id}, amount={self.total_paid})>"


# ============================================================================
# REPORTS AND ANALYTICS
# ============================================================================

class DailySalesReport(Base):
    __tablename__ = "daily_sales_reports"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    report_date = Column(Date, nullable=False, index=True)
    total_bills = Column(Integer, default=0)
    total_amount = Column(Float, default=0.0)
    total_tax = Column(Float, default=0.0)
    total_discount = Column(Float, default=0.0)
    cash_sales = Column(Float, default=0.0)
    upi_sales = Column(Float, default=0.0)
    card_sales = Column(Float, default=0.0)
    pending_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DailySalesReport(date={self.report_date}, amount={self.total_amount})>"


class EmployeeBillingActivity(Base):
    __tablename__ = "employee_billing_activity"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    activity_type = Column(String(50), default="bill_created")  # bill_created, bill_modified, bill_cancelled
    bill_total = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<EmployeeBillingActivity(employee_id={self.employee_id}, type={self.activity_type})>"


# ============================================================================
# SYNC AND OFFLINE SUPPORT
# ============================================================================

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(100), nullable=False)  # 'bill', 'payment', 'customer'
    entity_id = Column(String(36), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    status = Column(String(20), default="pending")  # pending, synced, failed
    error_message = Column(Text, nullable=True)
    attempted_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<SyncLog(entity={self.entity_type}, status={self.status})>"
