import sqlite3
import os

def get_db_connection():
    # Create database directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    conn = sqlite3.connect('data/attendance.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    from models import init_db
    init_db()