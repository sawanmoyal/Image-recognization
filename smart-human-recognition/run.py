"""
run.py — Entry point for the Smart Human Activity Recognition System.

Starts the Flask web application. Run from the project root:

    python run.py

Environment variables:
    PORT  — Port to listen on (default: 5000)
    HOST  — Host to bind (default: 0.0.0.0)
"""

import os
import sys

# Ensure webapp and project src are on the path
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "src"))
sys.path.insert(0, os.path.join(ROOT, "utils"))
sys.path.insert(0, os.path.join(ROOT, "webapp"))

from app import app

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Smart Human Activity Recognition System")
    print(f"Server: http://{host}:{port}")
    print(f"Stack : Python 3.10 | Flask | OpenCV | MediaPipe | PyTorch | Pandas")
    app.run(host=host, port=port, debug=False, threaded=True)
