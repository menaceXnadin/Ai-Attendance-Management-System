"""
Email service for sending password reset and notification emails.
"""
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
from typing import Optional
from app.core.config import settings


class EmailService:
    """Service for sending emails via SMTP. Provides graceful fallback when SMTP isn't configured."""
    
    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None
    ) -> bool:
        """
        Send an email using configured SMTP settings.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Plain text body
            html_body: Optional HTML body
            
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            # Check if SMTP is configured
            if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
                print("[EmailService] SMTP not configured; skipping actual send.")
                return False
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = settings.smtp_user
            msg['To'] = to_email
            
            # Attach plain text version
            text_part = MIMEText(body, 'plain')
            msg.attach(text_part)
            
            # Attach HTML version if provided
            if html_body:
                html_part = MIMEText(html_body, 'html')
                msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            
            print(f"✅ Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to send email: {e}")
            return False
    
    @staticmethod
    async def send_password_reset_email(
        to_email: str,
        reset_token: str,
        user_name: str
    ) -> bool:
        """
        Send a password reset email with reset link.
        
        Args:
            to_email: User's email address
            reset_token: Password reset token
            user_name: User's full name
            
        Returns:
            True if email sent successfully
        """
        # Create reset link (adjust frontend URL as needed)
        frontend_url = settings.frontend_base_url
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        subject = "Password Reset Request - AI Attendance System"
        
        # Plain text version
        body = f"""
Hello {user_name},

You have requested to reset your password for the AI Attendance Management System.

Please click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email.

Best regards,
AI Attendance Management System Team
        """
        
        # HTML version
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background-color: #4F46E5;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }}
        .content {{
            background-color: #f9fafb;
            padding: 30px;
            border-radius: 0 0 5px 5px;
        }}
        .button {{
            display: inline-block;
            padding: 12px 30px;
            background-color: #4F46E5;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }}
        .footer {{
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Password Reset Request</h2>
        </div>
        <div class="content">
            <p>Hello <strong>{user_name}</strong>,</p>
            
            <p>You have requested to reset your password for the AI Attendance Management System.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <a href="{reset_link}" class="button">Reset Password</a>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4F46E5;">{reset_link}</p>
            
            <div class="footer">
                <p><strong>⏰ This link will expire in 1 hour.</strong></p>
                <p>If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
        </div>
    </div>
</body>
</html>
        """
        
        return await EmailService.send_email(to_email, subject, body, html_body)
    
    @staticmethod
    async def send_password_changed_notification(
        to_email: str,
        user_name: str
    ) -> bool:
        """
        Send notification that password was successfully changed.
        
        Args:
            to_email: User's email address
            user_name: User's full name
            
        Returns:
            True if email sent successfully
        """
        subject = "Password Changed Successfully - AI Attendance System"
        
        body = f"""
Hello {user_name},

Your password has been successfully changed.

If you did not make this change, please contact your system administrator immediately.

Best regards,
AI Attendance Management System Team
        """
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background-color: #10B981;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }}
        .content {{
            background-color: #f9fafb;
            padding: 30px;
            border-radius: 0 0 5px 5px;
        }}
        .alert {{
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>✅ Password Changed Successfully</h2>
        </div>
        <div class="content">
            <p>Hello <strong>{user_name}</strong>,</p>
            
            <p>Your password has been successfully changed.</p>
            
            <div class="alert">
                <p><strong>⚠️ Security Notice:</strong></p>
                <p>If you did not make this change, please contact your system administrator immediately.</p>
            </div>
            
            <p>Best regards,<br>AI Attendance Management System Team</p>
        </div>
    </div>
</body>
</html>
        """
        
        return await EmailService.send_email(to_email, subject, body, html_body)
