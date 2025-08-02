import asyncio
import time
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from datetime import datetime
import psutil
import os

class ServiceHealthChecker:
    """Performs real health checks on various services"""
    
    @staticmethod
    async def check_database_health(db: AsyncSession) -> Dict[str, Any]:
        """Check database connectivity and performance"""
        try:
            start_time = time.time()
            
            # Test basic connectivity
            await db.execute(select(1))
            
            # Test a more complex query
            await db.execute(text("SELECT COUNT(*) FROM pg_stat_activity"))
            
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)
            
            return {
                "status": "healthy",
                "response_time_ms": response_time,
                "last_check": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "response_time_ms": 0,
                "error": str(e),
                "last_check": datetime.now().isoformat()
            }
    
    @staticmethod
    async def check_face_recognition_service() -> Dict[str, Any]:
        pass
    @staticmethod
    async def check_file_system_health() -> Dict[str, Any]:
        """Check file system health and permissions"""
        try:
            # Check if uploads directory exists and is writable
            uploads_dir = "uploads"
            
            if not os.path.exists(uploads_dir):
                os.makedirs(uploads_dir, exist_ok=True)
            
            # Test write permissions
            test_file = os.path.join(uploads_dir, "health_test.txt")
            
            start_time = time.time()
            with open(test_file, 'w') as f:
                f.write("health check")
            
            # Test read permissions
            with open(test_file, 'r') as f:
                content = f.read()
            
            # Clean up
            os.remove(test_file)
            end_time = time.time()
            
            response_time = round((end_time - start_time) * 1000, 2)
            
            return {
                "status": "healthy",
                "response_time_ms": response_time,
                "writable": True,
                "last_check": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "writable": False,
                "last_check": datetime.now().isoformat()
            }
    
    @staticmethod
    async def check_memory_health() -> Dict[str, Any]:
        """Check system memory health"""
        try:
            memory = psutil.virtual_memory()
            
            # Consider memory unhealthy if over 90% usage
            status = "healthy" if memory.percent < 90 else "unhealthy"
            
            return {
                "status": status,
                "usage_percent": round(memory.percent, 1),
                "available_gb": round(memory.available / (1024**3), 2),
                "total_gb": round(memory.total / (1024**3), 2),
                "last_check": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.now().isoformat()
            }
    
    @staticmethod
    async def check_cpu_health() -> Dict[str, Any]:
        """Check CPU health"""
        try:
            # Get CPU usage over 1 second
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Consider CPU unhealthy if consistently over 90%
            status = "healthy" if cpu_percent < 90 else "unhealthy"
            
            return {
                "status": status,
                "usage_percent": round(cpu_percent, 1),
                "core_count": psutil.cpu_count(),
                "last_check": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.now().isoformat()
            }
    
    @staticmethod
    async def perform_comprehensive_health_check(db: AsyncSession) -> Dict[str, Any]:
        """Perform health checks on all services"""
        try:
            # Run all health checks concurrently
            results = await asyncio.gather(
                ServiceHealthChecker.check_database_health(db),
                ServiceHealthChecker.check_file_system_health(),
                ServiceHealthChecker.check_memory_health(),
                ServiceHealthChecker.check_cpu_health(),
                return_exceptions=True
            )
            
            database_health, face_health, fs_health, memory_health, cpu_health = results
            # Determine overall system health
            all_services = [database_health, face_health, fs_health, memory_health, cpu_health]
            healthy_services = sum(1 for service in all_services if isinstance(service, dict) and service.get('status') == 'healthy')
            total_services = len(all_services)
            
            overall_status = "healthy" if healthy_services == total_services else "degraded" if healthy_services > total_services // 2 else "unhealthy"
            
            return {
                "overall_status": overall_status,
                "services": {
                    "database": database_health if isinstance(database_health, dict) else {"status": "error", "error": str(database_health)},
                    "face_recognition": face_health if isinstance(face_health, dict) else {"status": "error", "error": str(face_health)},
                    "memory": memory_health if isinstance(memory_health, dict) else {"status": "error", "error": str(memory_health)},
                    "cpu": cpu_health if isinstance(cpu_health, dict) else {"status": "error", "error": str(cpu_health)}
                },
                "health_score": round((healthy_services / total_services) * 100, 1),
                "last_check": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "overall_status": "error",
                "error": str(e),
                "health_score": 0,
                "last_check": datetime.now().isoformat()
            } 