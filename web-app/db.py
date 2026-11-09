import mysql.connector
from datetime import datetime, timezone
from database_config import get_db_config


class Database():
    def __init__(self, conn):
        self.conn = conn
        self.curs = self.conn.cursor(dictionary=True)  # Use dictionary cursor for named columns
        self.create_tables()  # If tables don't exist, create them.

    def create_tables(self):
        # Create the Users table.
        self.curs.execute("""
        CREATE TABLE IF NOT EXISTS Users(
            Username VARCHAR(50) PRIMARY KEY NOT NULL,
            Email VARCHAR(50) NOT NULL,
            Bio VARCHAR(500),
            Tier VARCHAR(50) DEFAULT 'Free',
            Start_Date DATETIME,
            End_Date DATETIME,
            stripe_customer_id VARCHAR(255),
            referred_by VARCHAR(50),
            signup_date DATETIME
        );
        """)
        
        # Add signup_date column if it doesn't exist (for existing databases)
        try:
            self.curs.execute("""
                ALTER TABLE Users 
                ADD COLUMN signup_date DATETIME 
            """)
            self.conn.commit()
        except mysql.connector.Error as e:
            # Column already exists, ignore the error
            if e.errno != 1060:  # 1060 is "Duplicate column name" error
                raise
            self.conn.rollback()
        

        # Create the UserLectures table to link users with lecture data.
        self.curs.execute("""
        CREATE TABLE IF NOT EXISTS UserLectures(
            ID INT AUTO_INCREMENT PRIMARY KEY,
            Username VARCHAR(50) NOT NULL,
            Lecture_ID VARCHAR(50) NOT NULL,
            Title VARCHAR(255) NOT NULL,
            URL VARCHAR(2048),
            Summary TEXT,
            Timestamp DATETIME,
            FOREIGN KEY (Username) REFERENCES Users(Username) ON DELETE CASCADE,
            UNIQUE(Username, URL(255))
        );
        """)

        self.curs.execute("""
        CREATE TABLE IF NOT EXISTS SummaryGenerations(
            ID INT AUTO_INCREMENT PRIMARY KEY,
            Username VARCHAR(255) NOT NULL,
            Lecture_ID VARCHAR(255) NOT NULL,
            Timestamp DATETIME NOT NULL
        );
        """)
        # Track QR/redirect visits by source slug
        self.curs.execute("""
        CREATE TABLE IF NOT EXISTS QRVisits(
            ID INT AUTO_INCREMENT PRIMARY KEY,
            source VARCHAR(100) NOT NULL,
            ip VARCHAR(45),
            user_agent VARCHAR(255),
            Timestamp DATETIME NOT NULL
        );
        """)
        self.conn.commit()

    def register(self, username, email, referred_by=None):
        # Register new user (Google OAuth only)
        signup_date = datetime.now(timezone.utc)
        insert_query = '''INSERT INTO Users (Username, Email, Tier, referred_by, signup_date) 
                        VALUES (%s, %s, 'Free', %s, %s)'''
        # Convert to UTC timestamp for storage (MySQL DATETIME format)
        signup_date_str = signup_date.strftime('%Y-%m-%d %H:%M:%S')
        self.curs.execute(insert_query, (username, email, referred_by, signup_date_str))
        self.conn.commit()

    def add_summary_generation(self, username, lecture_id):
        query = """INSERT INTO SummaryGenerations (Username, Lecture_ID, Timestamp) VALUES (%s, %s, %s)"""
        self.curs.execute(query, (username, lecture_id, datetime.now(timezone.utc)))
        self.conn.commit()

    def verify(self, username):
        # Verification system removed - this method is now a no-op
        pass
    
    def verify_username_email(self, email, username):
        # Verification system removed - this method is now a no-op
        pass

    def delete_duplicate_emails(self, email):
        delete_query = """DELETE FROM Users WHERE Email = %s"""
        self.curs.execute(delete_query, (email,))
        self.conn.commit()
    
    def remove_user(self, username):
        # If user exists, remove from all the records
        delete_query = """DELETE FROM Users WHERE Username = %s"""
        self.curs.execute(delete_query, (username,))
        self.conn.commit()
    
    # login method removed - using Google OAuth only
    
    # reset_password method removed - using Google OAuth only
    
    def get_verified_email(self, email):
        query = """SELECT * FROM Users WHERE Email=%s"""
        self.curs.execute(query, (email,))
        return self.curs.fetchone()
    
    def get_verified_email_from_user(self, username):
        query = """SELECT Email FROM Users WHERE Username=%s"""
        self.curs.execute(query, (username,))
        return self.curs.fetchone()
    
    # forgot_password method removed - using Google OAuth only
    
    def get_user(self, username):
        query = """SELECT * FROM Users WHERE Username=%s"""
        self.curs.execute(query, (username,))
        return self.curs.fetchone()
    
    def get_user_unverified(self, username):
        query = """SELECT * FROM Users WHERE Username=%s"""
        self.curs.execute(query, (username,))
        return self.curs.fetchone()
    
    def update_tier_by_email(self, email, new_tier):
        query = "UPDATE Users SET Tier = %s WHERE Email = %s"
        self.curs.execute(query, (new_tier, email))
        self.conn.commit()

    def update_tier_by_username(self, username, new_tier):
        query = "UPDATE Users SET Tier = %s WHERE Username = %s"
        self.curs.execute(query, (new_tier, username))
        self.conn.commit()

    def update_stripe_customer_id(self, username, customer_id):
        """Update the Stripe customer ID for a user"""
        query = "UPDATE Users SET stripe_customer_id = %s WHERE Username = %s"
        self.curs.execute(query, (customer_id, username))
        self.conn.commit()

    def get_user_by_stripe_customer_id(self, customer_id):
        """Get user by Stripe customer ID"""
        query = "SELECT * FROM Users WHERE stripe_customer_id = %s"
        self.curs.execute(query, (customer_id,))
        return self.curs.fetchone()

    def update_dates_by_username(self, username, start_date, end_date):
        """Update the start and end dates for a user's subscription by username."""
        try:
            if start_date is None and end_date is None:
                # Clear the dates
                query = """
                UPDATE Users 
                SET Start_Date = NULL, End_Date = NULL
                WHERE Username = %s
                """
                self.curs.execute(query, (username,))
            else:
                # Force UTC timezone
                if start_date and start_date.tzinfo is None:
                    start_date = start_date.replace(tzinfo=timezone.utc)
                elif start_date:
                    start_date = start_date.astimezone(timezone.utc)
                    
                if end_date and end_date.tzinfo is None:
                    end_date = end_date.replace(tzinfo=timezone.utc)
                elif end_date:
                    end_date = end_date.astimezone(timezone.utc)
                
                # Convert to UTC timestamp for storage (MySQL DATETIME format)
                start_date_str = start_date.strftime('%Y-%m-%d %H:%M:%S') if start_date else None
                end_date_str = end_date.strftime('%Y-%m-%d %H:%M:%S') if end_date else None
                
                print(f"Storing dates by username - Start: {start_date_str} UTC, End: {end_date_str} UTC")
                
                query = """
                UPDATE Users 
                SET Start_Date = %s, End_Date = %s
                WHERE Username = %s
                """
                self.curs.execute(query, (start_date_str, end_date_str, username))
            
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Error updating dates by username: {e}")
            return False

    def update_dates(self, email, start_date, end_date):
        """Update the start and end dates for a user's subscription."""
        try:
            # Force UTC timezone
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            else:
                start_date = start_date.astimezone(timezone.utc)
                
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            else:
                end_date = end_date.astimezone(timezone.utc)
            
            # Convert to UTC timestamp for storage (MySQL DATETIME format)
            start_date_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
            end_date_str = end_date.strftime('%Y-%m-%d %H:%M:%S')
            
            print(f"Storing dates - Start: {start_date_str} UTC, End: {end_date_str} UTC")
            
            query = """
            UPDATE Users 
            SET Start_Date = %s, End_Date = %s
            WHERE Email = %s
            """
            self.curs.execute(query, (start_date_str, end_date_str, email))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Error updating dates: {e}")
            return False
    
    def add_lecture(self, username, lecture_id, url, summary, title):
        """Add a new lecture to the database."""
        try:
            # Use timezone-aware UTC timestamp
            timestamp = datetime.now(timezone.utc).isoformat()
            
            query = """
            INSERT INTO UserLectures (Username, Lecture_ID, URL, Summary, Title, Timestamp)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            self.curs.execute(query, (username, lecture_id, url, summary, title, timestamp))
            self.conn.commit()
            return True
        except mysql.connector.IntegrityError as e:
            # Handle duplicate key error (lecture already exists)
            if e.errno == 1062:  # Duplicate entry error
                print(f"Lecture already exists: {e}")
                return "duplicate"
            else:
                print(f"Integrity error adding lecture: {e}")
                return False
        except Exception as e:
            print(f"Error adding lecture: {e}")
            return False

    def replace_lecture(self, username, lecture_id, url, summary, title):
        """Replace an existing lecture in the database."""
        try:
            # Use timezone-aware UTC timestamp
            timestamp = datetime.now(timezone.utc).isoformat()
            
            # First, try to update existing lecture by Lecture_ID and Username
            update_query = """
            UPDATE UserLectures 
            SET URL = %s, Summary = %s, Title = %s, Timestamp = %s
            WHERE Username = %s AND Lecture_ID = %s
            """
            self.curs.execute(update_query, (url, summary, title, timestamp, username, lecture_id))
            
            # If no rows were updated, insert a new lecture
            if self.curs.rowcount == 0:
                insert_query = """
            INSERT INTO UserLectures (Username, Lecture_ID, URL, Summary, Title, Timestamp)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
                self.curs.execute(insert_query, (username, lecture_id, url, summary, title, timestamp))
            
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Error replacing lecture: {e}")
            return False

    def get_lectures(self, username):
        query = """
        SELECT Lecture_ID, URL, Summary, Timestamp, Title 
        FROM UserLectures 
        WHERE Username = %s 
        ORDER BY Timestamp DESC
        """
        self.curs.execute(query, (username,))
        lectures = self.curs.fetchall()
        return [dict(lecture) for lecture in lectures]

    def get_lecture_by_id(self, lecture_id):
        """Get a specific lecture by its ID"""
        query = """
        SELECT Lecture_ID, URL, Summary, Timestamp, Title, Username
        FROM UserLectures 
        WHERE Lecture_ID = %s
        """
        self.curs.execute(query, (lecture_id,))
        lecture = self.curs.fetchone()
        return dict(lecture) if lecture else None

    def get_lecture_by_id_and_username(self, lecture_id, username):
        """Get a specific lecture by its ID and Username - ensures ownership"""
        query = """
        SELECT Lecture_ID, URL, Summary, Timestamp, Title, Username
        FROM UserLectures 
        WHERE Lecture_ID = %s AND Username = %s
        """
        self.curs.execute(query, (lecture_id, username))
        lecture = self.curs.fetchone()
        return dict(lecture) if lecture else None

    def update_lecture_title(self, username, lecture_id, new_title):
        query = """
        UPDATE UserLectures 
        SET Title = %s 
        WHERE Username = %s AND Lecture_ID = %s
        """
        self.curs.execute(query, (new_title, username, lecture_id))
        self.conn.commit()
        return self.curs.rowcount > 0

    def delete_lecture(self, username, lecture_id):
        query = """
        DELETE FROM UserLectures 
        WHERE Username = %s AND Lecture_ID = %s
        """
        self.curs.execute(query, (username, lecture_id))
        self.conn.commit()
        return self.curs.rowcount > 0

    def get_summaries_count_today(self, username):
        try:
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            query = '''
                SELECT COUNT(*) as count FROM SummaryGenerations
                WHERE Username = %s AND DATE(Timestamp) = %s
            '''
            self.curs.execute(query, (username, today))
            result = self.curs.fetchone()
            return result['count'] if result else 0
        except Exception as e:
            print(f"Error getting summaries count: {e}")
            return 0

    def cleanup_old_summary_generations(self, days_to_keep=7):
        """Delete summary generation records older than specified days"""
        try:
            query = """
            DELETE FROM SummaryGenerations 
            WHERE Timestamp < DATE_SUB(NOW(), INTERVAL %s DAY)
            """
            self.curs.execute(query, (days_to_keep,))
            deleted_count = self.curs.rowcount
            self.conn.commit()
            print(f"Cleaned up {deleted_count} old summary generation records")
            return deleted_count
        except Exception as e:
            print(f"Error cleaning up summary generations: {e}")
            return 0

    def get_lectures_count(self, username):
        """Get the count of lectures in the user's dashboard"""
        try:
            query = """
            SELECT COUNT(*) as count FROM UserLectures
            WHERE Username = %s
            """
            self.curs.execute(query, (username,))
            result = self.curs.fetchone()
            return result['count'] if result else 0
        except Exception as e:
            print(f"Error getting lectures count: {e}")
            return 0

    def get_lifetime_summaries_count(self, username):
        """Get the lifetime count of summary generations for a user"""
        try:
            query = """
            SELECT COUNT(*) as count FROM SummaryGenerations
            WHERE Username = %s
            """
            self.curs.execute(query, (username,))
            result = self.curs.fetchone()
            return result['count'] if result else 0
        except Exception as e:
            print(f"Error getting lifetime summaries count: {e}")
            return 0

    def log_qr_visit(self, source, ip, user_agent):
        """Insert a QR/redirect visit record."""
        try:
            query = """
            INSERT INTO QRVisits (source, ip, user_agent, Timestamp)
            VALUES (%s, %s, %s, %s)
            """
            self.curs.execute(query, (source, ip, user_agent, datetime.now(timezone.utc)))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Error logging QR visit: {e}")
            return False

    def get_qr_visit_counts(self):
        """Get counts of visits grouped by source."""
        try:
            query = """
            SELECT source, COUNT(*) AS visits
            FROM QRVisits
            GROUP BY source
            ORDER BY visits DESC
            """
            self.curs.execute(query)
            return self.curs.fetchall()
        except Exception as e:
            print(f"Error fetching QR visit counts: {e}")
            return []

    def get_referral_stats(self, creator_code):
        """Get referral statistics for a content creator"""
        query = """
        SELECT 
            COUNT(*) as total_referrals,
            SUM(CASE WHEN Tier != 'Free' THEN 1 ELSE 0 END) as paid_users,
            SUM(CASE WHEN Tier = 'Student' THEN 1 ELSE 0 END) as student_tier,
            SUM(CASE WHEN Tier = 'Premium' THEN 1 ELSE 0 END) as premium_tier
        FROM Users
        WHERE referred_by = %s
        """
        self.curs.execute(query, (creator_code,))
        return self.curs.fetchone()

    def get_all_referral_stats(self):
        """Get all referral statistics grouped by creator"""
        query = """
        SELECT 
            referred_by as creator_code,
            COUNT(*) as total_referrals,
            SUM(CASE WHEN Tier != 'Free' THEN 1 ELSE 0 END) as paid_users,
            SUM(CASE WHEN Tier = 'Student' THEN 1 ELSE 0 END) as student_tier,
            SUM(CASE WHEN Tier = 'Premium' THEN 1 ELSE 0 END) as premium_tier
        FROM Users
        WHERE referred_by IS NOT NULL
        GROUP BY referred_by
        ORDER BY paid_users DESC, total_referrals DESC
        """
        self.curs.execute(query)
        return self.curs.fetchall()