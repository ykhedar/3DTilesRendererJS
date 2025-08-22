#!/usr/bin/env python3
"""
Simple HTTP server with CORS support.
Usage: python cors_server.py [port]
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3001
    server_address = ('', port)
    
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f"Server running on http://127.0.0.1:{port}/")
    print("CORS headers enabled - allowing all origins")
    httpd.serve_forever()