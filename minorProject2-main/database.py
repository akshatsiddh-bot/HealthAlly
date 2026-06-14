import mysql.connector
import os
from dotenv import load_dotenv
load_dotenv()

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

def update_user_avatar_in_db(user_id, image_url):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        query = "UPDATE users SET picture = %s WHERE id = %s"
        cursor.execute(query, (image_url, user_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error updating avatar: {e}")
        return False
    finally:
        # close cursor if your setup requires it
        cursor.close()
        conn.close()
        pass

def update_user_theme_in_db(user_id, theme):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        query = "UPDATE users SET theme = %s WHERE id = %s"
        cursor.execute(query, (theme, user_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error updating theme: {e}")
        return False