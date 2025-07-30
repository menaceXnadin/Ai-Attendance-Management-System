import cv2
import numpy as np
import face_recognition
import base64
from typing import Optional, List, Tuple
from io import BytesIO
from PIL import Image
from app.core.config import settings
from app.schemas import FaceRecognitionResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

class FaceRecognitionService:
    def __init__(self):
        self.tolerance = settings.face_recognition_tolerance
        self.model = settings.face_encoding_model
    
    def decode_base64_image(self, base64_string: str) -> np.ndarray:
        """Decode base64 string to OpenCV image."""
        try:
            # Remove data URL prefix if present
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            
            # Decode base64
            image_data = base64.b64decode(base64_string)
            
            # Convert to PIL Image
            pil_image = Image.open(BytesIO(image_data))
            
            # Convert to RGB (face_recognition expects RGB)
            rgb_image = pil_image.convert('RGB')
            
            # Convert to numpy array
            return np.array(rgb_image)
        
        except Exception as e:
            logger.error(f"Error decoding base64 image: {str(e)}")
            raise ValueError("Invalid image data")
    
    def extract_face_encoding(self, image: np.ndarray) -> Optional[List[float]]:
        """Extract face encoding from image."""
        try:
            # Find face locations
            face_locations = face_recognition.face_locations(image, model=self.model)
            
            if not face_locations:
                logger.warning("No face found in image")
                return None
            
            # Extract face encodings
            face_encodings = face_recognition.face_encodings(
                image, 
                face_locations, 
                model=self.model
            )
            
            if not face_encodings:
                logger.warning("Could not encode face")
                return None
            
            # Return the first face encoding
            return face_encodings[0].tolist()
        
        except Exception as e:
            logger.error(f"Error extracting face encoding: {str(e)}")
            return None
    
    def find_best_match_pgvector(
        self, 
        db: Session, 
        unknown_encoding: List[float], 
        threshold: float = 0.6
    ) -> Tuple[Optional[int], float]:
        """
        Find best matching student using pgvector similarity search.
        Much faster than comparing each face individually.
        """
        try:
            # Convert encoding to PostgreSQL vector format
            vector_str = f"[{','.join(map(str, unknown_encoding))}]"
            
            # Use cosine similarity to find closest match
            # Lower distance = higher similarity
            query = text("""
                SELECT id, 1 - (face_encoding <=> :query_vector) as similarity
                FROM students 
                WHERE face_encoding IS NOT NULL
                ORDER BY face_encoding <=> :query_vector
                LIMIT 1
            """)
            
            result = db.execute(query, {"query_vector": vector_str}).fetchone()
            
            if result and result.similarity >= threshold:
                return result.id, result.similarity * 100  # Convert to percentage
            
            return None, 0.0
            
        except Exception as e:
            logger.error(f"Error in pgvector face matching: {str(e)}")
            # Fallback to traditional method if pgvector fails
            return None, 0.0
    
    def compare_faces(
        self, 
        known_encodings: List[List[float]], 
        unknown_encoding: List[float]
    ) -> Tuple[bool, float]:
        """Compare unknown face with known faces (fallback method)."""
        try:
            if not known_encodings or not unknown_encoding:
                return False, 0.0
            
            # Convert to numpy arrays
            known_encodings_np = [np.array(encoding) for encoding in known_encodings]
            unknown_encoding_np = np.array(unknown_encoding)
            
            # Calculate face distances
            face_distances = face_recognition.face_distance(
                known_encodings_np, 
                unknown_encoding_np
            )
            
            # Find the best match
            best_match_index = np.argmin(face_distances)
            best_distance = face_distances[best_match_index]
            
            # Calculate confidence (inverse of distance)
            confidence = max(0, (1 - best_distance) * 100)
            
            # Check if match is within tolerance
            is_match = best_distance <= self.tolerance
            
            return is_match, confidence
        
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return False, 0.0
    
    def process_attendance_image(
        self, 
        base64_image: str, 
        known_student_encodings: List[Tuple[int, List[float]]]  # (student_id, encoding)
    ) -> FaceRecognitionResponse:
        """Process attendance image and return recognition result."""
        try:
            # Decode image
            image = self.decode_base64_image(base64_image)
            
            # Extract face encoding from uploaded image
            unknown_encoding = self.extract_face_encoding(image)
            
            if not unknown_encoding:
                return FaceRecognitionResponse(
                    success=False,
                    message="No face detected in the image. Please ensure your face is clearly visible.",
                    attendance_marked=False
                )
            
            # Compare with known student faces
            best_match_student_id = None
            best_confidence = 0.0
            
            for student_id, known_encoding in known_student_encodings:
                is_match, confidence = self.compare_faces([known_encoding], unknown_encoding)
                
                if is_match and confidence > best_confidence:
                    best_match_student_id = student_id
                    best_confidence = confidence
            
            if best_match_student_id:
                return FaceRecognitionResponse(
                    success=True,
                    student_id=best_match_student_id,
                    confidence_score=best_confidence,
                    message=f"Face recognized with {best_confidence:.1f}% confidence",
                    attendance_marked=True
                )
            else:
                return FaceRecognitionResponse(
                    success=False,
                    message="Face not recognized. Please ensure you are registered in the system.",
                    attendance_marked=False
                )
        
        except Exception as e:
            logger.error(f"Error processing attendance image: {str(e)}")
    def process_attendance_image_pgvector(
        self, 
        base64_image: str, 
        db: Session
    ) -> FaceRecognitionResponse:
        """
        Process attendance image using pgvector for fast face matching.
        This is the new optimized method.
        """
        try:
            # Decode image
            image = self.decode_base64_image(base64_image)
            
            # Extract face encoding from uploaded image
            unknown_encoding = self.extract_face_encoding(image)
            
            if not unknown_encoding:
                return FaceRecognitionResponse(
                    success=False,
                    message="No face detected in the image. Please ensure your face is clearly visible.",
                    attendance_marked=False
                )
            
            # Use pgvector to find best match
            best_match_student_id, confidence = self.find_best_match_pgvector(
                db, unknown_encoding, threshold=0.7
            )
            
            if best_match_student_id:
                return FaceRecognitionResponse(
                    success=True,
                    student_id=best_match_student_id,
                    confidence_score=confidence,
                    message=f"Face recognized with {confidence:.1f}% confidence",
                    attendance_marked=True
                )
            else:
                return FaceRecognitionResponse(
                    success=False,
                    message="Face not recognized. Please ensure you are registered in the system.",
                    attendance_marked=False
                )
        
        except Exception as e:
            logger.error(f"Error processing attendance image with pgvector: {str(e)}")
    def get_all_student_encodings_optimized(self, db: Session) -> List[Tuple[int, List[float]]]:
        """
        Get all student face encodings with optimized query.
        Only fetches students who have face encodings.
        """
        try:
            # Use optimized query to only get students with face encodings
            query = text("""
                SELECT id, face_encoding 
                FROM students 
                WHERE face_encoding IS NOT NULL
            """)
            
            results = db.execute(query).fetchall()
            student_encodings = []
            
            for row in results:
                if row.face_encoding:
                    student_encodings.append((row.id, row.face_encoding))
            
            logger.info(f"Loaded {len(student_encodings)} student face encodings")
            return student_encodings
            
        except Exception as e:
            logger.error(f"Error loading student encodings: {str(e)}")
            return []
    
    def process_attendance_image_optimized(
        self, 
        base64_image: str, 
        db: Session
    ) -> FaceRecognitionResponse:
        """
        Process attendance image with optimized database queries.
        This is the new optimized method using indexed JSON storage.
        """
        try:
            # Decode image
            image = self.decode_base64_image(base64_image)
            
            # Extract face encoding from uploaded image
            unknown_encoding = self.extract_face_encoding(image)
            
            if not unknown_encoding:
                return FaceRecognitionResponse(
                    success=False,
                    message="No face detected in the image. Please ensure your face is clearly visible.",
                    attendance_marked=False
                )
            
            # Get all student encodings with optimized query
            known_student_encodings = self.get_all_student_encodings_optimized(db)
            
            if not known_student_encodings:
                return FaceRecognitionResponse(
                    success=False,
                    message="No registered faces found in the system.",
                    attendance_marked=False
                )
            
            # Compare with known student faces
            best_match_student_id = None
            best_confidence = 0.0
            
            for student_id, known_encoding in known_student_encodings:
                is_match, confidence = self.compare_faces([known_encoding], unknown_encoding)
                
                if is_match and confidence > best_confidence:
                    best_match_student_id = student_id
                    best_confidence = confidence
            
            if best_match_student_id:
                return FaceRecognitionResponse(
                    success=True,
                    student_id=best_match_student_id,
                    confidence_score=best_confidence,
                    message=f"Face recognized with {best_confidence:.1f}% confidence",
                    attendance_marked=True
                )
            else:
                return FaceRecognitionResponse(
                    success=False,
                    message="Face not recognized. Please ensure you are registered in the system.",
                    attendance_marked=False
                )
        
        except Exception as e:
            logger.error(f"Error processing attendance image: {str(e)}")
            return FaceRecognitionResponse(
                success=False,
                message="Error processing image. Please try again.",
                attendance_marked=False
            )
    
    def validate_face_image(self, base64_image: str) -> Tuple[bool, str]:
        """Validate if image contains a clear face for registration."""
        try:
            image = self.decode_base64_image(base64_image)
            
            # Find face locations
            face_locations = face_recognition.face_locations(image, model=self.model)
            
            if len(face_locations) == 0:
                return False, "No face detected in the image"
            
            if len(face_locations) > 1:
                return False, "Multiple faces detected. Please ensure only one face is visible"
            
            # Check face quality (size)
            top, right, bottom, left = face_locations[0]
            face_height = bottom - top
            face_width = right - left
            
            if face_height < 100 or face_width < 100:
                return False, "Face is too small. Please move closer to the camera"
            
            # Extract encoding to verify quality
            encoding = self.extract_face_encoding(image)
            if not encoding:
                return False, "Could not extract face features. Please ensure good lighting"
            
            return True, "Face image is valid for registration"
        
        except Exception as e:
            logger.error(f"Error validating face image: {str(e)}")
            return False, "Error processing image"

# Create global instance
face_recognition_service = FaceRecognitionService()
