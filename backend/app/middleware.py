import time
from typing import List
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from collections import deque
from datetime import datetime, timedelta


class ResponseTimeMiddleware(BaseHTTPMiddleware):
    """Middleware to track real API response times"""
    
    def __init__(self, app, max_samples: int = 100):
        super().__init__(app)
        self.response_times: deque = deque(maxlen=max_samples)  # Keep last 100 response times
        self.last_updated = datetime.now()
    
    async def dispatch(self, request: Request, call_next):
        # Skip monitoring for static files and health checks to avoid noise
        if request.url.path.startswith('/static') or request.url.path == '/health':
            return await call_next(request)
            
        start_time = time.time()
        
        # Process the request
        response = await call_next(request)
        
        # Calculate response time
        process_time = time.time() - start_time
        response_time_ms = round(process_time * 1000, 2)
        
        # Store response time with timestamp
        self.response_times.append({
            'time_ms': response_time_ms,
            'timestamp': datetime.now(),
            'endpoint': request.url.path,
            'method': request.method,
            'status_code': response.status_code
        })
        
        self.last_updated = datetime.now()
        
        # Add response time header for debugging
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
    
    def get_average_response_time(self, minutes: int = 5) -> float:
        """Get average response time for the last N minutes"""
        if not self.response_times:
            return 0.0
            
        cutoff_time = datetime.now() - timedelta(minutes=minutes)
        recent_times = [
            rt['time_ms'] for rt in self.response_times 
            if rt['timestamp'] >= cutoff_time
        ]
        
        if not recent_times:
            return 0.0
            
        return round(sum(recent_times) / len(recent_times), 2)
    
    def get_current_response_time(self) -> float:
        """Get the most recent response time"""
        if not self.response_times:
            return 0.0
        return self.response_times[-1]['time_ms']
    
    def get_response_time_stats(self) -> dict:
        """Get comprehensive response time statistics"""
        if not self.response_times:
            return {
                'average_5min': 0.0,
                'average_1min': 0.0,
                'current': 0.0,
                'min': 0.0,
                'max': 0.0,
                'total_requests': 0
            }
        
        # Get times for different periods
        now = datetime.now()
        one_min_ago = now - timedelta(minutes=1)
        five_min_ago = now - timedelta(minutes=5)
        
        all_times = [rt['time_ms'] for rt in self.response_times]
        one_min_times = [rt['time_ms'] for rt in self.response_times if rt['timestamp'] >= one_min_ago]
        five_min_times = [rt['time_ms'] for rt in self.response_times if rt['timestamp'] >= five_min_ago]
        
        return {
            'average_5min': round(sum(five_min_times) / len(five_min_times), 2) if five_min_times else 0.0,
            'average_1min': round(sum(one_min_times) / len(one_min_times), 2) if one_min_times else 0.0,
            'current': self.get_current_response_time(),
            'min': round(min(all_times), 2) if all_times else 0.0,
            'max': round(max(all_times), 2) if all_times else 0.0,
            'total_requests': len(self.response_times)
        }


# Global instance to be used across the app
response_time_tracker = ResponseTimeMiddleware(None) 