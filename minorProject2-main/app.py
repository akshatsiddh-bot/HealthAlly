from flask import Flask
from flask_login import LoginManager
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Import our custom modules
from models import init_login_manager
from auth import auth_bp, setup_oauth
from routes import main_bp

load_dotenv()

app = Flask(__name__)

CORS(app)
app.secret_key = os.getenv('SECRET_KEY')

# Initialize Login Manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'main.index'  # Redirect to index if not logged in

# Connect the components
init_login_manager(login_manager)
setup_oauth(app) # Initialize Google OAuth

# Register Blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(main_bp)

# Run the app
if __name__ == '__main__':
    # SSL context is often needed for Google OAuth locally, but simple HTTP works for localhost testing usually
    app.run(debug=True, port=5000)