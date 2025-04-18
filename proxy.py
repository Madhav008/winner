from http.server import HTTPServer, BaseHTTPRequestHandler

class RequestLoggerHandler(BaseHTTPRequestHandler):
    def do_ANY(self):
        self.log_request_info()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Request received and logged.\n")

    def log_request_info(self):
        print("\n----- Incoming Request -----")
        print(f"{self.command} {self.path} {self.request_version}")
        for key, value in self.headers.items():
            print(f"{key}: {value}")
        if 'Content-Length' in self.headers:
            length = int(self.headers['Content-Length'])
            body = self.rfile.read(length)
            print("\nBody:")
            print(body.decode(errors="replace"))
        print("----- End of Request -----\n")

    # Handle all HTTP methods
    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_HEAD = do_ANY

    def log_message(self, format, *args):
        # Suppress default logging
        return

if __name__ == "__main__":
    server_address = ("", 8080)  # Change port if needed
    httpd = HTTPServer(server_address, RequestLoggerHandler)
    print("[*] HTTP Request Logger is running on port 8080...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Shutting down server.")
