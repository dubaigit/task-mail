#!/usr/bin/env python3
"""
Email Intelligence System - Configuration and Integration
Handles actual API connections and email provider integrations
"""

import os
import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from pathlib import Path
import yaml
from datetime import datetime
import aiohttp
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import imaplib
import smtplib
import email
from email.header import decode_header
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration Management
# ============================================================================

@dataclass
class ModelConfig:
    """Configuration for AI models"""
    provider: str  # "openai", "anthropic", "groq"
    nano_model: str = "gpt-5-nano-2025-08-07"
    mini_model: str = "gpt-5-mini-2025-08-07"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    max_retries: int = 3
    timeout_seconds: int = 30
    
    # Model-specific parameters
    nano_temperature: float = 0.3  # Lower for consistency
    nano_max_tokens: int = 150     # Keep responses short
    mini_temperature: float = 0.7  # Higher for creativity
    mini_max_tokens: int = 1000    # Allow detailed responses

@dataclass
class EmailProviderConfig:
    """Configuration for email providers"""
    provider: str  # "gmail", "outlook", "exchange", "imap"
    
    # IMAP settings
    imap_server: Optional[str] = None
    imap_port: int = 993
    imap_use_ssl: bool = True
    
    # SMTP settings
    smtp_server: Optional[str] = None
    smtp_port: int = 587
    smtp_use_tls: bool = True
    
    # Authentication
    username: Optional[str] = None
    password: Optional[str] = None
    oauth_token: Optional[str] = None
    
    # Provider-specific settings
    gmail_credentials_path: Optional[str] = None
    outlook_client_id: Optional[str] = None
    exchange_server_url: Optional[str] = None

@dataclass
class ProcessingConfig:
    """Configuration for processing behavior"""
    # Performance settings
    batch_size: int = 50
    max_concurrent_nano: int = 20  # High concurrency for fast model
    max_concurrent_mini: int = 5   # Lower concurrency for detailed model
    cache_ttl_seconds: int = 3600
    
    # Processing thresholds
    urgency_notification_threshold: int = 4  # Urgency.HIGH
    confidence_threshold_for_mini: float = 0.8
    max_email_length_for_nano: int = 500
    
    # Feature flags
    enable_auto_reply: bool = False
    enable_task_extraction: bool = True
    enable_calendar_integration: bool = True
    enable_notification: bool = True
    learn_user_style: bool = True
    
    # Filtering
    skip_categories: List[str] = field(default_factory=lambda: ["spam", "promotional"])
    priority_senders: List[str] = field(default_factory=list)
    vip_domains: List[str] = field(default_factory=list)

@dataclass
class SystemConfig:
    """Complete system configuration"""
    model: ModelConfig
    email: EmailProviderConfig
    processing: ProcessingConfig
    database_path: str = "email_intelligence.db"
    log_level: str = "INFO"
    
    @classmethod
    def from_file(cls, config_path: str) -> 'SystemConfig':
        """Load configuration from YAML or JSON file"""
        path = Path(config_path)
        
        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")
        
        with open(path, 'r') as f:
            if path.suffix in ['.yaml', '.yml']:
                data = yaml.safe_load(f)
            else:
                data = json.load(f)
        
        # Parse nested configurations
        model_config = ModelConfig(**data.get('model', {}))
        email_config = EmailProviderConfig(**data.get('email', {}))
        processing_config = ProcessingConfig(**data.get('processing', {}))
        
        return cls(
            model=model_config,
            email=email_config,
            processing=processing_config,
            database_path=data.get('database_path', 'email_intelligence.db'),
            log_level=data.get('log_level', 'INFO')
        )
    
    @classmethod
    def from_env(cls) -> 'SystemConfig':
        """Load configuration from environment variables"""
        model_config = ModelConfig(
            provider=os.getenv('AI_PROVIDER', 'openai'),
            nano_model=os.getenv('NANO_MODEL', 'gpt-5-nano-2025-08-07'),
            mini_model=os.getenv('MINI_MODEL', 'gpt-5-mini-2025-08-07'),
            api_key=os.getenv('AI_API_KEY')
        )
        
        email_config = EmailProviderConfig(
            provider=os.getenv('EMAIL_PROVIDER', 'gmail'),
            imap_server=os.getenv('IMAP_SERVER'),
            smtp_server=os.getenv('SMTP_SERVER'),
            username=os.getenv('EMAIL_USERNAME'),
            password=os.getenv('EMAIL_PASSWORD')
        )
        
        processing_config = ProcessingConfig()
        
        return cls(
            model=model_config,
            email=email_config,
            processing=processing_config
        )

# ============================================================================
# Model API Integrations
# ============================================================================

