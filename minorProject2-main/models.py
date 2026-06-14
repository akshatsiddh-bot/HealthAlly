from flask_login import UserMixin, current_user
from database import get_db_connection
import mysql.connector

class User(UserMixin):
    def __init__(self, id, first_name, last_name, username, email, plan_type, profile_image=None, total_prompts=0, theme='light'):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name 
        self.username = username
        self.email = email
        self.plan_type = plan_type
        self.profile_image = profile_image
        self.total_prompts = total_prompts
        self.theme = theme

def init_login_manager(login_manager):
    @login_manager.user_loader
    def load_user(user_id):
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user_data:
            return User(
                id=user_data['id'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                username=user_data['username'],
                email=user_data['email'],
                plan_type=user_data['plan_type'],
                profile_image=user_data['picture'],
                total_prompts=user_data['total_prompts']
            )
        return None

def create_new_chat(user_id, title="New Chat"):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO chats (user_id, title) VALUES (%s, %s)", (user_id, title))
    chat_id = cursor.lastrowid
    conn.commit()
    cursor.close()
    conn.close()
    return chat_id

def get_user_chats(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM chats WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
    chats = cursor.fetchall()
    cursor.close()
    conn.close()
    return chats

def get_chat_history(chat_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT role, content 
        FROM messages 
        WHERE chat_id = %s 
        ORDER BY created_at ASC
    """
    
    cursor.execute(query, (chat_id,))
    messages = cursor.fetchall()
    
    cursor.close()
    conn.close()
    return messages

def save_message(chat_id, role, content):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "INSERT INTO messages (chat_id, role, content) VALUES (%s, %s, %s)"
    cursor.execute(query, (chat_id, role, content))
    conn.commit()
    cursor.close()
    conn.close()

def delete_chat(chat_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chats WHERE chat_id = %s", (chat_id,))
    conn.commit()
    conn.close()

def update_chat_title(chat_id, new_title):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE chats SET title = %s WHERE chat_id = %s", (new_title, chat_id))
    conn.commit()
    conn.close()

def get_chat_message_count(chat_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM messages WHERE chat_id = %s", (chat_id,))
    count = cursor.fetchone()[0]
    conn.close()
    return count

def updateProfile(data, modal_type):
    # 1. Start connection
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        if modal_type == 'renameModal':
            # FIX: Use COMMA (,) not AND
            sql = "UPDATE users SET first_name = %s, last_name = %s WHERE id = %s"
            
            # Validation: Ensure keys exist
            if not data.get('first_name') or not data.get('last_name'):
                raise ValueError("Name fields cannot be empty")
                
            cursor.execute(sql, (data['first_name'], data['last_name'], current_user.id))

        elif modal_type == 'usernameModal':
            sql = "UPDATE users SET username = %s WHERE id = %s"
            
            if not data.get('username'):
                raise ValueError("Username cannot be empty")

            cursor.execute(sql, (data['username'], current_user.id))
        
        else:
            raise ValueError("Invalid operation type")

        # 2. COMMIT the changes (Crucial!)
        conn.commit()

    except mysql.connector.IntegrityError:
        # This specifically catches "Duplicate entry" errors (e.g. username taken)
        conn.rollback()
        raise ValueError("That username is already taken.")
        
    except Exception as e:
        # Rollback any changes if general error occurs
        conn.rollback()
        print(f"Database Error: {e}") # Log it for yourself
        raise e # Re-raise it so the Route knows something went wrong

    finally:
        # 3. Always close the connection, even if it crashes
        cursor.close()
        conn.close()