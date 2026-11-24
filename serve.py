#!/usr/bin/env python3
"""Local test server. Run:  python3 serve.py   (or: python3 serve.py 9000)

Serves this folder on your Wi-Fi so a phone on the same network can scan the QR code
and open the page. Stop with Ctrl+C."""
import http.server, os, socket, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))   # no packet is actually sent
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # always fresh while testing
        super().end_headers()


ip = lan_ip()
print(f"\n  Open this on your COMPUTER to make the QR code:\n      http://{ip}:{PORT}/qr.html\n")
print(f"  Then scan it with your PHONE (same Wi-Fi). Photo page: http://{ip}:{PORT}/\n")
print("  (Using localhost won't work for the phone - use the address above.)  Ctrl+C to stop.\n")
http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
