from flask import Blueprint, render_template, redirect, url_for,jsonify, request
from flask_login import login_required, current_user, logout_user
import models
import gemini_service
import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url
from dotenv import load_dotenv
import os
from database import update_user_avatar_in_db
from database import update_user_theme_in_db

load_dotenv()

# Configuration       
cloudinary.config( 
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'), 
    api_key = os.getenv('CLOUDINARY_API_KEY'), 
    api_secret = os.getenv('CLOUDINARY_SECRET_KEY'), 
    secure=True
)

main_bp = Blueprint('main', __name__)


@main_bp.route('/update_theme', methods=['POST'])
@login_required
def update_theme():
    data = request.get_json() # Get data sent from JS
    new_theme = data.get('theme')
    
    if new_theme not in ['light', 'dark']:
        return jsonify({'error': 'Invalid theme'}), 400
        
    success = update_user_theme_in_db(current_user.id, new_theme)
    
    if success:
        current_user.theme = new_theme # Update session immediately
        return jsonify({'message': 'Theme updated'})
    
    return jsonify({'error': 'Database error'}), 500


# 2. INDEX / DASHBOARD (Protected)
# Users must be logged in to see their main dashboard
@main_bp.route('/')
@main_bp.route('/index')
def index():# Optional: If already logged in, send them straight to dashboard
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return render_template('index.html')

@main_bp.route('/services')
def services():
    return render_template('services.html')

@main_bp.route('/pricing')
def pricing():
    return render_template('pricing.html')

@main_bp.route('/login')
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return render_template('login.html')

@main_bp.route('/logout', methods=['GET', 'POST'])
@login_required
def logout():
    logout_user() # Clears the user session
    return redirect(url_for('main.index'))


# --- PROTECTED ROUTES ---
@main_bp.route('/dashboard')
@login_required
def dashboard():
    # Pass the user to the template
    return render_template('dashboard.html', user=current_user)

@main_bp.route('/account')
@login_required
def account():
    # Pass the user to the template
    return render_template('account.html', user=current_user)


@main_bp.route('/update_profile_pic', methods=['POST'])
@login_required
def update_profile_pic():
    print("--- 1. Route Hit ---") # check terminal for this
    
    if 'avatar' not in request.files:
        print("--- Error: No avatar in request.files ---")
        return jsonify({'error': 'No file part'}), 400

    file = request.files['avatar']
    print(f"--- 2. File received: {file.filename} ---")

    try:
        # Step A: Cloudinary
        print("--- 3. Attempting Cloudinary Upload... ---")
        upload_result = cloudinary.uploader.upload(
            file, 
            folder="user_profiles",
            public_id=f"user_{current_user.id}", 
            overwrite=True
        )
        print("--- 4. Cloudinary Success! URL: ", upload_result['secure_url'])
        
        image_url = upload_result['secure_url']

        # Step B: Database
        print("--- 5. Attempting DB Update... ---")
        # Ensure you are passing the correct arguments
        success = update_user_avatar_in_db(current_user.id, image_url)
        
        if success:
            print("--- 6. DB Update Success! ---")
            current_user.profile_image = image_url 
            return jsonify({'message': 'Success', 'url': image_url}), 200
        else:
            print("--- Error: DB Update returned False ---")
            return jsonify({'error': 'Database Error'}), 500

    except Exception as e:
        # THIS IS THE KEY: It will print the actual error to your terminal
        print(f"!!! CRASH ERROR !!!: {str(e)}")
        import traceback
        traceback.print_exc() # Prints the full error log
        return jsonify({'error': str(e)}), 500

# API: Get list of chats for the sidebar
@main_bp.route('/api/get_chats', methods=['GET'])
@login_required
def get_chats():
    chats = models.get_user_chats(current_user.id)
    return jsonify(chats)

# API: Create a new chat session
@main_bp.route('/api/new_chat', methods=['POST'])
@login_required
def create_chat_route():
    chat_id = models.create_new_chat(current_user.id)
    return jsonify({"chat_id": chat_id})

# API: Load messages for a specific chat
@main_bp.route('/api/get_messages/<int:chat_id>', methods=['GET'])
@login_required
def get_messages_route(chat_id):
    # Security: Ensure this chat belongs to the current user (implement check in real app)
    messages = models.get_chat_history(chat_id)
    return jsonify(messages)

# API: Send message to AI
@main_bp.route('/api/send_message', methods=['POST'])
@login_required
def send_message_route():
    data = request.json
    chat_id = data.get('chat_id')
    message = data.get('message')
    
    if not chat_id or not message:
        return jsonify({"error": "Missing data"}), 400
    
    try:
        reply = gemini_service.generate_response(chat_id, message)
        return jsonify({"reply": reply})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "AI Service Error"}), 500
    
@main_bp.route('/api/delete_chat/<int:chat_id>', methods=['DELETE'])
@login_required
def delete_chat_route(chat_id):
    models.delete_chat(chat_id)
    return jsonify({"status": "success"})

@main_bp.route('/api/rename_chat', methods=['POST'])
@login_required
def rename_chat_route():
    data = request.json
    models.update_chat_title(data['chat_id'], data['title'])
    return jsonify({"status": "success"})

@main_bp.route('/api/generate_title', methods=['POST'])
@login_required
def generate_title_route():
    data = request.json
    chat_id = data['chat_id']
    user_message = data['message_content']
    
    # Simple heuristic: Use first 30 chars or ask LLM (Here we use simple truncation for speed)
    # Ideally, you send a separate prompt to Groq: "Summarize this in 3 words: {user_message}"
    # 1. Truncate if necessary
    temp_title = user_message[:30] + "..." if len(user_message) > 30 else user_message

    # 2. Capitalize the first letter only
    new_title = temp_title[0].upper() + temp_title[1:] if temp_title else temp_title
    
    models.update_chat_title(chat_id, new_title)
    return jsonify({"title": new_title})

@main_bp.route('/update-profile', methods=['POST'])
@login_required
def update_profile():
    data = request.get_json()
    
    # Extract modal type safely
    modal_type = data.get('modal') 

    try:
        # Call the logic function
        models.updateProfile(data, modal_type)
        return jsonify({'success': True, 'message': 'Profile updated successfully'})

    except ValueError as e:
        # Catch known errors (empty fields, duplicates)
        return jsonify({'success': False, 'message': str(e)}), 400

    except Exception as e:
        # Catch unexpected server crashes
        return jsonify({'success': False, 'message': 'An internal server error occurred'}), 500