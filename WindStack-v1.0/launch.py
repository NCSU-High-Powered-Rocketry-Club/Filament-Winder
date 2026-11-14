#!/usr/bin/env python3
"""
WindStack Launcher — Filament Winder Controller
Starts a local HTTP server and opens the application in your default browser.
Compatible with Windows, macOS, and Linux.
"""
import http.server
import socketserver
import webbrowser
import os
import sys
import threading

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def log_message(self, format, *args):
        # Suppress default logging for clean console
        pass

def main():
    print()
    print("  ╔═══════════════════════════════════════════════╗")
    print("  ║        WindStack - Filament Winder v1.0.1     ║")
    print("  ║         Composite Winding Controller          ║")
    print("  ╚═══════════════════════════════════════════════╝")
    print()
    
    # Try ports 8080-8089
    port = PORT
    server = None
    for p in range(PORT, PORT + 10):
        try:
            server = socketserver.TCPServer(("", p), Handler)
            port = p
            break
        except OSError:
            continue
    
    if server is None:
        print(f"  [ERROR] Could not find an available port ({PORT}-{PORT+9})")
        sys.exit(1)
    
    url = f"http://localhost:{port}"
    print(f"  Server running at: {url}")
    print(f"  Press Ctrl+C to stop")
    print()
    
    # Open browser after a brief delay
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
        server.shutdown()

if __name__ == "__main__":
    main()
