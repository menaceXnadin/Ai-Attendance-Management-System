import cv2
import numpy as np
import insightface
import base64
from typing import Optional, List, Tuple
from io import BytesIO
from PIL import Image
from app.core.config import settings
from app.schemas import FaceRecognitionResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging
import onnxruntime as ort

logger = logging.getLogger(__name__)

class FaceRecognitionService:
    def __init__(self):
        self.tolerance = settings.face_recognition_tolerance
        # Initialize InsightFace model
        self.app = insightface.app.FaceAnalysis(
            providers=['CPUExecutionProvider'],  # Use CPU, can switch to CUDA if available
            allowed_modules=['detection', 'recognition']
        )
        det_size = getattr(settings, 'insightface_det_size', 640)
        self.app.prepare(ctx_id=0, det_size=(det_size, det_size))
        logger.info("InsightFace model initialized successfully")
    
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
        """Extract face encoding from image using InsightFace."""
        try:
            # Convert RGB to BGR for InsightFace
            bgr_image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            # Get face analysis results
            faces = self.app.get(bgr_image)
            
            if not faces:
                logger.warning("No face found in image")
                return None
            
            # Get the largest face (most prominent)
            face = max(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]))
            
            # Return the face embedding (512-dimensional vector)
            return face.embedding.tolist()
        
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
        """Compare unknown face with known faces using cosine similarity for InsightFace embeddings."""
        try:
            if not known_encodings or not unknown_encoding:
                return False, 0.0
            
            # Convert to numpy arrays
            known_encodings_np = np.array(known_encodings)
            unknown_encoding_np = np.array(unknown_encoding)
            
            # Normalize vectors for cosine similarity
            known_encodings_norm = known_encodings_np / np.linalg.norm(known_encodings_np, axis=1, keepdims=True)
            unknown_encoding_norm = unknown_encoding_np / np.linalg.norm(unknown_encoding_np)
            
            # Calculate cosine similarities
            similarities = np.dot(known_encodings_norm, unknown_encoding_norm)
            
            # Find the best match
            best_match_index = np.argmax(similarities)
            best_similarity = similarities[best_match_index]
            
            # Convert similarity to confidence percentage
            confidence = max(0, best_similarity * 100)
            
            # Check if match is above threshold (InsightFace typically uses 0.6 threshold)
            threshold = 0.6  # Adjust based on your requirements
            is_match = best_similarity >= threshold
            
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
        """Validate if image contains a clear face for registration using InsightFace."""
        try:
            image = self.decode_base64_image(base64_image)
            
            # Convert RGB to BGR for InsightFace
            bgr_image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            # Get face analysis results
            faces = self.app.get(bgr_image)
            
            if len(faces) == 0:
                return False, "No face detected in the image"
            
            if len(faces) > 1:
                return False, "Multiple faces detected. Please ensure only one face is visible"
            
            # Check face quality (size and confidence)
            face = faces[0]
            bbox = face.bbox
            face_width = bbox[2] - bbox[0]
            face_height = bbox[3] - bbox[1]
            
            if face_height < 100 or face_width < 100:
                return False, "Face is too small. Please move closer to the camera"
            
            # Check detection confidence if available
            if hasattr(face, 'det_score') and face.det_score < 0.8:
                return False, "Face detection confidence is too low. Please ensure good lighting"
            
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
