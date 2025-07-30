from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, Date
from datetime import datetime, date
from typing import List
from app.core.database import get_db
from app.models import Student, AttendanceRecord, Subject
from app.schemas import (
    FaceRecognitionRequest, FaceRecognitionResponse, FaceRegistrationRequest,
    AttendanceRecord as AttendanceRecordSchema
)
from app.services.insightface_service import insightface_service
from app.api.dependencies import get_current_student

router = APIRouter(prefix="/face-recognition", tags=["face-recognition"])

@router.post("/mark-attendance", response_model=FaceRecognitionResponse)
async def mark_attendance_with_face(
    recognition_data: FaceRecognitionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Mark attendance using face recognition."""
    try:
        # Get all registered students with face encodings
        result = await db.execute(
            select(Student).where(Student.face_encoding.isnot(None))
        )
        students = result.scalars().all()
        
        if not students:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No registered students found"
            )
        
        # Prepare known encodings
        known_encodings = [
            (student.id, student.face_encoding) 
            for student in students 
            if student.face_encoding
        ]
        
        # Process face recognition with InsightFace
        recognition_result = insightface_service.process_attendance_image(
            recognition_data.image_data,
            known_encodings
        )
        
        if recognition_result.success and recognition_result.student_id:
            # Check if attendance already marked today for this subject
            today = datetime.now().date()
            existing_record = await db.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.student_id == recognition_result.student_id,
                    AttendanceRecord.subject_id == recognition_data.subject_id,
                    AttendanceRecord.date.cast(Date) == today
                )
            )
            
            if existing_record.scalar_one_or_none():
                return FaceRecognitionResponse(
                    success=False,
                    message="Attendance already marked for today",
                    attendance_marked=False
                )
            
            # Create attendance record
            attendance = AttendanceRecord(
                student_id=recognition_result.student_id,
                subject_id=recognition_data.subject_id,
                date=datetime.now(),
                status="present",
                confidence_score=recognition_result.confidence_score,
                marked_by="face_recognition"
            )
            
            db.add(attendance)
            await db.commit()
            
            recognition_result.attendance_marked = True
            recognition_result.message = "Attendance marked successfully!"
        
        return recognition_result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing face recognition: {str(e)}"
        )

@router.post("/register-face")
async def register_student_face(
    request: FaceRegistrationRequest,
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """
    Register student's face using backend-only processing.
    Handles face detection, validation, and encoding extraction on the server.
    """
    try:
        print(f"[DEBUG] 🎯 Starting backend-only face registration for student ID: {current_student.id}")
        print(f"[DEBUG] 📷 Image data length: {len(request.image_data)}")
        
        # Process face registration with comprehensive backend handling
        print("[DEBUG] 🤖 Processing face registration with InsightFace...")
        registration_result = insightface_service.process_face_registration(request.image_data)
        
        print(f"[DEBUG] 📊 Registration result: {registration_result['success']}")
        print(f"[DEBUG] 📝 Message: {registration_result['message']}")
        print(f"[DEBUG] 👥 Faces detected: {registration_result['faces_detected']}")
        
        # Check if processing was successful
        if not registration_result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=registration_result['message']
            )
        
        # Extract face encoding from result
        face_encoding = registration_result['encoding']
        face_data = registration_result['face_data']
        
        if not face_encoding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract face features from image"
            )
        
        # Update student's face embedding in database
        print("[DEBUG] 💾 Updating student face embedding in database...")
        current_student.face_encoding = face_encoding
        await db.commit()
        print("[DEBUG] ✅ Face embedding saved successfully")
        
        # Return comprehensive success response
        return {
            "success": True,
            "message": "🎉 Face registered successfully with backend processing!",
            "details": {
                "faces_detected": registration_result['faces_detected'],
                "detection_confidence": face_data['confidence'],
                "face_area_percentage": face_data['area_percentage'],
                "embedding_dimensions": face_data['embedding_dimensions'],
                "processing_method": "backend_insightface"
            }
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions with details
        raise
    except Exception as e:
        print(f"[ERROR] ❌ Exception in face registration: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing face registration: {str(e)}"
        )

@router.get("/my-attendance", response_model=List[AttendanceRecordSchema])
async def get_my_attendance(
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """Get current student's attendance records."""
    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.student_id == current_student.id)
        .order_by(AttendanceRecord.date.desc())
        .limit(50)
    )
    
    attendance_records = result.scalars().all()
    return [AttendanceRecordSchema.from_orm(record) for record in attendance_records]