class OpenAIProvider:
    """OpenAI API provider for GPT-5 models"""
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.base_url = config.base_url or "https://api.openai.com/v1"
        self.headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json"
        }
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def call_nano(self, prompt: str, system_prompt: str = None) -> Dict[str, Any]:
        """Call GPT-5-nano for fast processing"""
        return await self._call_model(
            model=self.config.nano_model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=self.config.nano_temperature,
            max_tokens=self.config.nano_max_tokens,
            response_format={"type": "json_object"}  # Force JSON response
        )
    
    async def call_mini(self, prompt: str, system_prompt: str = None) -> Dict[str, Any]:
        """Call GPT-5-mini for detailed processing"""
        return await self._call_model(
            model=self.config.mini_model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=self.config.mini_temperature,
            max_tokens=self.config.mini_max_tokens
        )
    
    async def _call_model(self, 
                         model: str, 
                         prompt: str,
                         system_prompt: str = None,
                         temperature: float = 0.7,
                         max_tokens: int = 500,
                         response_format: Dict = None) -> Dict[str, Any]:
        """Generic model call with retry logic"""
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if response_format:
            payload["response_format"] = response_format
        
        for attempt in range(self.config.max_retries):
            try:
                async with self.session.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=self.config.timeout_seconds)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_response(data)
                    else:
                        error_data = await response.text()
                        logger.error(f"API error: {response.status} - {error_data}")
                        
                        if response.status == 429:  # Rate limit
                            await asyncio.sleep(2 ** attempt)  # Exponential backoff
                        else:
                            raise Exception(f"API error: {response.status}")
            
            except asyncio.TimeoutError:
                logger.warning(f"Timeout on attempt {attempt + 1}")
                if attempt == self.config.max_retries - 1:
                    raise
            except Exception as e:
                logger.error(f"Error calling model: {e}")
                if attempt == self.config.max_retries - 1:
                    raise
        
        raise Exception("Max retries exceeded")
    
    def _parse_response(self, data: Dict) -> Dict[str, Any]:
        """Parse API response"""
        try:
            content = data['choices'][0]['message']['content']
            
            # Try to parse as JSON if it looks like JSON
            if content.strip().startswith('{'):
                return json.loads(content)
            
            return {"content": content}
        except Exception as e:
            logger.error(f"Error parsing response: {e}")
            return {"error": str(e), "raw": data}

class GroqProvider:
    """Groq API provider for ultra-fast inference"""
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.base_url = config.base_url or "https://api.groq.com/openai/v1"
        self.headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json"
        }
    
    # Similar implementation to OpenAIProvider
    # Groq uses OpenAI-compatible API

# ============================================================================
# Email Provider Integrations
# ============================================================================

class EmailProvider:
    """Base class for email providers"""
    
    def __init__(self, config: EmailProviderConfig):
        self.config = config
    
    async def fetch_emails(self, 
                          folder: str = "INBOX",
                          limit: int = 50,
                          since: datetime = None) -> List[Dict[str, Any]]:
        """Fetch emails from provider"""
        raise NotImplementedError
    
    async def send_email(self, 
                        to: str,
                        subject: str,
                        body: str,
                        cc: List[str] = None,
                        bcc: List[str] = None) -> bool:
        """Send email through provider"""
        raise NotImplementedError
    
    async def mark_as_read(self, email_id: str) -> bool:
        """Mark email as read"""
        raise NotImplementedError
    
    async def move_to_folder(self, email_id: str, folder: str) -> bool:
        """Move email to folder"""
        raise NotImplementedError

