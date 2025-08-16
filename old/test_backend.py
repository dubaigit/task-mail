#!/usr/bin/env python3
"""
Test script to verify backend starts without errors
"""

import sys
import os
import subprocess

def test_backend():
    """Test if the backend can start"""
    try:
        # Try to import the backend module
        print("Testing backend import...")
        import backend_architecture
        print("✓ Backend architecture imported successfully")
        
        # Test if the app object was created
        if hasattr(backend_architecture, 'app'):
            print("✓ FastAPI app object created successfully")
        else:
            print("✗ FastAPI app object not found")
            return False
            
        print("\nBackend startup test completed successfully!")
        print("You can now start the backend with:")
        print("  python backend_architecture.py")
        print("Or with uvicorn:")  
        print("  uvicorn backend_architecture:app --host 0.0.0.0 --port 8000 --reload")
        
        return True
        
    except ImportError as e:
        print(f"✗ Import error: {e}")
        print("Install missing dependencies with: pip install fastapi uvicorn")
        return False
    except Exception as e:
        print(f"✗ Error testing backend: {e}")
        return False

if __name__ == "__main__":
    success = test_backend()
    sys.exit(0 if success else 1)