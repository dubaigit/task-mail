#!/bin/bash

# Start backend server with project root on PYTHONPATH
cd backend && PYTHONPATH="$(cd ../..; pwd)" python main.py & 

# Start frontend development server
cd frontend && npm start &

wait