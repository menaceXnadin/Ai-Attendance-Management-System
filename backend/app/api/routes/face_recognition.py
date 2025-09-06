from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, Date
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.models import Student, AttendanceRecord, Subject
from app.schemas import (
    FaceRecognitionRequest, FaceRecognitionResponse, FaceRegistrationRequest,
    MultiImageFaceRegistrationRequest,
    AttendanceRecord as AttendanceRecordSchema
)
from app.services.insightface_service import insightface_service
from app.api.dependencies import get_current_student
from pydantic import BaseModel

# New schema for glasses detection
class GlassesDetectionRequest(BaseModel):
    image_data: str  # Base64 encoded image

class GlassesDetectionResponse(BaseModel):
    success: bool
    message: str
    glasses_detected: Optional[bool] = None
    confidence: Optional[float] = None
    all_attributes: Optional[dict] = None

router = APIRouter(prefix="/face-recognition", tags=["face-recognition"])

@router.post("/mark-attendance", response_model=FaceRecognitionResponse)
async def mark_attendance_with_face(
    recognition_data: FaceRecognitionRequest,
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student)
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
            # Ensure the recognized face matches the authenticated student
            if recognition_result.student_id != current_student.id:
                return FaceRecognitionResponse(
                    success=False,
                    message="Face does not match the current logged-in user.",
                    attendance_marked=False
                )

            # Check if attendance already marked today for this subject
            today = datetime.now().date()
            existing_record = await db.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.student_id == recognition_result.student_id,
                    AttendanceRecord.subject_id == recognition_data.subject_id,
                    AttendanceRecord.date == today
                )
            )
            
            if existing_record.scalar_one_or_none():
                return FaceRecognitionResponse(
                    success=False,
                    message="Attendance already marked for today",
                    attendance_marked=False
                )
            
            # Create attendance record with proper fields
            current_time = datetime.now()
            attendance = AttendanceRecord(
                student_id=recognition_result.student_id,
                subject_id=recognition_data.subject_id,  # Critical: Link to specific subject
                date=today,  # Date only
                time_in=current_time,  # Time when attendance was marked
                time_out=None,  # Will be filled when student leaves (optional)
                status="present",
                method="face",  # Use face method for facial recognition
                confidence_score=recognition_result.confidence_score,
                location="Face Recognition System",  # Indicate it was marked via face recognition
                notes=f"Face recognition confidence: {recognition_result.confidence_score:.2f}%, Marked via self-service attendance system",
                marked_by=current_student.user_id  # Reference to the student's user ID who marked their own attendance
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

@router.post("/verify-identity")
async def verify_identity(
    request: FaceRegistrationRequest,
    current_student: Student = Depends(get_current_student)
):
    """Verify that the provided face image matches the currently authenticated student."""
    try:
        if current_student.face_encoding is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No registered face found for the current user. Please register your face first."
            )

        # Decode and extract embedding for the provided image
        image = insightface_service.decode_base64_image(request.image_data)
        face_info = insightface_service.extract_face_features(image)

        if not face_info:
            return {
                "matched": False,
                "confidence_score": 0.0,
                "message": "No clear face detected."
            }

        if face_info['confidence'] < insightface_service.confidence_threshold:
            return {
                "matched": False,
                "confidence_score": 0.0,
                "message": f"Face detection confidence too low ({face_info['confidence']:.2f})."
            }

        unknown_embedding = face_info['embedding']
        is_match, similarity_score, _ = insightface_service.compare_embeddings(
            [current_student.face_encoding], unknown_embedding
        )

        return {
            "matched": is_match,
            "confidence_score": similarity_score,
            "message": "Identity verified" if is_match else f"Face does not match (similarity: {similarity_score:.1f}%)."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verifying identity: {str(e)}"
        )

@router.post("/register-face")
async def register_student_face(
    request: FaceRegistrationRequest,
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """
    Register student's face using backend-only processing.
    Supports both single image and multiple image registration.
    """
    try:
        print(f"[DEBUG] 🎯 Starting face registration for student ID: {current_student.id}")
        
        # Handle both single image and multiple images
        if isinstance(request.image_data, list):
            # Multiple images provided
            print(f"[DEBUG] 📷 Processing {len(request.image_data)} images")
            registration_result = insightface_service.process_multi_image_face_registration(request.image_data)
        else:
            # Single image provided (backward compatibility)
            print(f"[DEBUG] 📷 Processing single image")
            registration_result = insightface_service.process_face_registration(request.image_data)
        
        print(f"[DEBUG] 📊 Registration result: {registration_result['success']}")
        print(f"[DEBUG] 📝 Message: {registration_result['message']}")
        
        # Check if processing was successful
        if not registration_result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=registration_result['message']
            )
        
        # Extract face encoding from result
        face_encoding = registration_result['encoding']
        
        if not face_encoding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract face features from image(s)"
            )
        
        # Update student's face embedding in database
        print("[DEBUG] 💾 Updating student face embedding in database...")
        current_student.face_encoding = face_encoding
        await db.commit()
        print("[DEBUG] ✅ Face embedding saved successfully")
        
        # Build response based on registration type
        if isinstance(request.image_data, list):
            # Multi-image response
            return {
                "success": True,
                "message": "🎉 Face registered successfully with multi-angle processing!",
                "details": {
                    "images_processed": registration_result.get('images_processed', 0),
                    "valid_images": registration_result.get('valid_images', 0),
                    "image_results": registration_result.get('image_results', []),
                    "composite_face_data": registration_result.get('composite_face_data', {}),
                    "processing_method": "multi_image_insightface"
                }
            }
        else:
            # Single image response (backward compatibility)
            face_data = registration_result.get('face_data', {})
            return {
                "success": True,
                "message": "🎉 Face registered successfully!",
                "details": {
                    "faces_detected": registration_result.get('faces_detected', 1),
                    "detection_confidence": face_data.get('confidence', 0),
                    "face_area_percentage": face_data.get('area_percentage', 0),
                    "embedding_dimensions": face_data.get('embedding_dimensions', 0),
                    "processing_method": "single_image_insightface"
                }
            }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] ❌ Exception in face registration: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing face registration: {str(e)}"
        )

