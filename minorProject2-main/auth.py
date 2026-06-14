from flask import Blueprint, request, jsonify, url_for, redirect, session
from flask_login import login_user, logout_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection
from models import User
from authlib.integrations.flask_client import OAuth
import os
from dotenv import load_dotenv

#email imports
import smtplib
from email.mime.text import MIMEText
import random
from datetime import datetime, timedelta

load_dotenv()

auth_bp = Blueprint('auth', __name__)

# --- GOOGLE OAUTH SETUP ---
oauth = OAuth()

def setup_oauth(app):
    oauth.init_app(app)
    oauth.register(
        name='google',
        client_id=os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
        access_token_url='https://accounts.google.com/o/oauth2/token',
        access_token_params=None,
        jwks_uri='https://www.googleapis.com/oauth2/v3/certs',
        authorize_url='https://accounts.google.com/o/oauth2/auth',
        authorize_params=None,
        api_base_url='https://www.googleapis.com/oauth2/v1/',
        client_kwargs={'scope': 'openid email profile'},
    )

# --- SIGNUP ---
@auth_bp.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    # Hash the password
    hashed_pw = generate_password_hash(data['password'], method='pbkdf2:sha256')

    try:
        sql = "INSERT INTO users (first_name, last_name, email, username, password) VALUES (%s, %s, %s, %s, %s)"
        cursor.execute(sql, (data['first_name'], data['last_name'], data['email'], data['username'], hashed_pw))
        conn.commit()
        return jsonify({"success": True}), 201
    except Exception as e:
        return jsonify({"success": False, "message": "User already exists"}), 409
    finally:
        conn.close()

# --- CHECK EMAIL & USERNAME AVAILABILITY ---
@auth_bp.route('/api/check-email', methods=['POST'])
def check_email():
    email = request.json.get('email')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    exists = cursor.fetchone() is not None
    cursor.close()
    conn.close()

    if exists:
        return jsonify({"exists": True, "invalid_domain": False, "message": "Email already in use"})
    return jsonify({"exists": exists})

@auth_bp.route('/api/check-username', methods=['POST'])
def check_username():
    username = request.json.get('username')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
    exists = cursor.fetchone() is not None
    cursor.close()
    conn.close()
    return jsonify({"exists": exists})



# --- LOGIN ---
@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Check by Username OR Email
    cursor.execute("SELECT * FROM users WHERE email = %s OR username = %s", (data['id'], data['id']))
    user = cursor.fetchone()
    conn.close()
    
    if user and check_password_hash(user['password'], data['password']):

        user_obj = User(user['id'], user['first_name'], user['last_name'], user['username'], user['email'], user['plan_type'], user['picture'])
        login_user(user_obj)
        return jsonify({"success": True, "message": "Login Successful"}), 200
    
    return jsonify({"success": False, "message": "Invalid Credentials"}), 401


# --- GOOGLE OAUTH ROUTES ---
@auth_bp.route('/login/google')
def google_login():
    google = oauth.create_client('google')
    redirect_uri = url_for('auth.google_authorize', _external=True)
    return google.authorize_redirect(redirect_uri)

import random
import string

@auth_bp.route('/login/google/callback')
def google_authorize():
    google = oauth.create_client('google')
    token = google.authorize_access_token()
    user_info = google.get('userinfo').json()
    
    email = user_info['email']
    google_id = user_info['id']
    first_name = user_info['given_name']
    last_name = user_info['family_name']
    picture = user_info['picture']

    # Custom Username & Password Generation
    clean_name = "".join(first_name.split()).lower()
    random_digits = "".join(random.choices(string.digits, k=4))
    username = f"{clean_name}{random_digits}"
    password = generate_password_hash(username, method='pbkdf2:sha256')

    # Check/Create User in DB
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if not user:
        # Create new Google User
        cursor.execute("INSERT INTO users (first_name, last_name, username, password, email, google_id, picture, plan_type) VALUES (%s, %s, %s, %s, %s, %s, %s, 'free')", 
                       (first_name, last_name, username, password, email, google_id, picture))
        conn.commit()
        user_id = cursor.lastrowid
    else:
        user_id = user['id']
    
    conn.close()
    
    # Login the user
    user_obj = User(user_id, first_name, last_name, username, email, 'free', picture)
    login_user(user_obj)
    return redirect(url_for('main.index'))


