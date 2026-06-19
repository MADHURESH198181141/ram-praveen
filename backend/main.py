"""
FastAPI backend application for retail billing system.
Entry point for the backend server.
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import event
import logging
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env.local'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import routers
from backend.auth.routes import router as auth_router
from backend.products.routes import router as products_router
from backend.customers.routes import router as customers_router
from backend.billing.routes import router as billing_router
from backend.inventory import router as inventory_router
from backend.payments import router as payments_router
from backend.reports import router as reports_router
from backend.sync import router as sync_router
from backend.database.db import init_db, check_db_connection, Base, get_engine


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="Smart Billing Backend",
        version="1.0.0",
        description="Professional retail billing system backend"
    )

    # CORS middleware
    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(auth_router)
    app.include_router(products_router)
    app.include_router(customers_router)
    app.include_router(billing_router)
    app.include_router(inventory_router)
    app.include_router(payments_router)
    app.include_router(reports_router)
    app.include_router(sync_router)

    # Health check endpoint
    @app.get("/health")
    async def health():
        """Health check endpoint."""
        db_status = check_db_connection()
        return {
            "status": "ok",
            "database": "connected" if db_status else "disconnected",
            "version": "1.0.0"
        }

    # Root endpoint
    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "name": "Smart Billing Backend",
            "version": "1.0.0",
            "docs": "/docs"
        }

    # Startup event
    @app.on_event("startup")
    async def startup_event():
        """Initialize database on startup."""
        try:
            logger.info("Initializing database...")
            init_db()
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")

    # Shutdown event
    @app.on_event("shutdown")
    async def shutdown_event():
        """Cleanup on shutdown."""
        logger.info("Shutting down...")

    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("ENVIRONMENT") == "development"
    )

