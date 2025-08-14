#!/usr/bin/env python3
"""
MCP Server for Groq Integration
Provides groq-chat and groq-completion tools
"""

import asyncio
import os
import sys
from typing import Any, Dict, Optional
import json

from mcp.server import Server
from mcp.server.stdio import stdio_server
from pydantic import BaseModel
from groq import Groq
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create MCP server instance
app = Server("groq-mcp")

# Initialize Groq client
client = None

def get_groq_client():
    """Get or create Groq client."""
    global client
    if client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable not set")
        client = Groq(api_key=api_key)
    return client

class GroqChatRequest(BaseModel):
    messages: list[Dict[str, str]]
    model: str = "llama3-8b-8192"
    max_tokens: int = 1024
    temperature: float = 0.7

class GroqCompletionRequest(BaseModel):
    prompt: str
    model: str = "llama3-8b-8192"
    max_tokens: int = 1024
    temperature: float = 0.7

@app.call_tool()
async def groq_chat(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Chat completion with Groq
    """
    chat_request = GroqChatRequest(**request)
    
    try:
        groq_client = get_groq_client()
        response = groq_client.chat.completions.create(
            model=chat_request.model,
            messages=chat_request.messages,
            max_tokens=chat_request.max_tokens,
            temperature=chat_request.temperature
        )
        
        return {
            "content": [{
                "type": "text",
                "text": response.choices[0].message.content
            }]
        }
    except Exception as e:
        logger.error(f"Error in groq_chat: {str(e)}")
        return {
            "content": [{
                "type": "text",
                "text": f"Error: {str(e)}"
            }],
            "isError": True
        }

@app.call_tool()
async def groq_completion(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Text completion with Groq
    """
    completion_request = GroqCompletionRequest(**request)
    
    try:
        groq_client = get_groq_client()
        response = groq_client.completions.create(
            model=completion_request.model,
            prompt=completion_request.prompt,
            max_tokens=completion_request.max_tokens,
            temperature=completion_request.temperature
        )
        
        return {
            "content": [{
                "type": "text",
                "text": response.choices[0].text
            }]
        }
    except Exception as e:
        logger.error(f"Error in groq_completion: {str(e)}")
        return {
            "content": [{
                "type": "text",
                "text": f"Error: {str(e)}"
            }],
            "isError": True
        }

@app.call_tool()
async def groq_available_models() -> Dict[str, Any]:
    """
    List available Groq models
    """
    models = [
        "llama3-8b-8192",
        "llama3-70b-8192", 
        "mixtral-8x7b-32768",
        "gemma-7b-it",
        "gemma2-9b-it"
    ]
    
    return {
        "content": [{
            "type": "text",
            "text": json.dumps(models, indent=2)
        }]
    }

@app.list_tools()
async def list_tools() -> list[dict]:
    """List available tools."""
    return [
        {
            "name": "groq_chat",
            "description": "Chat completion using Groq API",
            "input_schema": {
                "type": "object",
                "properties": {
                    "messages": {
                        "type": "array",
                        "description": "List of messages in the conversation",
                        "items": {
                            "type": "object",
                            "properties": {
                                "role": {"type": "string", "enum": ["user", "assistant", "system"]},
                                "content": {"type": "string"}
                            }
                        }
                    },
                    "model": {
                        "type": "string",
                        "description": "Model to use",
                        "default": "llama3-8b-8192"
                    },
                    "max_tokens": {
                        "type": "integer",
                        "description": "Maximum tokens to generate",
                        "default": 1024
                    },
                    "temperature": {
                        "type": "number",
                        "description": "Temperature for generation",
                        "default": 0.7
                    }
                },
                "required": ["messages"]
            }
        },
        {
            "name": "groq_completion",
            "description": "Text completion using Groq API",
            "input_schema": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Text prompt for completion"
                    },
                    "model": {
                        "type": "string",
                        "description": "Model to use",
                        "default": "llama3-8b-8192"
                    },
                    "max_tokens": {
                        "type": "integer",
                        "description": "Maximum tokens to generate",
                        "default": 1024
                    },
                    "temperature": {
                        "type": "number",
                        "description": "Temperature for generation",
                        "default": 0.7
                    }
                },
                "required": ["prompt"]
            }
        },
        {
            "name": "groq_available_models",
            "description": "List available Groq models",
            "input_schema": {
                "type": "object",
                "properties": {}
            }
        }
    ]

async def main():
    """Main entry point for the MCP server."""
    # Check for API key
    if not os.environ.get("GROQ_API_KEY"):
        print("Error: GROQ_API_KEY environment variable not set")
        sys.exit(1)
    
    async with stdio_server() as streams:
        await app.run(*streams)

if __name__ == "__main__":
    asyncio.run(main())