@router.post("/register-face-multi")
async def register_student_face_multi(
    request: MultiImageFaceRegistrationRequest,
    current_student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """
    Register student's face using multiple images for enhanced accuracy.
    Dedicated endpoint for multi-image registration.
    """
    try:
        print(f"[DEBUG] 🎯 Starting multi-image face registration for student ID: {current_student.id}")
        print(f"[DEBUG] 📷 Processing {len(request.images)} images")
        
        # Process multiple images
        registration_result = insightface_service.process_multi_image_face_registration(request.images)
        
        print(f"[DEBUG] 📊 Registration result: {registration_result['success']}")
        print(f"[DEBUG] 📝 Valid images: {registration_result.get('valid_images', 0)}/{registration_result.get('images_processed', 0)}")
        
        # Check if processing was successful
        if not registration_result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=registration_result['message']
            )
        
        # Extract face encoding from result
        face_encoding = registration_result['encoding']
        
        if not face_encoding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract face features from any of the provided images"
            )
        
        # Update student's face embedding in database
        print("[DEBUG] 💾 Updating student face embedding in database...")
        current_student.face_encoding = face_encoding
        await db.commit()
        print("[DEBUG] ✅ Multi-image face embedding saved successfully")
        
        return {
            "success": True,
            "message": "🎉 Face registered successfully with multi-angle processing!",
            "details": {
                "images_processed": registration_result.get('images_processed', 0),
                "valid_images": registration_result.get('valid_images', 0),
                "image_results": registration_result.get('image_results', []),
                "composite_face_data": registration_result.get('composite_face_data', {}),
                "processing_method": "multi_image_insightface",
                "enhancement": "Multi-angle face profile provides better recognition accuracy"
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] ❌ Exception in multi-image face registration: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing multi-image face registration: {str(e)}"
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
                "99.86% accuracy (vs 99.38% for legacy library)",
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
        return {
            "success": False,
            "message": f"Error analyzing face: {str(e)}",
            "faces_detected": 0,
            "faces": [],
            "feedback": "Error occurred during analysis",
            "ready_for_capture": False
        }

@router.post("/detect-glasses", response_model=GlassesDetectionResponse)
async def detect_glasses(request: GlassesDetectionRequest):
    """
    Detect if a person is wearing glasses using InsightFace.
    This is a more accurate alternative to frontend computer vision.
    """
    try:
        if not insightface_service:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Face recognition service not available"
            )
        
        # Decode and analyze the image
        image = insightface_service.decode_base64_image(request.image_data)
        detected_faces = insightface_service.detect_faces(image)
        
        if len(detected_faces) == 0:
            return GlassesDetectionResponse(
                success=False,
                message="No face detected in the image",
                glasses_detected=None
            )
        
        if len(detected_faces) > 1:
            return GlassesDetectionResponse(
                success=False,
                message=f"Multiple faces detected ({len(detected_faces)}). Please ensure only one person is visible.",
                glasses_detected=None
            )
        
        # Get the face data
        face_data = detected_faces[0]
        
        # Check if glasses attribute is available
        glasses_value = face_data.get('glasses', None)
        
        if glasses_value is None:
            return GlassesDetectionResponse(
                success=False,
                message="Glasses detection not supported by current InsightFace model",
                glasses_detected=None,
                all_attributes={
                    'age': face_data.get('age'),
                    'gender': face_data.get('gender'),
                    'confidence': face_data.get('confidence')
                }
            )
        
        # InsightFace glasses values: 0 = no glasses, 1 = glasses
        glasses_detected = glasses_value == 1
        
        return GlassesDetectionResponse(
            success=True,
            message=f"Glasses detection completed. {'Glasses detected' if glasses_detected else 'No glasses detected'}",
            glasses_detected=glasses_detected,
            confidence=face_data.get('confidence', 0.0),
            all_attributes={
                'age': face_data.get('age'),
                'gender': face_data.get('gender'), 
                'glasses': glasses_value,
                'confidence': face_data.get('confidence'),
                'bbox': face_data.get('bbox')
            }
        )
        
    except Exception as e:
        return GlassesDetectionResponse(
            success=False,
            message=f"Error detecting glasses: {str(e)}",
            glasses_detected=None
        )
    
    except Exception as e:
        print(f"[ERROR] ❌ Face detection error: {str(e)}")
        return {
            "success": False,
            "message": "Error processing image",
            "faces_detected": 0,
            "faces": [],
            "feedback": "Try capturing a new image"
        }
