import os
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, g, send_from_directory, make_response
from flask_cors import CORS
import mysql.connector
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
import stripe 
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
from datetime import datetime, timezone 
from database_config import get_db_config
from db import Database
import secrets
import logging
import re
import PyPDF2
from pptx import Presentation
import io
import qrcode
import requests

# Load environment variables from .env file (override=True ensures .env takes precedence)
load_dotenv(override=True)
app = Flask(__name__)

CORS(app,
     supports_credentials=True,
     origins=[
         # Allow any Panopto EU subdomain, e.g. https://brunel.cloud.panopto.eu
         re.compile(r"^https:\/\/([a-z0-9-]+\.)*panopto\.eu$"),
         # Allow any Panopto US subdomain, e.g. https://{org}.panopto.com or https://{org}.cloud.panopto.com
         re.compile(r"^https:\/\/([a-z0-9-]+\.)*panopto\.com$"),
         "chrome-extension://*",
         "http://localhost:8080",
         "http://127.0.0.1:8080"
         "https://study-cap.com",
         "https://study-cap.com"
     ],
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "OPTIONS"]
)

# Configure session settings
app.secret_key = os.getenv('SECRET_KEY') or os.urandom(32)
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['PERMANENT_SESSION_LIFETIME'] = 604800  # 7 days in seconds

# Expose the (optional) PostHog project key to all templates
@app.context_processor
def inject_analytics_keys():
    return {'posthog_key': os.getenv('POSTHOG_API_KEY', '')}

# Import feedback routes
from routes.feedback import feedback_bp

# Register blueprints
app.register_blueprint(feedback_bp)

# Configure Google OAuth
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params={
        'prompt': 'select_account',  # This forces the account selector to appear
        'access_type': 'offline'
    },
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    client_kwargs={'scope': 'email profile'},
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    jwks_uri='https://www.googleapis.com/oauth2/v3/certs'
)

def get_db():
    """Get the database connection for the current request."""
    if 'db' not in g:
        config = get_db_config()
        conn = mysql.connector.connect(**config)
        g.db = Database(conn)
    return g.db

