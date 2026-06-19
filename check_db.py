import sqlite3
import os

db_path = 'retail_billing.db'

if not os.path.exists(db_path):
    print(f"❌ Database file not found: {db_path}")
else:
    print(f"✅ Database file found: {db_path}")
    print(f"   Size: {os.path.getsize(db_path)} bytes\n")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    
    print("📊 Database Tables and Records:")
    print("=" * 60)
    
    if not tables:
        print("No tables found!")
    else:
        for table in tables:
            table_name = table[0]
            cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
            count = cursor.fetchone()[0]
            print(f"  • {table_name:<30} {count:>5} records")
    
    print("\n" + "=" * 60)
    print("\n📋 Detailed Data from Key Tables:")
    print("=" * 60)
    
    # Show users with schema
    print("\n👥 Users:")
    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        print("  Columns:", [col[1] for col in columns])
        
        cursor.execute("SELECT * FROM users LIMIT 5")
        users = cursor.fetchall()
        for user in users:
            print(f"  {user}")
    except Exception as e:
        print(f"  Error: {e}")
    
    # Show stores with schema
    print("\n🏪 Stores:")
    try:
        cursor.execute("PRAGMA table_info(stores)")
        columns = cursor.fetchall()
        print("  Columns:", [col[1] for col in columns])
        
        cursor.execute("SELECT * FROM stores LIMIT 5")
        stores = cursor.fetchall()
        for store in stores:
            print(f"  {store}")
    except Exception as e:
        print(f"  Error: {e}")
    
    # Show categories
    print("\n📂 Categories:")
    try:
        cursor.execute("PRAGMA table_info(categories)")
        columns = cursor.fetchall()
        print("  Columns:", [col[1] for col in columns])
        
        cursor.execute("SELECT * FROM categories LIMIT 5")
        categories = cursor.fetchall()
        for cat in categories:
            print(f"  {cat}")
    except Exception as e:
        print(f"  Error: {e}")
    
    # Show products
    print("\n📦 Products:")
    try:
        cursor.execute("PRAGMA table_info(products)")
        columns = cursor.fetchall()
        print("  Columns:", [col[1] for col in columns])
        
        cursor.execute("SELECT * FROM products LIMIT 5")
        products = cursor.fetchall()
        if products:
            for product in products:
                print(f"  {product}")
        else:
            print("  No products found")
    except Exception as e:
        print(f"  Error: {e}")
    
    # Show customers
    print("\n👤 Customers:")
    try:
        cursor.execute("PRAGMA table_info(customers)")
        columns = cursor.fetchall()
        print("  Columns:", [col[1] for col in columns])
        
        cursor.execute("SELECT * FROM customers LIMIT 5")
        customers = cursor.fetchall()
        if customers:
            for cust in customers:
                print(f"  {cust}")
        else:
            print("  No customers found")
    except Exception as e:
        print(f"  Error: {e}")
    
    conn.close()
    print("\n" + "=" * 60)
    print("✅ Database check complete!")
