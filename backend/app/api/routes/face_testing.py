"""
Face Recognition Testing API Endpoints
=====================================

This module provides testing endpoints for face registration and verification
without time restrictions or authentication requirements.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import json
from datetime import datetime
import asyncio

from app.core.database import get_db
from app.models import Student
from app.services.insightface_service import insightface_service

logger = logging.getLogger(__name__)

# Testing schemas
class FaceTestRequest(BaseModel):
    image_data: str  # Base64 encoded image
    test_student_id: Optional[int] = None  # For testing specific student
    
class FaceTestResponse(BaseModel):
    success: bool
    message: str
    test_type: str
    details: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    student_id: Optional[int] = None
    processing_time_ms: Optional[float] = None

class BatchTestRequest(BaseModel):
    images: List[str]  # Multiple base64 images
    test_student_id: Optional[int] = None

router = APIRouter(prefix="/face-testing", tags=["face-testing"])

@router.get("/status")
async def get_testing_status():
    """Get face recognition testing service status."""
    try:
        if not insightface_service:
            return {
                "available": False,
                "message": "InsightFace service not initialized",
                "models": None
            }
        
        # Test basic functionality
        test_result = insightface_service.get_service_status()
        
        return {
            "available": True,
            "message": "Face testing service is ready",
            "insightface_status": test_result,
            "test_endpoints": [
                "/face-testing/register-test",
                "/face-testing/verify-test", 
                "/face-testing/detect-test",
                "/face-testing/compare-test",
                "/face-testing/batch-test"
            ]
        }
    except Exception as e:
        logger.error(f"Error checking testing status: {str(e)}")
        return {
            "available": False,
            "message": f"Error: {str(e)}",
            "models": None
        }

@router.post("/detect-test", response_model=FaceTestResponse)
async def test_face_detection(request: FaceTestRequest):
    """Test face detection functionality without registration."""
    start_time = datetime.now()
    
    try:
        logger.info("🔍 Testing face detection...")
        
        if not insightface_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Face recognition service not available"
            )
        
        # Decode and analyze image
        image = insightface_service.decode_base64_image(request.image_data)
        detected_faces = insightface_service.detect_faces(image)
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        if len(detected_faces) == 0:
            return FaceTestResponse(
                success=False,
                message="No faces detected in the image",
                test_type="detection",
                details={
                    "faces_count": 0,
                    "image_shape": list(image.shape),
                    "recommendations": [
                        "Ensure face is well-lit",
                        "Move closer to camera", 
                        "Check camera focus"
                    ]
                },
                processing_time_ms=processing_time
            )
        
        # Analyze face quality
        face_data = detected_faces[0]  # Use best face
        area_percentage = (face_data['area'] / (image.shape[0] * image.shape[1])) * 100
        
        quality_analysis = []
        if face_data['confidence'] >= 0.8:
            quality_analysis.append("Excellent face detection confidence")
        elif face_data['confidence'] >= 0.6:
            quality_analysis.append("Good face detection confidence")
        else:
            quality_analysis.append("Low face detection confidence - improve lighting")
            
        if area_percentage >= 15:
            quality_analysis.append("Good face size in frame")
        elif area_percentage >= 8:
            quality_analysis.append("Acceptable face size")
        else:
            quality_analysis.append("Face too small - move closer")
        
        return FaceTestResponse(
            success=True,
            message=f"Detected {len(detected_faces)} face(s) successfully",
            test_type="detection",
            details={
                "faces_count": len(detected_faces),
                "primary_face": {
                    "confidence": face_data['confidence'],
                    "bbox": face_data['bbox'],
                    "area_percentage": area_percentage,
                    "dimensions": f"{face_data['width']}x{face_data['height']}"
                },
                "all_faces": [
                    {
                        "confidence": f['confidence'],
                        "area_percentage": (f['area'] / (image.shape[0] * image.shape[1])) * 100
                    }
                    for f in detected_faces
                ],
                "quality_analysis": quality_analysis,
                "image_info": {
                    "shape": list(image.shape),
                    "total_pixels": image.shape[0] * image.shape[1]
                }
            },
            confidence_score=face_data['confidence'],
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.error(f"Error in face detection test: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face detection test failed: {str(e)}"
        )

@router.post("/register-test", response_model=FaceTestResponse)
async def test_face_registration(request: FaceTestRequest):
    """Test face registration functionality without saving to database."""
    start_time = datetime.now()
    
    try:
        logger.info("📝 Testing face registration...")
        
        if not insightface_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Face recognition service not available"
            )
        
        # Process registration (without saving)
        registration_result = insightface_service.process_face_registration(request.image_data)
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return FaceTestResponse(
            success=registration_result['success'],
            message=registration_result['message'],
            test_type="registration",
            details={
                "faces_detected": registration_result.get('faces_detected', 0),
                "face_data": registration_result.get('face_data'),
                "encoding_generated": registration_result.get('encoding') is not None,
                "encoding_dimensions": len(registration_result.get('encoding', [])) if registration_result.get('encoding') else 0,
                "validation_passed": registration_result['success'],
                "processing_steps": [
                    "Image decoded successfully",
                    f"Faces detected: {registration_result.get('faces_detected', 0)}",
                    "Face quality validated" if registration_result['success'] else "Face quality validation failed",
                    "Face encoding generated" if registration_result.get('encoding') else "No encoding generated"
                ]
            },
            confidence_score=registration_result.get('face_data', {}).get('confidence') if registration_result.get('face_data') else None,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.error(f"Error in face registration test: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face registration test failed: {str(e)}"
        )

@router.post("/verify-test", response_model=FaceTestResponse)
async def test_face_verification(
    request: FaceTestRequest,
    db: AsyncSession = Depends(get_db)
):
    """Test face verification against registered students."""
    start_time = datetime.now()
    
    try:
        logger.info("🔍 Testing face verification...")
        
        if not insightface_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Face recognition service not available"
            )
        
        # Get students with face encodings
        if request.test_student_id:
            # Test against specific student
            result = await db.execute(
                select(Student).where(
                    Student.id == request.test_student_id,
                    Student.face_encoding.isnot(None)
                )
            )
            test_students = result.scalars().all()
            test_mode = f"specific student ID {request.test_student_id}"
        else:
            # Test against all registered students
            result = await db.execute(
                select(Student).where(Student.face_encoding.isnot(None))
            )
            test_students = result.scalars().all()
            test_mode = "all registered students"
        
        if not test_students:
            return FaceTestResponse(
                success=False,
                message=f"No students with registered faces found for {test_mode}",
                test_type="verification",
                details={
                    "registered_students_count": 0,
                    "test_mode": test_mode
                },
                processing_time_ms=(datetime.now() - start_time).total_seconds() * 1000
            )
        
        # Prepare known encodings
        known_encodings = [
            (student.id, student.face_encoding) 
            for student in test_students 
            if student.face_encoding
        ]
        
        # Process verification
        recognition_result = insightface_service.process_attendance_image(
            request.image_data,
            known_encodings
        )
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Get matched student info if found
        matched_student_info = None
        if recognition_result.success and recognition_result.student_id:
            matched_student = next(
                (s for s in test_students if s.id == recognition_result.student_id), 
                None
            )
            if matched_student:
                matched_student_info = {
                    "id": matched_student.id,
                    "registration_number": matched_student.registration_number,
                    "name": f"{matched_student.first_name} {matched_student.last_name}",
                    "email": matched_student.email
                }
        
        return FaceTestResponse(
            success=recognition_result.success,
            message=recognition_result.message,
            test_type="verification",
            details={
                "test_mode": test_mode,
                "registered_students_count": len(test_students),
                "matched_student": matched_student_info,
                "confidence_threshold": 80.0,  # Threshold used for matching
                "all_similarities": [],  # Could add detailed similarity scores
                "verification_steps": [
                    f"Tested against {len(test_students)} registered students",
                    "Face detected and extracted" if recognition_result.success or recognition_result.confidence_score else "Face detection failed",
                    f"Best match: {recognition_result.confidence_score:.1f}%" if recognition_result.confidence_score else "No confidence score",
                    "Match found" if recognition_result.success else "No match found"
                ]
            },
            confidence_score=recognition_result.confidence_score,
            student_id=recognition_result.student_id,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.error(f"Error in face verification test: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face verification test failed: {str(e)}"
        )

@router.post("/compare-test", response_model=FaceTestResponse)
async def test_face_comparison(request: FaceTestRequest):
    """Test face comparison between two encodings (requires 2 images in batch)."""
    start_time = datetime.now()
    
    try:
        logger.info("⚖️ Testing face comparison...")
        
        if not insightface_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Face recognition service not available"
            )
        
        # This endpoint expects image_data to contain JSON with two images
        try:
            images_data = json.loads(request.image_data)
            if not isinstance(images_data, dict) or 'image1' not in images_data or 'image2' not in images_data:
                raise ValueError("Expected JSON with 'image1' and 'image2' fields")
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid format. Expected JSON with 'image1' and 'image2' base64 strings"
            )
        
        # Process both images
        result1 = insightface_service.process_face_registration(images_data['image1'])
        result2 = insightface_service.process_face_registration(images_data['image2'])
        
        if not result1['success']:
            return FaceTestResponse(
                success=False,
                message=f"First image failed: {result1['message']}",
                test_type="comparison",
                processing_time_ms=(datetime.now() - start_time).total_seconds() * 1000
            )
        
        if not result2['success']:
            return FaceTestResponse(
                success=False,
                message=f"Second image failed: {result2['message']}",
                test_type="comparison",
                processing_time_ms=(datetime.now() - start_time).total_seconds() * 1000
            )
        
        # Compare encodings
        encoding1 = result1['encoding']
        encoding2 = result2['encoding']
        
        is_match, similarity_score, _ = insightface_service.compare_embeddings([encoding1], encoding2)
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return FaceTestResponse(
            success=True,
            message=f"Comparison completed - {'MATCH' if is_match else 'NO MATCH'} ({similarity_score:.1f}%)",
            test_type="comparison",
            details={
                "is_match": is_match,
                "similarity_threshold": 80.0,
                "image1_confidence": result1['face_data']['confidence'],
                "image2_confidence": result2['face_data']['confidence'],
                "encoding_dimensions": len(encoding1),
                "comparison_steps": [
                    "Both images processed successfully",
                    "Face encodings extracted",
                    f"Similarity calculated: {similarity_score:.1f}%",
                    f"Match result: {'YES' if is_match else 'NO'}"
                ]
            },
            confidence_score=similarity_score,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.error(f"Error in face comparison test: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face comparison test failed: {str(e)}"
        )

@router.post("/batch-test")
async def test_batch_processing(
    request: BatchTestRequest,
    db: AsyncSession = Depends(get_db)
):
    """Test batch processing of multiple images."""
    start_time = datetime.now()
    
    try:
        logger.info(f"📦 Testing batch processing with {len(request.images)} images...")
        
        if not insightface_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Face recognition service not available"
            )
        
        if len(request.images) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 10 images allowed per batch test"
            )
        
        # Process each image
        results = []
        successful_registrations = 0
        
        for i, image_data in enumerate(request.images):
            try:
                result = insightface_service.process_face_registration(image_data)
                results.append({
                    "image_index": i + 1,
                    "success": result['success'],
                    "message": result['message'],
                    "confidence": result.get('face_data', {}).get('confidence') if result.get('face_data') else None,
                    "faces_detected": result.get('faces_detected', 0)
                })
                if result['success']:
                    successful_registrations += 1
            except Exception as e:
                results.append({
                    "image_index": i + 1,
                    "success": False,
                    "message": f"Processing error: {str(e)}",
                    "confidence": None,
                    "faces_detected": 0
                })
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return {
            "success": successful_registrations > 0,
            "message": f"Batch processing completed: {successful_registrations}/{len(request.images)} successful",
            "test_type": "batch",
            "details": {
                "total_images": len(request.images),
                "successful_registrations": successful_registrations,
                "failed_registrations": len(request.images) - successful_registrations,
                "results": results,
                "average_processing_time_per_image": processing_time / len(request.images)
            },
            "processing_time_ms": processing_time
        }
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.error(f"Error in batch processing test: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch processing test failed: {str(e)}"
        )

@router.get("/registered-students")
async def get_registered_students_info(db: AsyncSession = Depends(get_db)):
    """Get information about students with registered faces for testing."""
    try:
        # Get students with face encodings
        result = await db.execute(
            select(Student).where(Student.face_encoding.isnot(None))
        )
        students = result.scalars().all()
        
        students_info = []
        for student in students:
            students_info.append({
                "id": student.id,
                "registration_number": student.registration_number,
                "name": f"{student.first_name} {student.last_name}",
                "email": student.email,
                "has_face_encoding": student.face_encoding is not None,
                "encoding_length": len(student.face_encoding) if student.face_encoding else 0
            })
        
        return {
            "success": True,
            "total_registered": len(students_info),
            "students": students_info
        }
        
    except Exception as e:
        logger.error(f"Error getting registered students: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving registered students: {str(e)}"
        )

@router.delete("/clear-test-data")
async def clear_test_data(db: AsyncSession = Depends(get_db)):
    """Clear test face data (use with caution!)."""
    try:
        # This is a destructive operation - only for testing
        logger.warning("🚨 CLEARING ALL FACE ENCODINGS - TESTING ONLY!")
        
        # Update all students to remove face encodings
        await db.execute(
            text("UPDATE students SET face_encoding = NULL WHERE face_encoding IS NOT NULL")
        )
        await db.commit()
        
        return {
            "success": True,
            "message": "All face encodings cleared from database",
            "warning": "This action cannot be undone"
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error clearing test data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing test data: {str(e)}"
        )