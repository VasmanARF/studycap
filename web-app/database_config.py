import os
from dotenv import load_dotenv

def get_db_config():
    # Load environment variables from .env file
    load_dotenv()
    
    db_host = os.getenv('DB_HOST')
    
    # Check if using Unix socket (for App Engine) or TCP (for local development)
    if db_host and db_host.startswith('/cloudsql/'):
        # Unix socket connection for App Engine
        return {
            'database': os.getenv('DB_DATABASE', 'studycap'),
            'user': os.getenv('DB_USER', 'studycap-user'),
            'password': os.getenv('DB_PASSWORD'),
            'unix_socket': db_host,
            'use_pure': True
        }
    else:
        # TCP connection for local development
        return {
            'database': os.getenv('DB_DATABASE', 'studycap'),
            'user': os.getenv('DB_USER', 'studycap-user'),
            'password': os.getenv('DB_PASSWORD'),
            'host': db_host,
            'port': int(os.getenv('DB_PORT', '3306')),
            'use_pure': True
        }