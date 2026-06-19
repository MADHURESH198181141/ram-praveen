import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL')
print(f"Testing Supabase Connection...")
print(f"Database URL: {DATABASE_URL[:50]}...\n")

try:
    from sqlalchemy import create_engine, text
    
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    
    print("🔄 Attempting connection...")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("✅ Connection successful!")
        
        # Get database info
        result = conn.execute(text("SELECT version()"))
        version = result.fetchone()[0]
        print(f"✅ PostgreSQL Version: {version[:60]}...\n")
        
        # Check tables
        result = conn.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema='public'
        """))
        tables = result.fetchall()
        print(f"✅ Tables in database: {len(tables)}")
        if tables:
            for table in tables[:10]:
                print(f"   • {table[0]}")
        
except Exception as e:
    print(f"❌ Connection failed!")
    print(f"Error: {str(e)}")
    sys.exit(1)

print("\n✅ Database connection verified!")