@router.post("/verify-face")
async def verify_face_image(request: FaceRegistrationRequest):
    """Verify if image contains a valid face for registration."""
    try:
        # Decode image
        image = insightface_service.decode_base64_image(request.image_data)
        # Detect faces
        detected_faces = insightface_service.detect_faces(image)
        if len(detected_faces) == 0:
            return {
                "valid": False,
                "faces_detected": 0,
                "message": "No face detected in the image. Please ensure your face is clearly visible.",
                "feedback": "Move closer to camera or improve lighting"
            }
        if len(detected_faces) > 1:
            return {
                "valid": False,
                "faces_detected": len(detected_faces),
                "message": f"Multiple faces detected ({len(detected_faces)}). Please ensure only one person is visible.",
                "feedback": "Multiple people detected - ensure only you are visible"
            }
        # Single face detected - validate quality
        face_data = detected_faces[0]
        is_valid, validation_message = insightface_service.validate_face_quality(image, face_data)
        area_percentage = (face_data['area'] / (image.shape[0] * image.shape[1])) * 100
        feedback = []
        if face_data['confidence'] < 0.7:
            feedback.append("Improve lighting for better detection")
        if area_percentage < 10:
            feedback.append("Move closer to camera")
        elif area_percentage > 60:
            feedback.append("Move back from camera")
        if not feedback and is_valid:
            feedback.append("Perfect! Ready for verification")
        return {
            "valid": is_valid,
            "faces_detected": 1,
            "message": validation_message,
            "face": {
                "bbox": face_data['bbox'],
                "confidence": face_data['confidence'],
                "width": face_data['width'],
                "height": face_data['height'],
                "area_percentage": area_percentage
            },
            "feedback": " • ".join(feedback)
        }
    except Exception as e:
        return {
            "valid": False,
            "faces_detected": 0,
            "message": f"Error processing image: {str(e)}",
            "feedback": "Try capturing a new image"
        }

@router.get("/service-status")
async def get_face_recognition_service_status():
    """Get InsightFace service status and model information."""
    try:
        if insightface_service is None:
            return {
                "status": "error",
                "message": "InsightFace service not initialized",
                "service": "insightface",
                "models": {}
            }
        
        model_info = insightface_service.get_model_info()
        
        return {
            "status": "active",
            "message": "InsightFace service running successfully",
            "service": "insightface",
            "models": model_info,
            "advantages": [
                "99.86% accuracy (vs 99.38% for face_recognition)",
                "2-3x faster inference speed",
                "Better handling of lighting variations",
                "More robust to face angles",
                "GPU acceleration support"
            ]
        }
    
    except Exception as e:
        return {
            "status": "error",
            "message": f"Service check failed: {str(e)}",
            "service": "insightface",
            "models": {}
        }

@router.post("/detect-faces")
async def detect_faces_in_image(request: FaceRegistrationRequest):
    """
    Detect faces in image for real-time feedback.
    Returns face detection results without registration.
    """
    try:
        print(f"[DEBUG] 🔍 Real-time face detection requested")
        print(f"[DEBUG] 📷 Image data length: {len(request.image_data)}")
        
        # Decode image
        image = insightface_service.decode_base64_image(request.image_data)
        print(f"[DEBUG] 📷 Image decoded - Shape: {image.shape}")
        
        # Detect faces only
        detected_faces = insightface_service.detect_faces(image)
        
        if len(detected_faces) == 0:
            return {
                "success": False,
                "message": "No face detected. Please ensure your face is visible and well-lit.",
                "faces_detected": 0,
                "faces": [],
                "feedback": "Move closer to camera or improve lighting"
            }
        
        if len(detected_faces) > 1:
            return {
                "success": False,
                "message": f"Multiple faces detected ({len(detected_faces)}). Please ensure only one person is visible.",
                "faces_detected": len(detected_faces),
                "faces": [
                    {
                        "bbox": face['bbox'],
                        "confidence": face['confidence'],
                        "area": face['area']
                    }
                    for face in detected_faces
                ],
                "feedback": "Multiple people detected - ensure only you are visible"
            }
        
        # Single face detected - validate quality
        face_data = detected_faces[0]
        is_valid, validation_message = insightface_service.validate_face_quality(image, face_data)
        
        # Calculate feedback for user
        confidence = face_data['confidence']
        area_percentage = (face_data['area'] / (image.shape[0] * image.shape[1])) * 100
        
        feedback = []
        if confidence < 0.7:
            feedback.append("Improve lighting for better detection")
        if area_percentage < 10:
            feedback.append("Move closer to camera")
        elif area_percentage > 60:
            feedback.append("Move back from camera")
        if not feedback and is_valid:
            feedback.append("Perfect! Ready for capture")
        
        return {
            "success": is_valid,
            "message": validation_message,
            "faces_detected": 1,
            "faces": [{
                "bbox": face_data['bbox'],
                "confidence": face_data['confidence'],
                "width": face_data['width'],
                "height": face_data['height'],
                "area_percentage": area_percentage
            }],
            "feedback": " • ".join(feedback),
            "ready_for_capture": is_valid
        }
    
    except Exception as e:
        print(f"[ERROR] ❌ Face detection error: {str(e)}")
        return {
            "success": False,
            "message": "Error processing image",
            "faces_detected": 0,
            "faces": [],
            "feedback": "Try capturing a new image"
        }
