#!/usr/bin/env python3
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7842

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()
    def log_message(self, *a): pass  # 조용히

with socketserver.TCPServer(('', PORT), NoCacheHandler) as s:
    s.serve_forever()