# --- FORGOT PASSWORD (SEND OTP) ---
@auth_bp.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    email = request.json.get('email')
    otp = str(random.randint(100000, 999999))
    expiry = datetime.now() + timedelta(minutes=3)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()


    user_email = email
    app_name = "HealthAlly"

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        /* Google Fonts (Roboto) with fallbacks */
        @import url('https://fonts.googleapis.com/css2?family=Roboto-Regular:wght@400;700&display=swap');
        
        body {{
            font-family: 'Roboto-Regular', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            color: #202124;
        }}

        .container {{ 
            width: 100%; 
            max-width: 600px; 
            padding: 20px; 
        }}

        .header {{
            background-color: #4285F4; /* The exact Google Blue */
            height: 70px;
            padding-left: 30px;
            padding-top: 50px;
            display: flex;
            align-items: center;
            border-radius: 4px 4px 0 0;
        }}
        .header-text {{
            color: #ffffff;
            font-size: 24px;
            font-weight: 400;
            line-height: 70px; /* Vertically center text */
            margin: 0;
        }}
        .content {{
            padding: 24px 20px;
            font-size: 13px;
            line-height: 1.35;
            background-color: #f9f9f9;
            border: 1px solid #e0e0e0;
        }}
        .otp-code {{
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
            color: #202124;
            letter-spacing: 1px;
        }}
        .link {{
            color: #4285F4;
            text-decoration: none;
        }}
        .warning {{
            font-weight: bold;
        }}
        .footer {{
            padding: 0 20px 20px 20px;
            font-size: 10px;
            color: #5f6368; /* Google's muted grey */
        }}
        .footer-line {{
            border-top: 1px solid #e0e0e0;
            margin-bottom: 15px;
        }}
    </style>
</head>
<body>

    <div class="container">
        <div class="header">
            <div class="header-text">{app_name} Verification Code</div>
        </div>

        <div class="content">
            <p style="margin-top:0;">Dear {app_name} User,</p>
            
            <p>We received a request to access your {app_name} Account <a href="#" class="link">{user_email}</a> through your email address. Your {app_name} verification code is:</p>
            
            <div class="otp-code">{otp}</div>
            
            <p>If you did not request this code, it is possible that someone else is trying to access the {app_name} Account <a href="#" class="link">{user_email}</a>. <span class="warning">Do not forward or give this code to anyone.</span></p>
            
            <p>You received this message because this email address is listed as the recovery email for the {app_name} Account <a href="#" class="link">{user_email}</a>. If that is incorrect, please click <a href="#" class="link">here</a> to remove your email address from that account.</p>
            
            <p style="margin-top: 30px;">Sincerely yours,</p>
            <p>The {app_name} Accounts team</p>
        </div>

        <div class="footer">
            <div class="footer-line"></div>
            <p>This email can't receive replies. For more information, visit the <a href="#" class="link">{app_name} Help Center</a>.</p>
            <p>&copy; {app_name} Inc., 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA</p>
        </div>
        
    </div> 

</body>
</html>
"""
    
    if user:
        # Save OTP to DB
        cursor.execute("UPDATE users SET reset_code = %s, reset_expiry = %s WHERE id = %s", (otp, expiry, user['id']))
        conn.commit()
        
        # Send Email
        try:
            msg = MIMEText(html_content, 'html')
            msg['Subject'] = f"HealthAlly Verification Code"
            msg['From'] = os.getenv('MAIL_USERNAME')
            msg['To'] = email

            with smtplib.SMTP(os.getenv('MAIL_SERVER'), int(os.getenv('MAIL_PORT'))) as server:
                server.starttls()
                server.login(os.getenv('MAIL_USERNAME'), os.getenv('MAIL_PASSWORD'))
                server.send_message(msg)
                
            return jsonify({"success": True, "message": "Code sent!"})
        except Exception as e:
            print(f"SMTP Error: {e}")  # This will show the real error in your terminal
            return jsonify({"success": False, "message": str(e)}), 500
            
    conn.close()
    return jsonify({"success": False, "message": "Email not found"}), 404

# --- RESET PASSWORD (VERIFY & UPDATE) ---
@auth_bp.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    otp = data.get('otp')
    new_pass = data.get('password')
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Find user with matching, non-expired OTP
    cursor.execute("SELECT id FROM users WHERE reset_code = %s AND reset_expiry > NOW()", (otp,))
    user = cursor.fetchone()
    
    if user:
        cursor.execute("UPDATE users SET password = %s, reset_code = NULL, reset_expiry = NULL WHERE id = %s", (generate_password_hash(new_pass, method='pbkdf2:sha256'), user['id']))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Password updated!"})
    
    conn.close()
    return jsonify({"success": False, "message": "Invalid or Expired Code"}), 400