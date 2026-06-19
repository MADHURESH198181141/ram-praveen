from database.db import engine

try:
    connection = engine.connect()
    print("Database Connected Successfully")
except Exception as e:
    print("Connection Failed")
    print(e)