def require_auth(f):
    """Decorator to require user authentication for routes."""
    def decorated_function(*args, **kwargs):
        if "username" not in session:
            return redirect("/login")
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def require_auth_api(f):
    """Decorator to require user authentication for API routes (returns JSON instead of redirect)."""
    def decorated_function(*args, **kwargs):
        if "username" not in session:
            return jsonify({"error": "Authentication required. Please log in again."}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def is_mobile_device():
    """Check if the current request is from a mobile device."""
    user_agent = request.headers.get('User-Agent', '').lower()
    mobile_signatures = [
        'mobi', 'android', 'iphone', 'ipad', 'ipod',
        'opera mini', 'iemobile', 'wpdesktop', 'blackberry', 'webos'
    ]
    return any(sig in user_agent for sig in mobile_signatures)

@require_auth
def create_payment_page(tier_name, price_id, tier_display_name):
    """Create a payment page for the specified tier."""
    username = session["username"]

    db = get_db()
    user = db.get_user_unverified(username)
    
    if user and user["Tier"].lower() == tier_name.lower():
        return render_template(
            "already_subscribed.html",
            message=f"You already have an active {tier_display_name.lower()} subscription."
        )

    customer_email = user["Email"]
    
    # Check if customer already exists
    existing_customers = stripe.Customer.list(email=customer_email, limit=1)
    
    if existing_customers.data:
        # Use existing customer
        customer_id = existing_customers.data[0].id
    else:
        # Create new customer
        customer = stripe.Customer.create(
            email=customer_email,
            name=username
        )
        customer_id = customer.id
    
    # Store the Stripe customer ID in your database
    db.update_stripe_customer_id(username, customer_id)
    
    stripe_session = stripe.checkout.Session.create(
        customer=customer_id,  # Use the customer ID
        payment_method_types=['card'],
        line_items=[{
            'price': price_id,
            'quantity': 1,
        }],
        mode='subscription',
        allow_promotion_codes=True,  # Enable promotional code field in checkout
        payment_method_collection='if_required',  # Skip payment collection if total is $0 (e.g., with 100% off coupon)
        success_url=url_for('thanksPage', _external=True) + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url=url_for(f'payPage{tier_display_name}', _external=True),
    )
    return render_template(
        'index.html',
        checkout_session_id=stripe_session['id'],
        checkout_public_key=os.getenv('STRIPE_PUBLIC_KEY')
    )

# Serve favicon from the local static assets
FAVICON_DIR = os.path.join(app.root_path, 'static', 'images')

@app.route('/favicon.ico')
@app.route('/favicon.png')
def favicon():
    response = make_response(send_from_directory(FAVICON_DIR, 'favicon.png', mimetype='image/png'))
    response.cache_control.max_age = 86400
    return response

@app.teardown_appcontext
def close_db(e=None):
    """Close the database connection at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        db.conn.close()

@app.route("/", methods = ["GET", "POST"])
def menuPage():
    if "username" not in session:
        return redirect("/home")

    if is_mobile_device():
        return redirect(url_for('mobile_landing', login_success='true'))

    return redirect(url_for('dashboard'))

@app.route("/post-login-test")
def post_login_test():
    """Preview the post-login experience without requiring authentication."""
    return render_template("post_login.html")
    
@app.route("/login", methods=["GET"])
def loginPage():
    ref_code = request.args.get('ref')
    if ref_code:
        session['referral_code'] = ref_code

    if "username" in session:
        return redirect(url_for("menuPage"))

    referral_code = ref_code or session.get('referral_code')
    return render_template("login.html", referral_code=referral_code)

# Email conversion tracking routes - these render a page with PostHog tracking before redirecting to /login
@app.route("/instant-email-sign-up-funnel", methods=["GET"])
def instant_email_funnel():
    """Track email conversion for instant email sign-up funnel"""
    path = "/instant-email-sign-up-funnel"
    return render_template("funnel_redirect.html", path=path)

@app.route("/1-day-email-sign-up-funnel", methods=["GET"])
def one_day_email_funnel():
    """Track email conversion for 1-day email sign-up funnel"""
    path = "/1-day-email-sign-up-funnel"
    return render_template("funnel_redirect.html", path=path)

@app.route("/3-days-email-sign-up-funnel", methods=["GET"])
def three_days_email_funnel():
    """Track email conversion for 3-days email sign-up funnel"""
    path = "/3-days-email-sign-up-funnel"
    return render_template("funnel_redirect.html", path=path)

@app.route("/1-week-email-sign-up-funnel", methods=["GET"])
def one_week_email_funnel():
    """Track email conversion for 1-week email sign-up funnel"""
    path = "/1-week-email-sign-up-funnel"
    return render_template("funnel_redirect.html", path=path)

@app.route("/2-weeks-email-sign-up-funnel", methods=["GET"])
def two_weeks_email_funnel():
    """Track email conversion for 2-weeks email sign-up funnel"""
    path = "/2-weeks-email-sign-up-funnel"
    return render_template("funnel_redirect.html", path=path)

@app.route('/login/google')
def google_login():
    # Generate a new state token for each request
    state = secrets.token_urlsafe(16)
    session['state'] = state
    
    # Capture referral code if present
    ref_code = request.args.get('ref')
    if ref_code:
        session['referral_code'] = ref_code

    # If user landed directly on the Google OAuth endpoint (e.g. shared link),
    # send them to the login page first so they see the login UI before continuing.
    if request.args.get('entry') != 'login':
        login_url = url_for('loginPage', ref=ref_code) if ref_code else url_for('loginPage')
        return redirect(login_url)
    
    redirect_uri = url_for('google_authorize', _external=True)
    return google.authorize_redirect(redirect_uri, state=state)

@app.route('/login/google/authorize')
def google_authorize():
    try:
        # Check if this is a legitimate request
        if request.headers.get('X-Appengine-Cron') or request.headers.get('X-Appengine-QueueName'):
            print("Ignoring automated request")
            return redirect(url_for('loginPage'))
            
        # Verify state matches
        if request.args.get('state') != session.get('state'):
            print("State mismatch detected")
            return redirect(url_for('loginPage'))
            
        token = google.authorize_access_token()
        if not token:
            print("No token received from Google")
            return redirect(url_for('loginPage'))
            
        resp = google.get('userinfo')
        if not resp.ok:
            print(f"Error getting user info: {resp.status_code} - {resp.text}")
            return redirect(url_for('loginPage'))
            
        user_info = resp.json()
        print(f"User info received: {user_info}")  # Debug log
        
        if 'email' not in user_info:
            print("No email in user info")
            return redirect(url_for('loginPage'))
        
        db = get_db()
        
        email = user_info['email']
        if not email:  # Check if email is None or empty
            print("No email in user info")
            return redirect(url_for('loginPage'))
            
        username = email.split('@')[0]  # Use email prefix as username
        
        # Check if user exists
        existing_user = db.get_user_unverified(username)
        if existing_user:
            session.permanent = True
            session["username"] = username
            # Redirect mobile users to mobile landing page after login
            if is_mobile_device():
                return redirect(url_for('mobile_landing', login_success='true'))
            return redirect(url_for("dashboard"))
        else:
            # Create new user
            try:
                # First verify the email doesn't exist
                if db.get_verified_email(email):
                    print("Email already exists")
                    return render_template("login.html", error="This email is already registered. Please try logging in directly.")
                
                # Get referral code from session if exists
                referred_by = session.pop('referral_code', None)
                
                # Register the new user with referral tracking
                db.register(username, email, referred_by)
                session.permanent = True
                session["username"] = username
                # Redirect mobile users to mobile landing page after login
                if is_mobile_device():
                    return redirect(url_for('mobile_landing', login_success='true'))
                return redirect(url_for("dashboard"))
            except Exception as e:
                print(f"Error creating user: {e}")
                return render_template("login.html", error="Failed to create user account. Please try again.")
    except Exception:
        logging.exception("Error in Google authorization")
        return render_template(
            "login.html",
            error="Failed to authenticate with Google. Please try again."
        )

@app.route("/api/check_access", methods=["GET"])
def check_access():
    if "username" in session:
        db = get_db()
        user = db.get_user_unverified(session["username"])

        if user:
            # Get lecture counts for PostHog tracking
            lectures_count = db.get_lectures_count(session["username"])
            lifetime_summaries_count = db.get_lifetime_summaries_count(session["username"])
            
            return jsonify({
                "access": True,
                "tier": user.get("Tier"),
                "username": session["username"],
                "email": user.get("Email"),
                "lectures_count": lectures_count,
                "lifetime_summaries_count": lifetime_summaries_count
            })
        else:
            return jsonify({
                "access": False,
                "error": "User not verified"
            }), 403
    else:
        return jsonify({
            "access": False,
            "error": "User not logged in"
        }), 401

@app.route("/api/check_daily_limit", methods=["GET"])
def check_daily_limit():
    # Handle health checks and other unauthenticated requests
    if "username" not in session:
        return jsonify({
            "limitReached": False,
            "remaining": 0,
            "tier": "Free"
        })
    
    try:
        db = get_db()
        
        # Run cleanup occasionally (1% chance on each request)
        import random
        if random.randint(1, 100) == 1:
            db.cleanup_old_summary_generations(days_to_keep=7)
        
        user = db.get_user_unverified(session["username"])
        
        if not user:
            return jsonify({
                "limitReached": False,
                "remaining": 0,
                "tier": "Free"
            })
        
        # Get count of summaries in last 24 hours
        summaries_last_24h = db.get_summaries_count_today(session["username"])
        
        # Set limits based on tier
        if user["Tier"].lower() == "free":
            limit = 3
        elif user["Tier"].lower() == "student":
            limit = 25
        elif user["Tier"].lower() == "premium":
            limit = 999  # Unlimited (high number)
        else:
            return jsonify({"error": "Invalid tier"}), 400
        
        remaining = max(0, limit - summaries_last_24h)
        
        return jsonify({
            "limitReached": summaries_last_24h >= limit,
            "remaining": remaining,
            "tier": user["Tier"]
        })
    except Exception as e:
        print(f"Error in check_daily_limit: {e}")
        return jsonify({
            "limitReached": False,
            "remaining": 0,
            "tier": "Free"
        })

@app.route("/api/lectures", methods=["POST"])
@require_auth_api
def add_lecture_api():
    if request.method == "OPTIONS":
        return "", 200

    db = get_db()
    user = db.get_user_unverified(session["username"])

    # Get JSON payload
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    # Extract required fields
    lecture_id = data.get("lecture_id")
    url = data.get("url")
    summary = data.get("summary")
    title = data.get("title")

    if not all([lecture_id, url, summary, title]):
        return jsonify({"error": "Missing required fields"}), 400

    # Add the lecture
    try: 
        result = db.add_lecture(session["username"], lecture_id, url, summary, title)
        db.add_summary_generation(session["username"], lecture_id)
        
        if result == True:
            return jsonify({"success": True, "message": "Lecture added successfully"})
        elif result == "duplicate":
            return jsonify({"error": "Lecture already exists"}), 409
        else:
            return jsonify({"error": "Failed to add lecture"}), 500
    except Exception as e:
        print(f"Error adding lecture: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/lectures/replace", methods=["POST"])
@require_auth_api
def replace_lecture_api():
    if request.method == "OPTIONS":
        return "", 200

    db = get_db()
    user = db.get_user_unverified(session["username"])

    # Get JSON payload
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    # Extract required fields
    lecture_id = data.get("lecture_id")
    url = data.get("url")
    summary = data.get("summary")
    title = data.get("title")

    if not all([lecture_id, url, summary, title]):
        return jsonify({"error": "Missing required fields"}), 400

    # Replace the lecture
    try: 
        result = db.replace_lecture(session["username"], lecture_id, url, summary, title)
        db.add_summary_generation(session["username"], lecture_id)
        
        if result == True:
            return jsonify({"success": True, "message": "Lecture replaced successfully"})
        else:
            return jsonify({"error": "Failed to replace lecture"}), 500
    except Exception as e:
        print(f"Error replacing lecture: {e}")
        return jsonify({"error": "Internal server error"}), 500

#RETRIEVES USER LECTURES
@app.route("/api/user/lectures", methods=["GET"])
@require_auth_api
def get_user_lectures():
    
    db = get_db()
    try:
        user = db.get_user_unverified(session["username"])
        # Allow free users to view their lectures
        #if user["Tier"].lower() == "free":
        #    return jsonify({"lectures": []})
        lectures = db.get_lectures(session["username"])
        return jsonify({"lectures": lectures})
    except Exception as e:
        print("Error fetching lectures:", e)
        return jsonify({"error": "Failed to fetch lectures"}), 500

@app.route("/pay-student", methods=["GET", "POST"])
def payPageStudent():
    return create_payment_page("student", "price_1SFa4GKku7qg2gXryOvNXKtK", "Student")

@app.route("/pay-premium", methods=["GET", "POST"])
def payPagePremium():
    return create_payment_page("premium", "price_1R9mbFQSIgAJ70WGECMeFs1a", "Premium")

@app.route("/thanks", methods=["GET", "POST"])
@require_auth
def thanksPage():
    username = session["username"]
    db = get_db()

    session_id = request.args.get("session_id")
    if not session_id:
        return redirect("/login")
    
    try: 
        stripe_session = stripe.checkout.Session.retrieve(
            session_id, 
            expand=["line_items", "subscription", "customer"]
        )
    except Exception as e:
        return redirect("/login")
    
    # SECURITY: Verify the Stripe customer email matches your logged-in user
    user = db.get_user_unverified(username)
    if not user:
        return redirect("/login")
    
    # Get customer email from Stripe (already expanded in session)
    stripe_customer_email = stripe_session.customer.email
    
    # Verify emails match
    if user["Email"].lower() != stripe_customer_email.lower():
        print(f"Security alert: Email mismatch - User: {user['Email']}, Stripe: {stripe_customer_email}")
        return redirect("/login")
    
    for item in stripe_session.line_items.data:
        product_id = item.price.product
        product_name = item.description

    if stripe_session['payment_status'] == 'paid':
        print("user has paid")
    
    subscription = stripe_session.subscription
    if subscription:
        current_period_start = subscription.current_period_start
        current_period_end = subscription.current_period_end
    
    # Convert Unix timestamps into timezone-aware datetime objects in UTC
    print(f"Stripe timestamps - Start: {current_period_start}, End: {current_period_end}")
    start_date = datetime.fromtimestamp(current_period_start, tz=timezone.utc)
    end_date = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
    print(f"Converted to UTC - Start: {start_date}, End: {end_date}")
    print(f"Start timezone: {start_date.tzinfo}, End timezone: {end_date.tzinfo}")

    row = db.get_verified_email_from_user(username)
    email = row["Email"]
    if product_name == "Student":
        db.update_tier_by_email(email, "Student")
    elif product_name == "Premium":
        db.update_tier_by_email(email, "Premium")

    db.update_dates(email, start_date, end_date)
    return render_template("thanks.html")
    
@app.route("/webhook", methods=["POST"])
def stripe_webhook():
    """Handle Stripe webhook events for subscription renewals"""
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')
    
    # Get webhook endpoint secret from environment
    endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        return "Invalid payload", 400
    except stripe.error.SignatureVerificationError as e:
        return "Invalid signature", 400
    
    
    # Handle the event
    if event['type'] == 'invoice.payment_succeeded':
        handle_subscription_renewal(event['data']['object'])
    elif event['type'] == 'customer.subscription.deleted':
        handle_subscription_cancelled(event['data']['object'])
    elif event['type'] == 'customer.subscription.trial_will_end':
        handle_trial_ending(event['data']['object'])
    elif event['type'] == 'invoice.payment_failed':
        handle_payment_failed(event['data']['object'])
    else:
        print(f"Unhandled event type: {event['type']}")
    return "OK", 200

def handle_subscription_renewal(invoice):
    """Handle successful subscription renewal payment"""
    try:
        # Get subscription details
        subscription = stripe.Subscription.retrieve(invoice['subscription'])
        customer_id = subscription['customer']
        
        # Get customer email
        customer = stripe.Customer.retrieve(customer_id)
        customer_email = customer['email']
        
        # Convert Stripe timestamps to UTC datetime objects
        current_period_start = datetime.fromtimestamp(
            subscription['current_period_start'], tz=timezone.utc
        )
        current_period_end = datetime.fromtimestamp(
            subscription['current_period_end'], tz=timezone.utc
        )
        
        # Update database with new subscription period
        db = get_db()
        
        # Get the subscription tier from the price
        price_id = subscription['items']['data'][0]['price']['id']
        tier = get_tier_from_price_id(price_id)
        
        if tier:
            # Update tier and dates
            db.update_tier_by_email(customer_email, tier)
            db.update_dates(customer_email, current_period_start, current_period_end)
            
    except Exception as e:
        print(f"Error handling subscription renewal: {e}")


def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    try:
        # Get customer details
        customer = stripe.Customer.retrieve(subscription['customer'])
        customer_id = customer['id']
        customer_email = customer['email']
        
        # Find user by Stripe customer ID first, then fallback to email
        db = get_db()
        
        # Try to find user by stripe_customer_id
        user_by_customer_id = db.get_user_by_stripe_customer_id(customer_id)
        
        if user_by_customer_id:
            username = user_by_customer_id['Username']
            db.update_tier_by_username(username, "Free")
            db.update_dates_by_username(username, None, None)
        else:
            # Fallback to email lookup
            db.update_tier_by_email(customer_email, "Free")
            db.update_dates(customer_email, None, None)
        
    except Exception as e:
        print(f"Error handling subscription cancellation: {e}")

def handle_trial_ending(subscription):
    """Handle when a trial is about to end"""
    try:
        # Get customer details
        customer = stripe.Customer.retrieve(subscription['customer'])
        customer_id = customer['id']
        customer_email = customer['email']
        
        # Find user by Stripe customer ID first, then fallback to email
        db = get_db()
        
        # Try to find user by stripe_customer_id
        user_by_customer_id = db.get_user_by_stripe_customer_id(customer_id)
        
        if user_by_customer_id:
            username = user_by_customer_id['Username']
            db.update_tier_by_username(username, "Free")
            db.update_dates_by_username(username, None, None)
        else:
            # Fallback to email lookup
            db.update_tier_by_email(customer_email, "Free")
            db.update_dates(customer_email, None, None)
        
    except Exception as e:
        print(f"Error handling trial ending: {e}")

def handle_payment_failed(invoice):
    """Handle when a payment fails (trial ended, no payment method, etc.)"""
    try:
        # Get subscription details
        subscription = stripe.Subscription.retrieve(invoice['subscription'])
        customer_id = subscription['customer']
        
        # Get customer email
        customer = stripe.Customer.retrieve(customer_id)
        customer_email = customer['email']
        
        # Find user by Stripe customer ID first, then fallback to email
        db = get_db()
        
        # Try to find user by stripe_customer_id
        user_by_customer_id = db.get_user_by_stripe_customer_id(customer_id)
        
        if user_by_customer_id:
            username = user_by_customer_id['Username']
            db.update_tier_by_username(username, "Free")
            db.update_dates_by_username(username, None, None)
        else:
            # Fallback to email lookup
            db.update_tier_by_email(customer_email, "Free")
            db.update_dates(customer_email, None, None)
        
    except Exception as e:
        print(f"Error handling payment failure: {e}")

def get_tier_from_price_id(price_id):
    """Map Stripe price ID to tier name"""
    price_mapping = {
        "price_1SFa4GKku7qg2gXryOvNXKtK": "Student",  # active student checkout price
        "price_1R9mbFQSIgAJ70WGECMeFs1a": "Premium"
    }
    return price_mapping.get(price_id)

@app.route("/upgrade", methods=["GET"])
def upgrade():
    """Show the upgrade page for free users or anyone wanting to see upgrade options"""
    return render_template("upgrade_message.html")

@app.route("/dashboard", methods=["GET"])
@require_auth
def dashboard():
    # Redirect mobile/iPad users to separate mobile dashboard for tracking purposes
    if is_mobile_device():
        return redirect(url_for('dashboard_mobile'))
    
    try:
        db = get_db()
        username = session["username"]
        user = db.get_user_unverified(username)
        #db.update_tier_by_username(username, "Free")
        if user is None:
            return redirect("/login")
        # Redirect Free tier users to the upgrade page
        #if user["Tier"].lower() == "free":
        #    return redirect("/upgrade")
        # Student and Premium tiers get access to dashboard
        return render_template("dashboard.html", tier=user["Tier"], username=username)
    except Exception as e:
        print(f"Dashboard error: {e}")
        return redirect("/login")

@app.route("/dashboard-mobile", methods=["GET"])
@require_auth
def dashboard_mobile():
    """Mobile version of dashboard - exact copy for tracking purposes.
    Mobile/iPad users are redirected here from /dashboard to separate
    analytics events from desktop users."""
    # Redirect desktop/laptop users back to the regular dashboard
    if not is_mobile_device():
        return redirect(url_for('dashboard'))
    
    try:
        db = get_db()
        username = session["username"]
        user = db.get_user_unverified(username)
        if user is None:
            return redirect("/login")
        # Renders the same dashboard template as desktop
        return render_template("dashboard.html", tier=user["Tier"], username=username)
    except Exception as e:
        print(f"Dashboard mobile error: {e}")
        return redirect("/login")

@app.route("/test-dashboard", methods=["GET"])
def test_dashboard():
    """Unauthenticated sandbox version of the dashboard for internal testing."""
    return render_template(
        "test-dashboard.html",
        tier="Test",
        username="test-user"
    )

@app.route("/lecture-viewer", methods=["GET"])
def lecture_viewer():
    return render_template("lecture_viewer.html")

@app.route("/api/lectures/update-title", methods=["POST"])
@require_auth_api
def update_lecture_title():

    data = request.get_json()
    if not data or "lecture_id" not in data or "title" not in data:
        return jsonify({"error": "Missing required fields"}), 400

    db = get_db()
    try:
        success = db.update_lecture_title(session["username"], data["lecture_id"], data["title"])
        if success:
            return jsonify({"success": True, "message": "Title updated successfully"})
        else:
            return jsonify({"error": "Lecture not found"}), 404
    except Exception as e:
        print("Error updating title:", e)
        return jsonify({"error": "Failed to update title"}), 500

@app.route("/api/lectures/delete", methods=["POST"])
@require_auth_api
def delete_lecture():

    data = request.get_json()
    if not data or "lecture_id" not in data:
        return jsonify({"error": "Missing lecture_id"}), 400

    db = get_db()
    try:
        success = db.delete_lecture(session["username"], data["lecture_id"])
        if success:
            return jsonify({"success": True, "message": "Lecture deleted successfully"})
        else:
            return jsonify({"error": "Lecture not found"}), 404
    except Exception as e:
        print("Error deleting lecture:", e)
        return jsonify({"error": "Failed to delete lecture"}), 500

@app.route("/api/lectures/update-summary", methods=["POST"])
@require_auth_api
def update_lecture_summary():
    """Update only the summary of a lecture"""
    data = request.get_json()
    if not data or "lecture_id" not in data or "summary" not in data:
        return jsonify({"error": "Missing required fields: lecture_id and summary"}), 400

    db = get_db()
    try:
        session_username = session.get("username")
        
        # Get the current lecture filtered by both ID and username to ensure ownership
        lecture = db.get_lecture_by_id_and_username(data["lecture_id"], session_username)
        if not lecture:
            # Lecture not found - either doesn't exist or doesn't belong to this user
            print(f"Update summary - Lecture ID: {data['lecture_id']}, Username: {session_username} - Not found or unauthorized")
            return jsonify({"error": "Lecture not found or unauthorized"}), 404
        
        # Update only the summary using replace_lecture (which handles updates)
        result = db.replace_lecture(
            session["username"],
            data["lecture_id"],
            lecture["URL"],
            data["summary"],
            lecture["Title"]
        )
        
        if result:
            return jsonify({"success": True, "message": "Summary updated successfully"})
        else:
            return jsonify({"error": "Failed to update summary"}), 500
    except KeyError as e:
        print(f"KeyError updating summary: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Invalid lecture data: {str(e)}"}), 500
    except Exception as e:
        print(f"Error updating summary: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to update summary: {str(e)}"}), 500

@app.route("/manage-subscriptions", methods=["GET"])
@require_auth
def manageSubscriptions():
    username = session["username"]

    db = get_db()
    user = db.get_user_unverified(username)
    if user is None:
        return "User not found", 404

    tier = user["Tier"]
    end_date = user["End_Date"]  # Pass raw date for display purposes only
    
    return render_template("manage_subscriptions.html", tier=tier, end_date=end_date)

@app.route("/create-portal-session", methods=["POST"])
@require_auth
def create_portal_session():
    username = session["username"]
    
    db = get_db()
    user = db.get_user_unverified(username)
    if not user:
        return redirect("/login")
    
    # Get customer ID from database (preferred) or fallback to email lookup
    customer_id = user.get("stripe_customer_id")
    customer_email = user["Email"]  # Define customer_email here so it's always available
    
    if not customer_id:
        # Fallback: find customer by email
        customers = stripe.Customer.list(email=customer_email, limit=1)
        
        if not customers.data:
            return jsonify({"error": "No Stripe customer found"}), 404
        
        customer_id = customers.data[0].id
        # Store the customer ID for future use
        db.update_stripe_customer_id(username, customer_id)
    
    try:
        # Create portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=url_for('manageSubscriptions', _external=True)
        )
        
        # Redirect directly to the portal
        return redirect(portal_session.url)
        
    except Exception as e:
        print(f"Error creating portal session: {e}")
        return jsonify({"error": str(e)}), 500




@app.route("/logout")
def logout():
    # Clear the user's session data
    session.pop('username', None)
    return redirect(url_for('loginPage'))
    

@app.route("/home", methods = ["GET"])
def home():
    return render_template("home.html")

@app.route("/get-studycap", methods = ["GET"])
def get_studycap():
    # Server-side mobile detection to ensure correct redirect on phones/tablets
    if is_mobile_device():
        return redirect(url_for('loginPage'))
    return render_template("get-studycap.html")

@app.route("/mobile-landing", methods=["GET"])
def mobile_landing():
    login_success = request.args.get('login_success', 'false')
    return render_template("mobile-landing.html", login_success=login_success)

@app.route("/pricing", methods = ["GET"])
def pricingPage():
    return render_template("pricing.html")

@app.route("/privacy-terms", methods = ["GET"])
def privacyTermsPage():
    return render_template("privacy-terms.html")

@app.route("/help", methods=["GET"])
def help_page():
    return render_template("help.html")

# Centralized prompts
SUMMARY_SYSTEM_PROMPT_BASE = "You are StudyCap, a dedicated and approachable chatbot assistant specializing in helping students understand lecture material. " + \
    "Your purpose is to provide an EXHAUSTIVE, COMPREHENSIVE, and COMPLETE summary of ALL lecture material provided. " + \
    "CRITICAL REQUIREMENT: Include ALL equations, formulas, and mathematical expressions - do not skip any mathematical content. " + \
    "EXHAUSTIVENESS REQUIREMENT: Your summary must be exhaustive and detailed. Include ALL concepts, examples, definitions, explanations, formulas, theorems, proofs, diagrams descriptions, and any other content mentioned in the source material. " + \
    "Do not summarize or condense - instead, expand and explain. If a concept is mentioned, explain it fully. If an example is given, include it. If a formula is shown, include it with context. " + \
    "Preserve ALL section headings and topic titles. Use '##' for main sections, '###' for subsections, and '####' for sub-subsections. " + \
    "Bullet points should start with '*'. " + \
    "MATH FORMATTING RULES (CRITICAL FOR RENDERING): " + \
    "For EVERY mathematical expression, equation, formula, symbol, or operator, you MUST use LaTeX delimiters. " + \
    "Use \\(...\\) for inline math (e.g., \\(x^2 + y^2 = r^2\\) or \\(E = mc^2\\)). " + \
    "Use \\[...\\] for display/block math on its own line (e.g., \\[\\int_0^1 x dx = \\frac{1}{2}\\]). " + \
    "IMPORTANT: In your output, write these delimiters with a SINGLE backslash: \\( and \\) for inline, \\[ and \\] for display. " + \
    "Examples: 'The equation \\(a^2 + b^2 = c^2\\) is fundamental.' or 'We have: \\[\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\\]' " + \
    "Do NOT use plain text for math symbols (no 'x squared', 'alpha', 'pi' in words). Always use LaTeX. " + \
    "Do NOT use single dollar signs ($) as they conflict with currency. " + \
    "If you see math in the source material, convert it to proper LaTeX format. " + \
    "Be comprehensive and detail-oriented - include all important technical details. " + \
    "IMPORTANT NOTE-TAKING STYLE: You must create summaries in the form of detailed study notes, going above and beyond to explain concepts thoroughly. " + \
    "Like a teacher would, break down complex ideas into simpler parts, provide clear examples, and explain the 'why' behind concepts. " + \
    "Your notes should be so clear that someone could understand the material even months later. " + \
    "When multiple sources are provided (e.g., audio captions AND PDF slides), you MUST exhaustively use content from BOTH sources, integrating them seamlessly. " + \
    "Do not use horizontal rules (---) or other separators between sections. Use only the specified heading levels (##, ###, ####) for organization."

SUMMARY_PDF_CONTEXT_ADDITION = " CRITICAL: You have been provided with BOTH audio captions AND lecture slides/notes from a PDF. These are EQUAL PRIMARY SOURCES. " + \
    "You MUST exhaustively use content from BOTH sources. Do not treat the PDF as supplementary - it contains essential information that must be fully integrated. " + \
    "Combine information from both sources: use the audio captions for spoken explanations and the PDF slides for visual content, formulas, diagrams, examples, and structured information. " + \
    "If the same concept appears in both sources, include the most complete version or combine details from both. " + \
    "If content appears in only one source, you must still include it. Your summary must be exhaustive of BOTH sources combined."

SUMMARY_PDF_ONLY_CONTEXT = " CONTEXT: You have been provided with lecture slides/notes from a PDF document. This PDF contains the PRIMARY source material for your summary. Create a comprehensive summary based solely on this PDF content."

# Common user prompt instructions for summaries (reused across all summary types)
SUMMARY_USER_INSTRUCTIONS = """CRITICAL INSTRUCTIONS FOR EXHAUSTIVE SUMMARY:
1. EXHAUSTIVENESS: Include EVERY equation, formula, mathematical expression, concept, example, definition, theorem, proof, diagram description, and piece of information found in the source material(s)
2. DETAIL LEVEL: Be exhaustive and detailed - do not summarize or condense. Expand on concepts, provide full explanations, include all examples, and explain the reasoning behind formulas and theorems
3. Preserve ALL section headings and topic titles using the specified markdown format
4. Do not omit ANY content - if it's in the source material, it should be in your summary
5. MATH FORMATTING: Format ALL math with LaTeX delimiters (use SINGLE backslash in your output):
   - Inline math: \\(expression\\) (e.g., \\(x^2\\), \\(\\alpha\\), \\(\\frac{{a}}{{b}}\\))
   - Display math: \\[expression\\] (e.g., \\[\\int_0^\\infty e^{{-x}} dx = 1\\])
   - NEVER use single dollar signs ($) - they conflict with currency
   - Write the delimiters exactly as shown: \\( and \\) for inline, \\[ and \\] for display
6. When multiple sources are provided, exhaustively integrate content from ALL sources - treat them as equal primary sources

"""

CHAT_SYSTEM_PROMPT = "You are a helpful assistant that answers questions based on the lecture summary provided and give concise short answers. When mentioning mathematical expressions, use LaTeX format: \\(...\\) for inline math and \\[...\\] for display math (use single backslash in your output)."

QUIZ_SYSTEM_PROMPT = "You are an educational quiz creator that generates high-quality multiple-choice questions based on educational content. For each question, provide 4 options (A, B, C, D) with exactly one correct answer. Format your response as valid JSON that can be parsed with JSON.parse(). Return exactly 5 questions. Format the JSON response as an array of objects, where each object has: 'question' (string), 'options' (array of 4 strings), 'correctAnswer' (string with just the letter A, B, C, or D), and 'explanation' (string explaining why the answer is correct). " + \
    "MATH FORMATTING RULES (CRITICAL FOR RENDERING): " + \
    "For EVERY mathematical expression, equation, formula, symbol, or operator in questions, options, or explanations, you MUST use LaTeX delimiters. " + \
    "Use \\(...\\) for inline math within text (e.g., \\(x^2\\), \\(\\alpha\\), \\(E = mc^2\\), \\(\\frac{a}{b}\\)). " + \
    "Use \\[...\\] for display/block math when the equation is prominent (e.g., \\[\\int_0^1 x dx = \\frac{1}{2}\\]). " + \
    "IMPORTANT: In your output, write these delimiters with a SINGLE backslash: \\( and \\) for inline, \\[ and \\] for display. " + \
    "Examples: Question: 'What is \\(x^2 + y^2\\)?' or Option: 'The value is \\(\\frac{n(n+1)}{2}\\)' or Explanation: 'We use \\[\\sum_{i=1}^{n} i\\]' " + \
    "Do NOT use plain text for math symbols (no 'x squared', 'alpha', 'pi' in words). Always use LaTeX. " + \
    "Do NOT use single dollar signs ($) as they conflict with currency. " + \
    "This is critical for proper math rendering in the quiz interface."

@app.route("/api/generate", methods=["POST"])
@require_auth_api
def generate_content():
    """Centralized endpoint for all OpenAI API calls"""
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400
        
        request_type = data.get("type")  # "summary", "chat", "quiz"
        if not request_type:
            return jsonify({"error": "Missing 'type' field"}), 400
        
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return jsonify({"error": "OpenAI API key not configured"}), 500
        
        # Model is determined server-side, not by client
        model = "gpt-4o-mini"
        messages = []
        
        if request_type == "summary":
            captions = data.get("captions", "")
            pdf_text = data.get("pdfText")
            
            # Determine if PDF-only or PDF + captions
            is_pdf_only = (not captions or captions.strip() == "") and pdf_text and pdf_text.strip()
            
            if is_pdf_only:
                system_prompt = SUMMARY_SYSTEM_PROMPT_BASE + SUMMARY_PDF_ONLY_CONTEXT
                user_prompt = SUMMARY_USER_INSTRUCTIONS + f"""LECTURE SLIDES/NOTES FROM PDF:
The following text was extracted from the PDF document. Create an EXHAUSTIVE and detailed summary based on this content:

{pdf_text}

IMPORTANT: This PDF is the PRIMARY source material. Create an exhaustive summary that includes ALL concepts, examples, formulas, definitions, theorems, proofs, diagrams, and explanations found in the PDF. 
- Do not summarize or condense - be detailed and exhaustive
- Include every formula, equation, and mathematical expression
- Include all examples and explanations
- Expand on concepts to provide full understanding
- Remember to convert ANY math expressions into proper LaTeX format using \\(...\\) for inline and \\[...\\] for display math (use single backslash in your output)"""
            elif pdf_text and pdf_text.strip():
                system_prompt = SUMMARY_SYSTEM_PROMPT_BASE + SUMMARY_PDF_CONTEXT_ADDITION
                user_prompt = SUMMARY_USER_INSTRUCTIONS + f"""You have been provided with TWO PRIMARY SOURCES for this lecture. You MUST exhaustively use content from BOTH sources:

SOURCE 1 - AUDIO CAPTIONS (Lecture Transcript):
The following text contains the spoken content from the lecture:

{captions}

SOURCE 2 - LECTURE SLIDES/NOTES (PDF):
The following text was extracted from the lecture slides or notes:

{pdf_text}

CRITICAL INSTRUCTIONS:
- These are EQUAL PRIMARY SOURCES - you must exhaustively include content from BOTH
- Integrate information from both sources seamlessly - combine spoken explanations from captions with visual/formula content from slides
- If the same concept appears in both, include the most complete version or merge details from both sources
- If content appears in only one source, you MUST still include it
- Include ALL formulas, equations, examples, definitions, diagrams, and explanations from BOTH sources
- Your summary must be exhaustive of the combined content from both sources
- Remember to convert ANY math expressions into proper LaTeX format using \\(...\\) for inline and \\[...\\] for display math (use single backslash in your output)
- Be detailed and exhaustive - do not summarize or condense. Expand on concepts and provide full explanations."""
            else:
                system_prompt = SUMMARY_SYSTEM_PROMPT_BASE
                user_prompt = SUMMARY_USER_INSTRUCTIONS + f"""LECTURE CAPTIONS (Audio Transcript):
The following text contains the spoken content from the lecture. Create an EXHAUSTIVE and detailed summary:

{captions}

IMPORTANT: Create an exhaustive summary that includes ALL concepts, examples, formulas, definitions, explanations, and information from the captions. Do not summarize or condense - be detailed and exhaustive. Include every formula, equation, and mathematical expression. Expand on concepts to provide full understanding."""
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
        elif request_type == "chat":
            summary_text = data.get("summaryText", "")
            user_question = data.get("userQuestion", "")
            
            messages = [
                {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": f"Lecture Summary:\n{summary_text}"},
                {"role": "user", "content": f"Question: {user_question}"}
            ]
            
        elif request_type == "quiz":
            summary_text = data.get("summaryText", "")
            avoid_repeating = data.get("avoidRepeating", False)
            
            system_prompt = QUIZ_SYSTEM_PROMPT
            if avoid_repeating:
                system_prompt += " Avoid repeating previous questions if possible."
            
            user_prompt = f"""Based on the following lecture summary, generate 5 multiple-choice quiz questions to test understanding of key concepts. Lecture Summary:\n{summary_text}\n\nIMPORTANT: Format ALL mathematical expressions using LaTeX delimiters: \\(...\\) for inline math and \\[...\\] for display math (use single backslash in your output). NEVER use single dollar signs ($)."""
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # Quiz requests use JSON response format
            response_format = {"type": "json_object"}
        else:
            return jsonify({"error": f"Invalid request type: {request_type}"}), 400
        
        # Make OpenAI API call
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "model": model,
            "messages": messages
        }
        
        if request_type == "quiz":
            payload["response_format"] = {"type": "json_object"}
        
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=120
        )
        
        if not response.ok:
            error_data = response.json() if response.content else {}
            return jsonify({
                "error": f"OpenAI API error: {error_data.get('error', {}).get('message', 'Unknown error')}"
            }), response.status_code
        
        result = response.json()
        
        if not result.get("choices") or not result["choices"][0] or not result["choices"][0].get("message"):
            return jsonify({"error": "Invalid response format from OpenAI API"}), 500
        
        return jsonify({
            "content": result["choices"][0]["message"]["content"]
        })
        
    except requests.exceptions.RequestException as e:
        print(f"Error calling OpenAI API: {e}")
        return jsonify({"error": f"Failed to call OpenAI API: {str(e)}"}), 500
    except Exception as e:
        print(f"Error in generate_content: {e}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

# YouTube search prompt for generating search queries
YOUTUBE_SEARCH_PROMPT = """Analyze the following lecture summary and extract the most important topics and concepts. 
Generate a concise YouTube search query (max 5-7 words) that would find educational videos explaining these core concepts.
Focus on: main subject, key formulas/theorems, primary topics.
Return ONLY the search query, nothing else. No quotes, no explanation.

Lecture Summary:
{summary}"""

@app.route('/api/youtube-test', methods=['GET'])
def youtube_test():
    """Test endpoint to verify YouTube API configuration (no auth required)"""
    youtube_api_key = os.getenv('YOUTUBE_API_KEY')
    
    result = {
        "api_key_set": youtube_api_key is not None and youtube_api_key != "",
        "api_key_is_placeholder": youtube_api_key == "YOUR_YOUTUBE_API_KEY_HERE" if youtube_api_key else False,
        "api_key_prefix": youtube_api_key[:10] + "..." if youtube_api_key and len(youtube_api_key) > 10 else "N/A",
        "api_key_length": len(youtube_api_key) if youtube_api_key else 0
    }
    
    print(f"[YouTube Test] API Key Status: {result}")
    
    if not youtube_api_key:
        result["message"] = "YOUTUBE_API_KEY is not set in environment variables"
        result["instructions"] = "Add YOUTUBE_API_KEY=your_api_key to your .env file"
    elif youtube_api_key == "YOUR_YOUTUBE_API_KEY_HERE":
        result["message"] = "YOUTUBE_API_KEY is still set to placeholder value"
        result["instructions"] = "Replace YOUR_YOUTUBE_API_KEY_HERE with your actual API key in .env"
    else:
        # Try a simple API call to verify the key works
        try:
            test_url = f"https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key={youtube_api_key}"
            response = requests.get(test_url, timeout=5)
            if response.ok:
                result["message"] = "YouTube API key is valid and working!"
                result["api_working"] = True
            else:
                error_data = response.json()
                error_msg = error_data.get('error', {}).get('message', 'Unknown error')
                result["message"] = f"YouTube API error: {error_msg}"
                result["api_working"] = False
                result["error_details"] = error_data
        except Exception as e:
            result["message"] = f"Error testing YouTube API: {str(e)}"
            result["api_working"] = False
    
    return jsonify(result)


@app.route('/api/youtube-search', methods=['POST'])
@require_auth_api
def youtube_search():
    """Search YouTube for videos related to the lecture summary"""
    try:
        print("[YouTube Search] Starting YouTube search request...")
        
        data = request.get_json()
        if not data:
            print("[YouTube Search] ERROR: No JSON payload provided")
            return jsonify({"error": "No JSON payload provided"}), 400
        
        summary_text = data.get("summaryText", "")
        lecture_title = data.get("lectureTitle", "")
        
        print(f"[YouTube Search] Received - Title: '{lecture_title[:50] if lecture_title else 'None'}...', Summary length: {len(summary_text)} chars")
        
        if not summary_text and not lecture_title:
            print("[YouTube Search] ERROR: No summary text or lecture title provided")
            return jsonify({"error": "Summary text or lecture title required"}), 400
        
        # Get YouTube API key from environment
        youtube_api_key = os.getenv('YOUTUBE_API_KEY')
        if not youtube_api_key:
            print("[YouTube Search] ERROR: YOUTUBE_API_KEY environment variable not set!")
            return jsonify({"error": "YouTube API not configured. Please add YOUTUBE_API_KEY to your environment variables."}), 500
        
        if youtube_api_key == "YOUR_YOUTUBE_API_KEY_HERE":
            print("[YouTube Search] ERROR: YOUTUBE_API_KEY is still set to placeholder value!")
            return jsonify({"error": "YouTube API key not configured. Please replace the placeholder with your actual API key."}), 500
        
        print(f"[YouTube Search] API key found (starts with: {youtube_api_key[:10]}...)")
        
        # Generate search query using OpenAI
        print("[YouTube Search] Generating search query using OpenAI...")
        search_query = generate_youtube_search_query(summary_text, lecture_title)
        if not search_query:
            # Fallback to using lecture title
            search_query = lecture_title if lecture_title else "lecture tutorial explanation"
            print(f"[YouTube Search] Using fallback search query: '{search_query}'")
        else:
            print(f"[YouTube Search] Generated search query: '{search_query}'")
        
        # Search YouTube
        print(f"[YouTube Search] Fetching videos from YouTube API...")
        videos = fetch_youtube_videos(search_query, youtube_api_key)
        
        print(f"[YouTube Search] YouTube API returned {len(videos) if videos else 0} videos")
        
        if not videos:
            print("[YouTube Search] WARNING: No videos returned from YouTube API")
            return jsonify({
                "videos": [],
                "searchQuery": search_query,
                "message": "No videos found. Try a different lecture summary."
            })
        
        # Post-process and score videos for relevance
        print("[YouTube Search] Scoring and filtering videos...")
        scored_videos = score_and_filter_videos(videos, summary_text, lecture_title)
        
        print(f"[YouTube Search] Returning {len(scored_videos[:8])} videos to client")
        
        return jsonify({
            "videos": scored_videos[:8],  # Return top 8 videos
            "searchQuery": search_query
        })
        
    except Exception as e:
        import traceback
        print(f"[YouTube Search] EXCEPTION: {e}")
        print(f"[YouTube Search] Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to search YouTube: {str(e)}"}), 500


def generate_youtube_search_query(summary_text, lecture_title):
    """Use OpenAI to generate an optimal YouTube search query from the summary"""
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return lecture_title or ""
        
        # Truncate summary if too long
        max_chars = 2000
        truncated_summary = summary_text[:max_chars] if len(summary_text) > max_chars else summary_text
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that generates YouTube search queries."},
                {"role": "user", "content": YOUTUBE_SEARCH_PROMPT.format(summary=truncated_summary)}
            ],
            "max_tokens": 50,
            "temperature": 0.3
        }
        
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=15
        )
        
        if response.ok:
            result = response.json()
            query = result["choices"][0]["message"]["content"].strip()
            # Clean up the query - remove quotes and limit length
            query = query.strip('"\'').strip()
            # Append "tutorial" or "explained" for better educational results
            if "tutorial" not in query.lower() and "explained" not in query.lower():
                query += " tutorial"
            return query
        
        return lecture_title or ""
        
    except Exception as e:
        print(f"Error generating YouTube search query: {e}")
        return lecture_title or ""


def fetch_youtube_videos(search_query, api_key, max_results=15):
    """Fetch videos from YouTube Data API v3"""
    try:
        # YouTube Data API v3 search endpoint
        base_url = "https://www.googleapis.com/youtube/v3/search"
        
        params = {
            "part": "snippet",
            "q": search_query,
            "type": "video",
            "videoDuration": "medium",  # Prefer medium-length videos (4-20 minutes)
            "videoEmbeddable": "true",
            "order": "relevance",
            "maxResults": max_results,
            "key": api_key,
            "relevanceLanguage": "en",
            "safeSearch": "moderate"
        }
        
        print(f"[YouTube API] Making request to: {base_url}")
        print(f"[YouTube API] Query: '{search_query}', Max results: {max_results}")
        
        response = requests.get(base_url, params=params, timeout=10)
        
        print(f"[YouTube API] Response status: {response.status_code}")
        
        if not response.ok:
            error_data = response.json() if response.content else {}
            print(f"[YouTube API] ERROR: {response.status_code}")
            print(f"[YouTube API] Error response: {error_data}")
            # Return the error details for debugging
            error_message = error_data.get('error', {}).get('message', 'Unknown error')
            error_reason = error_data.get('error', {}).get('errors', [{}])[0].get('reason', 'unknown')
            print(f"[YouTube API] Error message: {error_message}")
            print(f"[YouTube API] Error reason: {error_reason}")
            return []
        
        data = response.json()
        items = data.get("items", [])
        print(f"[YouTube API] Found {len(items)} items in response")
        
        if not items:
            return []
        
        # Get video IDs for fetching duration and statistics
        video_ids = [item["id"]["videoId"] for item in items]
        
        # Fetch video details (duration, view count, etc.)
        video_details = fetch_video_details(video_ids, api_key)
        
        videos = []
        for item in items:
            video_id = item["id"]["videoId"]
            snippet = item.get("snippet", {})
            details = video_details.get(video_id, {})
            
            videos.append({
                "videoId": video_id,
                "title": snippet.get("title", ""),
                "channelTitle": snippet.get("channelTitle", ""),
                "description": snippet.get("description", ""),
                "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", 
                             snippet.get("thumbnails", {}).get("default", {}).get("url", "")),
                "publishedAt": snippet.get("publishedAt", ""),
                "duration": details.get("duration", ""),
                "viewCount": details.get("viewCount", 0),
                "likeCount": details.get("likeCount", 0)
            })
        
        return videos
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching YouTube videos: {e}")
        return []
    except Exception as e:
        print(f"Unexpected error in fetch_youtube_videos: {e}")
        return []


def fetch_video_details(video_ids, api_key):
    """Fetch additional video details (duration, view count) from YouTube API"""
    try:
        if not video_ids:
            return {}
        
        base_url = "https://www.googleapis.com/youtube/v3/videos"
        
        params = {
            "part": "contentDetails,statistics",
            "id": ",".join(video_ids),
            "key": api_key
        }
        
        response = requests.get(base_url, params=params, timeout=10)
        
        if not response.ok:
            return {}
        
        data = response.json()
        details = {}
        
        for item in data.get("items", []):
            video_id = item["id"]
            content_details = item.get("contentDetails", {})
            statistics = item.get("statistics", {})
            
            # Parse ISO 8601 duration (e.g., "PT5M30S" -> "5:30")
            duration_iso = content_details.get("duration", "")
            duration_formatted = format_youtube_duration(duration_iso)
            
            details[video_id] = {
                "duration": duration_formatted,
                "durationSeconds": parse_duration_to_seconds(duration_iso),
                "viewCount": int(statistics.get("viewCount", 0)),
                "likeCount": int(statistics.get("likeCount", 0))
            }
        
        return details
        
    except Exception as e:
        print(f"Error fetching video details: {e}")
        return {}


def format_youtube_duration(iso_duration):
    """Convert ISO 8601 duration to human-readable format (e.g., PT5M30S -> 5:30)"""
    import re
    if not iso_duration:
        return ""
    
    # Pattern to match hours, minutes, and seconds
    pattern = re.compile(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?')
    match = pattern.match(iso_duration)
    
    if not match:
        return ""
    
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes}:{seconds:02d}"


def parse_duration_to_seconds(iso_duration):
    """Convert ISO 8601 duration to total seconds"""
    import re
    if not iso_duration:
        return 0
    
    pattern = re.compile(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?')
    match = pattern.match(iso_duration)
    
    if not match:
        return 0
    
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    
    return hours * 3600 + minutes * 60 + seconds


def score_and_filter_videos(videos, summary_text, lecture_title):
    """Score and filter videos based on relevance and quality indicators"""
    
    # Keywords that indicate educational content
    educational_keywords = [
        "tutorial", "explained", "introduction", "basics", "lesson",
        "course", "lecture", "learn", "understanding", "guide",
        "how to", "what is", "example", "worked", "step by step"
    ]
    
    # Keywords that might indicate clickbait or low-quality content
    negative_keywords = [
        "challenge", "prank", "reaction", "vlog", "unboxing",
        "drama", "exposed", "shocking", "you won't believe"
    ]
    
    # Extract key terms from summary and title for matching
    search_terms = set()
    if lecture_title:
        search_terms.update(lecture_title.lower().split())
    if summary_text:
        # Get first 500 chars of summary for key terms
        search_terms.update(summary_text[:500].lower().split())
    
    # Remove common words
    common_words = {"the", "a", "an", "is", "are", "was", "were", "be", "been", 
                    "being", "have", "has", "had", "do", "does", "did", "will",
                    "would", "could", "should", "may", "might", "can", "to", "of",
                    "in", "for", "on", "with", "at", "by", "from", "and", "or", "but"}
    search_terms = {term for term in search_terms if term not in common_words and len(term) > 2}
    
    scored_videos = []
    
    for video in videos:
        score = 50  # Base score
        
        title_lower = video.get("title", "").lower()
        channel_lower = video.get("channelTitle", "").lower()
        description_lower = video.get("description", "").lower()
        
        # Bonus for educational keywords in title
        for keyword in educational_keywords:
            if keyword in title_lower:
                score += 10
                break
        
        # Penalty for negative keywords
        for keyword in negative_keywords:
            if keyword in title_lower:
                score -= 20
                break
        
        # Bonus for matching search terms in title
        matches = sum(1 for term in search_terms if term in title_lower)
        score += min(matches * 5, 25)
        
        # Bonus for view count (logarithmic scale)
        view_count = video.get("viewCount", 0)
        if view_count > 1000000:
            score += 15
        elif view_count > 100000:
            score += 10
        elif view_count > 10000:
            score += 5
        
        # Prefer videos between 5-20 minutes (ideal for educational content)
        duration_seconds = video.get("durationSeconds", 0) or parse_duration_to_seconds_from_formatted(video.get("duration", ""))
        if 300 <= duration_seconds <= 1200:  # 5-20 minutes
            score += 15
            video["durationTag"] = "Quick overview"
        elif 1200 < duration_seconds <= 2400:  # 20-40 minutes
            score += 10
            video["durationTag"] = "Deep dive"
        elif duration_seconds < 300:  # Under 5 minutes
            video["durationTag"] = "Best for overview"
        else:  # Over 40 minutes
            score -= 5
            video["durationTag"] = "Full lecture"
        
        # Add relevance tag based on title analysis
        if "example" in title_lower or "worked" in title_lower:
            video["relevanceTag"] = "Worked examples"
        elif "basics" in title_lower or "introduction" in title_lower or "intro" in title_lower:
            video["relevanceTag"] = "Best for overview"
        elif "advanced" in title_lower or "deep" in title_lower:
            video["relevanceTag"] = "Deep dive"
        elif "visual" in title_lower or "animation" in title_lower:
            video["relevanceTag"] = "Visual explanation"
        else:
            video["relevanceTag"] = ""
        
        video["score"] = score
        scored_videos.append(video)
    
    # Sort by score (descending)
    scored_videos.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    # Filter out low-scoring videos
    filtered_videos = [v for v in scored_videos if v.get("score", 0) >= 30]
    
    return filtered_videos if filtered_videos else scored_videos[:8]


def parse_duration_to_seconds_from_formatted(duration_str):
    """Parse formatted duration (e.g., '5:30' or '1:05:30') to seconds"""
    if not duration_str:
        return 0
    
    parts = duration_str.split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        else:
            return 0
    except (ValueError, IndexError):
        return 0


@app.route('/api/upload-pdf', methods=['POST'])
def upload_pdf():
    if 'pdf' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['pdf']
    
    # Get file extension to determine file type
    filename = file.filename.lower() if file.filename else ''
    is_powerpoint = filename.endswith(('.pptx', '.ppt'))
    is_pdf = filename.endswith('.pdf')
    
    if not (is_pdf or is_powerpoint):
        return jsonify({'error': 'Unsupported file type. Please upload a PDF or PowerPoint file (.pdf, .pptx, .ppt)'}), 400
    
    try:
        captions = ''
        
        if is_powerpoint:
            # Handle PowerPoint files
            file.seek(0)  # Reset file pointer
            prs = Presentation(file)
            for slide_num, slide in enumerate(prs.slides, 1):
                captions += f'\n--- Slide {slide_num} ---\n'
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text:
                        captions += shape.text + '\n'
            print('Extracted text from PowerPoint:', captions[:200])  # Log first 200 chars
        else:
            # Handle PDF files
            file.seek(0)  # Reset file pointer
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                captions += page.extract_text() + '\n'
            print('Extracted captions from PDF:', captions[:200])  # Log first 200 chars
        
        return jsonify({'captions': captions})
    except Exception as e:
        print(f'Error extracting text from file: {e}')
        return jsonify({'error': f'Failed to extract text: {str(e)}'}), 500

@app.route('/api/send-mobile-link', methods=['POST'])
def send_mobile_link():
    try:
        data = request.get_json()
        email = data.get('email')
        link = data.get('link')
        link_type = data.get('type', 'email')

        if not email or not link:
            return jsonify({'error': 'Missing email or link'}), 400

        # TODO: Integrate with an email provider. For now, log request for visibility.
        print(f'Sending {link_type} to {email} with link: {link}')

        return jsonify({'success': True, 'message': f'{link_type} sent successfully'})
    except Exception as e:
        print('Error sending mobile link:', e)
        return jsonify({'error': 'Failed to send link'}), 500

@app.route('/admin/cleanup-summary-generations', methods=['POST'])
def cleanup_summary_generations():
    """Admin endpoint to clean up old summary generation records"""
    try:
        db = get_db()
        deleted_count = db.cleanup_old_summary_generations(days_to_keep=7)
        return jsonify({
            'success': True, 
            'message': f'Cleaned up {deleted_count} old summary generation records',
            'deleted_count': deleted_count
        })
    except Exception as e:
        print(f'Error in cleanup endpoint: {e}')
        return jsonify({'error': 'Failed to cleanup summary generations'}), 500

@app.route("/api/lectures/<lecture_id>", methods=["GET"])
def get_lecture_by_id(lecture_id):
    """Get lecture data by ID for the lecture viewer"""
    try:
        print(f"Fetching lecture with ID: {lecture_id}")
        db = get_db()
        lecture = db.get_lecture_by_id(lecture_id)
        
        print(f"Lecture found: {lecture is not None}")
        if lecture:
            print(f"Lecture data: {lecture}")
        
        if not lecture:
            return jsonify({'error': 'Lecture not found'}), 404
            
        return jsonify({
            'lecture_id': lecture['Lecture_ID'],
            'url': lecture['URL'],
            'summary': lecture['Summary'],
            'title': lecture['Title'],
            'timestamp': lecture['Timestamp']
        })
    except Exception as e:
        print(f"Error fetching lecture {lecture_id}: {e}")
        return jsonify({'error': 'Failed to fetch lecture'}), 500

@app.route("/admin/referrals", methods=["GET"])
def admin_referrals():
    """Simple admin page to view referral statistics"""
    # Simple password protection - you can change this
    admin_key = request.args.get('key')
    if not os.getenv('ADMIN_KEY') or admin_key != os.getenv('ADMIN_KEY'):
        return "Unauthorized", 401
    
    try:
        db = get_db()
        stats = db.get_all_referral_stats()
        return render_template("admin_referrals.html", stats=stats)
    except Exception as e:
        print(f"Error fetching referral stats: {e}")
        return jsonify({'error': 'Failed to fetch referral stats'}), 500

@app.route("/api/admin/referrals/<creator_code>", methods=["GET"])
def api_referral_stats(creator_code):
    """API endpoint to get referral stats for a specific creator"""
    admin_key = request.args.get('key')
    if not os.getenv('ADMIN_KEY') or admin_key != os.getenv('ADMIN_KEY'):
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        db = get_db()
        stats = db.get_referral_stats(creator_code)
        return jsonify(stats)
    except Exception as e:
        print(f"Error fetching referral stats: {e}")
        return jsonify({'error': 'Failed to fetch stats'}), 500

@app.route("/r/<source>", methods=["GET"])
def tracked_redirect(source):
    """Log a visit for a given QR/source and redirect to the home page."""
    try:
        db = get_db()
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent')
        db.log_qr_visit(source, ip, user_agent)
    except Exception as e:
        print(f"Error logging QR visit for {source}: {e}")
    return redirect(url_for('home'))

@app.route("/api/admin/qr-stats", methods=["GET"])
def api_qr_stats():
    """Return visit counts per source. Protected by ADMIN_KEY query param."""
    admin_key = request.args.get('key')
    if not os.getenv('ADMIN_KEY') or admin_key != os.getenv('ADMIN_KEY'):
        return jsonify({"error": "Unauthorized"}), 401
    try:
        db = get_db()
        rows = db.get_qr_visit_counts()
        return jsonify({"sources": rows})
    except Exception as e:
        print(f"Error fetching QR stats: {e}")
        return jsonify({"error": "Failed to fetch stats"}), 500

@app.route("/qr/<source>.png", methods=["GET"])
def qr_image(source):
    """Generate a QR PNG that points to the tracked redirect URL for this source."""
    try:
        # Absolute URL to the tracked redirect
        target_url = url_for('tracked_redirect', source=source, _external=True)
        img = qrcode.make(target_url)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return app.response_class(buf.read(), mimetype='image/png')
    except Exception as e:
        print(f"Error generating QR for {source}: {e}")
        return jsonify({"error": "Failed to generate QR"}), 500

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)