class IMAPProvider(EmailProvider):
    """Generic IMAP email provider"""
    
    def __init__(self, config: EmailProviderConfig):
        super().__init__(config)
        self.imap = None
        self.smtp = None
    
    def connect(self):
        """Connect to IMAP server"""
        if self.config.imap_use_ssl:
            self.imap = imaplib.IMAP4_SSL(
                self.config.imap_server, 
                self.config.imap_port
            )
        else:
            self.imap = imaplib.IMAP4(
                self.config.imap_server,
                self.config.imap_port
            )
        
        # Authenticate
        if self.config.oauth_token:
            # OAuth authentication
            auth_string = f'user={self.config.username}\x01auth=Bearer {self.config.oauth_token}\x01\x01'
            self.imap.authenticate('XOAUTH2', lambda x: auth_string)
        else:
            # Password authentication
            self.imap.login(self.config.username, self.config.password)
    
    async def fetch_emails(self, 
                          folder: str = "INBOX",
                          limit: int = 50,
                          since: datetime = None) -> List[Dict[str, Any]]:
        """Fetch emails via IMAP"""
        if not self.imap:
            self.connect()
        
        self.imap.select(folder)
        
        # Build search criteria
        criteria = ['ALL']
        if since:
            date_str = since.strftime("%d-%b-%Y")
            criteria = [f'(SINCE "{date_str}")']
        
        # Search for emails
        typ, data = self.imap.search(None, *criteria)
        email_ids = data[0].split()[-limit:]  # Get last N emails
        
        emails = []
        for email_id in email_ids:
            typ, data = self.imap.fetch(email_id, '(RFC822)')
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            # Parse email
            email_data = self._parse_email(msg, email_id.decode())
            emails.append(email_data)
        
        return emails
    
    def _parse_email(self, msg, email_id: str) -> Dict[str, Any]:
        """Parse email message"""
        # Decode subject
        subject = decode_header(msg["Subject"])[0][0]
        if isinstance(subject, bytes):
            subject = subject.decode()
        
        # Get sender
        from_addr = msg.get("From")
        
        # Get recipients
        to_addrs = msg.get("To", "").split(",")
        cc_addrs = msg.get("Cc", "").split(",") if msg.get("Cc") else []
        
        # Get date
        date_str = msg.get("Date")
        
        # Get body
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True).decode()
                    break
        else:
            body = msg.get_payload(decode=True).decode()
        
        # Get attachments
        attachments = []
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_disposition() == 'attachment':
                    filename = part.get_filename()
                    if filename:
                        attachments.append(filename)
        
        return {
            "id": email_id,
            "subject": subject,
            "from": from_addr,
            "to": to_addrs,
            "cc": cc_addrs,
            "date": date_str,
            "body": body,
            "attachments": attachments,
            "thread_id": msg.get("Message-ID"),
            "in_reply_to": msg.get("In-Reply-To")
        }
    
    async def send_email(self,
                        to: str,
                        subject: str,
                        body: str,
                        cc: List[str] = None,
                        bcc: List[str] = None) -> bool:
        """Send email via SMTP"""
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.config.username
            msg['To'] = to
            msg['Subject'] = subject
            
            if cc:
                msg['Cc'] = ', '.join(cc)
            
            # Add body
            msg.attach(MIMEText(body, 'plain'))
            
            # Connect to SMTP
            if self.config.smtp_use_tls:
                smtp = smtplib.SMTP(self.config.smtp_server, self.config.smtp_port)
                smtp.starttls()
            else:
                smtp = smtplib.SMTP_SSL(self.config.smtp_server, self.config.smtp_port)
            
            smtp.login(self.config.username, self.config.password)
            
            # Send email
            recipients = [to]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            smtp.send_message(msg, to_addrs=recipients)
            smtp.quit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from servers"""
        if self.imap:
            self.imap.close()
            self.imap.logout()

class GmailProvider(IMAPProvider):
    """Gmail-specific provider with OAuth support"""
    
    def __init__(self, config: EmailProviderConfig):
        # Set Gmail defaults
        config.imap_server = config.imap_server or "imap.gmail.com"
        config.smtp_server = config.smtp_server or "smtp.gmail.com"
        super().__init__(config)
    
    # Add Gmail-specific features like labels, etc.

class OutlookProvider(IMAPProvider):
    """Outlook-specific provider"""
    
    def __init__(self, config: EmailProviderConfig):
        # Set Outlook defaults
        config.imap_server = config.imap_server or "outlook.office365.com"
        config.smtp_server = config.smtp_server or "smtp.office365.com"
        super().__init__(config)
    
    # Add Outlook-specific features

# ============================================================================
# Factory Functions
# ============================================================================

def create_model_provider(config: ModelConfig):
    """Factory to create appropriate model provider"""
    providers = {
        'openai': OpenAIProvider,
        'groq': GroqProvider,
        # Add more providers as needed
    }
    
    provider_class = providers.get(config.provider)
    if not provider_class:
        raise ValueError(f"Unknown provider: {config.provider}")
    
    return provider_class(config)

def create_email_provider(config: EmailProviderConfig):
    """Factory to create appropriate email provider"""
    providers = {
        'gmail': GmailProvider,
        'outlook': OutlookProvider,
        'imap': IMAPProvider,
        # Add more providers as needed
    }
    
    provider_class = providers.get(config.provider, IMAPProvider)
    return provider_class(config)

# ============================================================================
# Configuration Templates
# ============================================================================

def create_default_config(output_path: str = "email_intelligence_config.yaml"):
    """Create a default configuration file"""
    config = {
        "model": {
            "provider": "openai",
            "nano_model": "gpt-5-nano-2025-08-07",
            "mini_model": "gpt-5-mini-2025-08-07",
            "api_key": "your-api-key-here",
            "nano_temperature": 0.3,
            "nano_max_tokens": 150,
            "mini_temperature": 0.7,
            "mini_max_tokens": 1000
        },
        "email": {
            "provider": "gmail",
            "username": "your-email@gmail.com",
            "password": "your-app-password",
            "imap_server": "imap.gmail.com",
            "smtp_server": "smtp.gmail.com"
        },
        "processing": {
            "batch_size": 50,
            "max_concurrent_nano": 20,
            "max_concurrent_mini": 5,
            "urgency_notification_threshold": 4,
            "enable_auto_reply": False,
            "enable_task_extraction": True,
            "skip_categories": ["spam", "promotional"],
            "priority_senders": [],
            "vip_domains": []
        },
        "database_path": "email_intelligence.db",
        "log_level": "INFO"
    }
    
    with open(output_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    
    print(f"Default configuration created at: {output_path}")

if __name__ == "__main__":
    # Create default configuration file
    create_default_config()