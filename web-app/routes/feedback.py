from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
import os
import json
from datetime import datetime
from functools import wraps
import hashlib

# Create a Blueprint for feedback routes
feedback_bp = Blueprint('feedback', __name__)

# File to store feedback data (in a real app, this would be a database)
FEEDBACK_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'feedback.json')

# Admin password for the feedback dashboard (set FEEDBACK_ADMIN_PASSWORD in .env)
PASSWORD = os.getenv("FEEDBACK_ADMIN_PASSWORD")

# Ensure the data directory exists
os.makedirs(os.path.dirname(FEEDBACK_FILE), exist_ok=True)

# Initialize feedback file if it doesn't exist
if not os.path.exists(FEEDBACK_FILE):
    with open(FEEDBACK_FILE, 'w') as f:
        json.dump([], f)

# Helper function to read feedback data
def get_feedback_data():
    try:
        with open(FEEDBACK_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []

# Helper function to save feedback data
def save_feedback_data(data):
    with open(FEEDBACK_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Helper function to verify admin password
def verify_admin_password(password):
    # Direct string comparison instead of hash comparison
    return bool(PASSWORD) and password == PASSWORD

# Decorator for admin-only routes
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        admin_password = request.args.get('password')
        if not admin_password or not verify_admin_password(admin_password):
            return redirect(url_for('feedback.admin_login'))
        return f(*args, **kwargs)
    return decorated_function

# Feedback survey page
@feedback_bp.route('/feedback')
def feedback_survey():
    return render_template('feedback.html')

# Admin login page (redirects to admin dashboard if password is correct)
@feedback_bp.route('/feedback-admin')
def admin_login():
    return render_template('feedback-admin.html')

# API endpoint to submit feedback
@feedback_bp.route('/api/submit-feedback', methods=['POST'])
def submit_feedback():
    try:
        # Get the feedback data from the request
        feedback_data = request.json
        
        # Add a unique ID and ensure timestamp exists
        feedback_data['id'] = str(datetime.now().timestamp())
        if 'timestamp' not in feedback_data:
            feedback_data['timestamp'] = datetime.now().isoformat()
        
        # Load existing feedback
        all_feedback = get_feedback_data()
        
        # Add the new feedback
        all_feedback.append(feedback_data)
        
        # Save the updated feedback data
        save_feedback_data(all_feedback)
        
        return jsonify({'success': True, 'message': 'Feedback submitted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API endpoint to verify admin password
@feedback_bp.route('/api/verify-admin', methods=['POST'])
def verify_admin():
    try:
        data = request.json
        password = data.get('password', '')
        
        if verify_admin_password(password):
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Invalid password'}), 401
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API endpoint to get all feedback (admin only)
@feedback_bp.route('/api/get-feedback', methods=['GET'])
@admin_required
def get_all_feedback():
    try:
        all_feedback = get_feedback_data()
        return jsonify(all_feedback)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500 