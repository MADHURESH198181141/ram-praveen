"""
Database initialization script.
Creates tables, indexes, and seeds initial data.
Run this after setting up the database connection.
"""

import logging
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.db import init_db, get_db, SessionLocal, engine, Base
from database.models import (
    User, Store, Settings, Category, Role
)
from auth.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_database():
    """Initialize database with tables."""
    try:
        logger.info("Creating database tables...")
        init_db()
        logger.info("✓ Database tables created successfully")
    except Exception as e:
        logger.error(f"✗ Failed to create tables: {e}")
        raise


def seed_initial_data():
    """Seed database with initial data."""
    db = SessionLocal()
    try:
        # Check if store already exists
        existing_store = db.query(Store).first()
        if existing_store:
            logger.info("Database already seeded, skipping...")
            return

        logger.info("Seeding initial data...")

        # Create default store
        store = Store(
            name="My Store",
            address="Store Address",
            phone="+91-xxxx-xxxx-xxxx",
            email="store@example.com"
        )
        db.add(store)
        db.flush()

        # Create settings for store
        settings = Settings(
            store_id=store.id,
            low_stock_threshold=10,
            tax_rate=5.0,
            currency="INR"
        )
        db.add(settings)
        db.flush()

        # Create default categories
        categories_data = [
            {"name": "Groceries", "description": "Grocery items"},
            {"name": "Beverages", "description": "Drinks and beverages"},
            {"name": "Dairy", "description": "Milk and dairy products"},
            {"name": "Bakery", "description": "Bread and bakery items"},
            {"name": "Snacks", "description": "Snacks and packed items"},
        ]

        for cat_data in categories_data:
            category = Category(
                name=cat_data["name"],
                description=cat_data["description"],
                store_id=store.id
            )
            db.add(category)

        # Create default admin user
        admin_user = User(
            username="admin",
            email="admin@store.com",
            password_hash=get_password_hash("admin123"),
            role=Role.ADMIN,
            store_id=store.id,
            is_active=True
        )
        db.add(admin_user)

        # Create default employee user
        employee_user = User(
            username="employee",
            email="employee@store.com",
            password_hash=get_password_hash("employee123"),
            role=Role.EMPLOYEE,
            store_id=store.id,
            is_active=True
        )
        db.add(employee_user)

        db.commit()
        logger.info("✓ Initial data seeded successfully")
        logger.info("")
        logger.info("Default Credentials:")
        logger.info("  Admin - username: admin, password: admin123")
        logger.info("  Employee - username: employee, password: employee123")
        logger.info("")

    except Exception as e:
        logger.error(f"✗ Failed to seed data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    """Run database initialization."""
    try:
        logger.info("=" * 60)
        logger.info("Retail Billing Buddy - Database Initialization")
        logger.info("=" * 60)

        # Initialize database
        init_database()

        # Seed initial data
        seed_initial_data()

        logger.info("=" * 60)
        logger.info("✓ Database initialization completed successfully!")
        logger.info("=" * 60)

    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"✗ Database initialization failed: {e}")
        logger.error("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
