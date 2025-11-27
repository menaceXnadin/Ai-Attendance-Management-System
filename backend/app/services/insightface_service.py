import cv2
import numpy as np
import base64
from typing import Optional, List, Tuple, Dict, Any
from io import BytesIO
from PIL import Image
import insightface
from insightface.app import FaceAnalysis
from insightface.data import get_image as ins_get_image
import onnxruntime as ort
from app.core.config import settings
from app.core.face_constants import (
    DETECTION_MIN_CONFIDENCE,
    REGISTRATION_MIN_CONFIDENCE,
    SIMILARITY_THRESHOLD,
    LIVE_SIMILARITY_THRESHOLD,
    MIN_FACE_PIXEL_SIZE,
    MIN_FACE_AREA_PERCENT,
    MAX_DECODE_DIMENSION,
    MIN_EMBEDDING_NORM,
)
from app.schemas import FaceRecognitionResponse
import logging
import os

logger = logging.getLogger(__name__)

# Development mode flag - set to True for testing with mock faces
DEVELOPMENT_MODE = getattr(settings, 'development_mode', True)

class InsightFaceService:
    """
    Enhanced face recognition service using InsightFace library.
    Provides better accuracy, speed, and robustness compared to face_recognition library.
    Includes development mode for testing with mock face detection.
    """
    
    def __init__(self):
        """Initialize InsightFace service with optimized settings."""
        self.app = None
        # Keep tolerance aligned with centralized constants for matching
        self.tolerance = getattr(settings, 'face_recognition_tolerance', SIMILARITY_THRESHOLD)
        # Minimum face detection confidence
        self.confidence_threshold = DETECTION_MIN_CONFIDENCE
        self.development_mode = DEVELOPMENT_MODE
        
        if self.development_mode:
            logger.info("🚀 Running in DEVELOPMENT MODE - Mock face detection enabled")
        
        self.init_model()
    
    def _create_mock_face_data(self, image: np.ndarray) -> Dict[str, Any]:
        """Create mock face data for development testing."""
        height, width = image.shape[:2]
        
        # Create a realistic mock face bounding box (center of image)
        bbox_width = min(width, height) * 0.6
        bbox_height = bbox_width * 1.2
        x1 = (width - bbox_width) / 2
        y1 = (height - bbox_height) / 2
        x2 = x1 + bbox_width
        y2 = y1 + bbox_height
        
        # Generate a deterministic but unique mock embedding based on image data
        # This ensures same image always produces same "face" encoding
        image_hash = hash(image.tobytes()) % (2**31)
        np.random.seed(image_hash)
        mock_embedding = np.random.normal(0, 1, 512).tolist()
        
        return {
            'embedding': mock_embedding,
            'bbox': [x1, y1, x2, y2],
            'confidence': 0.95,  # High confidence for testing
            'landmark_2d_106': None,
            'age': 25,
            'gender': 1,
            'glasses': 0,  # NEW: No glasses in mock data
            'embedding_norm': float(np.linalg.norm(mock_embedding)),
            'width': bbox_width,
            'height': bbox_height,
            'area': bbox_width * bbox_height,
        }
    
    def init_model(self):
        """Initialize the InsightFace model with error handling."""
        try:
            logger.info("🔥 Initializing InsightFace model...")
            
            # Initialize FaceAnalysis app with all modules for glasses detection
            self.app = FaceAnalysis(
                providers=['CPUExecutionProvider'],  # Use CPU for better compatibility
                allowed_modules=None  # Load all modules including genderage for glasses detection
            )
            
            # Prepare the model with context size
            self.app.prepare(ctx_id=0, det_size=(640, 640))
            
            logger.info("✅ InsightFace model initialized successfully!")
            logger.info(f"📊 Available models: {list(self.app.models.keys())}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize InsightFace: {str(e)}")
            logger.error("💡 Falling back to CPU-only mode...")
            
            try:
                # Fallback to basic CPU setup with all modules
                self.app = FaceAnalysis(providers=['CPUExecutionProvider'])
                self.app.prepare(ctx_id=-1, det_size=(320, 320))  # Smaller size for CPU
                logger.info("✅ InsightFace initialized in CPU fallback mode with all modules")
            except Exception as e2:
                logger.error(f"❌ Complete InsightFace initialization failed: {str(e2)}")
                self.app = None
                raise RuntimeError("InsightFace could not be initialized")
    
    def _extract_glasses_attribute(self, image: np.ndarray, face) -> Optional[int]:
        """
        Extract glasses attribute using the genderage model.
        The genderage model might output [age, gender, glasses] or just [age, gender].
        
        Returns:
            0 = no glasses, 1 = glasses, None = not supported
        """
        try:
            if self.development_mode:
                # In development mode, return mock data
                return 0  # No glasses for testing
            
            if 'genderage' not in self.app.models:
                logger.warning("Genderage model not available for glasses detection")
                return None
            
            genderage_model = self.app.models['genderage']
            
            # Get attribute predictions from the model
            attr_result = genderage_model.get(image, face)
            
            # Log the raw result for debugging
            logger.info(f"Genderage model output: {attr_result} (shape: {attr_result.shape if hasattr(attr_result, 'shape') else 'no shape'})")
            
            # Check if we have a third output that could be glasses
            if hasattr(attr_result, '__len__') and len(attr_result) >= 3:
                # Third value might be glasses (0 = no glasses, 1 = glasses)
                glasses_value = attr_result[2]
                
                # Convert to binary (0 or 1)
                if glasses_value > 0.5:
                    return 1  # Glasses detected
                else:
                    return 0  # No glasses
            else:
                # Model doesn't provide glasses information
                logger.info(f"Genderage model only provides {len(attr_result) if hasattr(attr_result, '__len__') else 'unknown'} outputs - no glasses attribute")
                return None
                
        except Exception as e:
            logger.error(f"Error extracting glasses attribute: {str(e)}")
            return None

    def decode_base64_image(self, base64_string: str) -> np.ndarray:
        """Decode base64 string to OpenCV BGR image."""
        try:
            # Remove data URL prefix if present
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            
            # Decode base64
            image_data = base64.b64decode(base64_string)
            
            # Convert to PIL Image
            pil_image = Image.open(BytesIO(image_data))
            
            # Convert to RGB then to BGR for OpenCV
            rgb_image = pil_image.convert('RGB')
            bgr_image = cv2.cvtColor(np.array(rgb_image), cv2.COLOR_RGB2BGR)
            # Convert to numpy
            arr = np.array(rgb_image)

            # Optional downscale for performance if image is very large
            h, w = arr.shape[:2]
            if max(h, w) > MAX_DECODE_DIMENSION:
                scale = MAX_DECODE_DIMENSION / float(max(h, w))
                new_w = int(w * scale)
                new_h = int(h * scale)
                arr = cv2.resize(arr, (new_w, new_h), interpolation=cv2.INTER_AREA)

            bgr_image = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
            
            return bgr_image
        
        except Exception as e:
            logger.error(f"Error decoding base64 image: {str(e)}")
            raise ValueError("Invalid image data")
    
    def extract_face_features(self, image: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Extract face features using InsightFace.
        Returns face embedding and additional face information.
        """
        try:
            if self.app is None:
                logger.error("InsightFace model not initialized")
                return None
            
            if self.development_mode:
                # In development mode, create mock face data
                logger.info("🚀 DEVELOPMENT MODE: Using mock face detection")
                face_info = self._create_mock_face_data(image)
                logger.info(f"✅ Mock face created - Confidence: {face_info['confidence']:.3f}, "
                           f"Embedding norm: {face_info['embedding_norm']:.3f}")
                return face_info
            
            # Detect and analyze faces
            faces = self.app.get(image)
            
            if not faces:
                logger.warning("No faces detected in image")
                return None
            
            if len(faces) > 1:
                logger.warning(f"Multiple faces detected ({len(faces)}), using the largest one")
                # Use the face with largest bounding box area
                faces = sorted(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]), reverse=True)
            
            # Get the best face
            face = faces[0]
            
            # Extract comprehensive face information
            face_info = {
                'embedding': face.embedding.tolist(),  # 512-dimensional embedding
                'bbox': face.bbox.tolist(),  # [x1, y1, x2, y2]
                'confidence': float(face.det_score),  # Detection confidence
                'landmark_2d_106': face.landmark_2d_106.tolist() if hasattr(face, 'landmark_2d_106') else None,
                'age': int(face.age) if hasattr(face, 'age') else None,
                'gender': int(face.gender) if hasattr(face, 'gender') else None,
                'glasses': self._extract_glasses_attribute(image, face),  # NEW: Glasses detection
                'embedding_norm': float(np.linalg.norm(face.embedding)),
            }
            
            logger.info(f"✅ Face extracted - Confidence: {face_info['confidence']:.3f}, "
                       f"Embedding norm: {face_info['embedding_norm']:.3f}")
            
            return face_info
        
        except Exception as e:
            logger.error(f"Error extracting face features: {str(e)}")
            return None
    
    def extract_face_embedding(self, image: np.ndarray) -> Optional[List[float]]:
        """Extract only the face embedding (for backward compatibility)."""
        face_info = self.extract_face_features(image)
        return face_info['embedding'] if face_info else None
    
    def compare_embeddings(
        self, 
        known_embeddings: List[List[float]], 
        unknown_embedding: List[float]
    ) -> Tuple[bool, float, int]:
        """
        Compare face embeddings using cosine similarity.
        Returns: (is_match, best_similarity, best_match_index)
        """
        try:
            if not known_embeddings or not unknown_embedding:
                return False, 0.0, -1
            
            # Convert to numpy arrays
            unknown_emb = np.array(unknown_embedding)
            similarities = []
            
            for known_emb in known_embeddings:
                known_emb_np = np.array(known_emb)
                
                # Calculate cosine similarity
                dot_product = np.dot(known_emb_np, unknown_emb)
                norm_product = np.linalg.norm(known_emb_np) * np.linalg.norm(unknown_emb)
                
                if norm_product == 0:
                    similarity = 0.0
                else:
                    similarity = dot_product / norm_product
                
                similarities.append(similarity)
            
            # Find best match
            best_index = np.argmax(similarities)
            best_similarity = similarities[best_index]
            
            # Convert similarity to percentage and check threshold
            similarity_percentage = float(best_similarity * 100)
            is_match = bool(best_similarity > self.tolerance)
            best_index = int(best_index)
            
            logger.info(f"🔍 Face comparison - Best similarity: {similarity_percentage:.1f}%, "
                       f"Threshold: {self.tolerance*100:.1f}%, Match: {is_match}")
            
            return is_match, similarity_percentage, best_index
        
        except Exception as e:
            logger.error(f"Error comparing embeddings: {str(e)}")
            return False, 0.0, -1
    
    def process_attendance_image(
        self, 
        base64_image: str, 
        known_student_embeddings: List[Tuple[int, List[float]]]
    ) -> FaceRecognitionResponse:
        """Process attendance image and return recognition result."""
        try:
            logger.info("🎯 Processing attendance image with InsightFace...")
            
            # Decode image
            image = self.decode_base64_image(base64_image)
            logger.info(f"📷 Image decoded - Shape: {image.shape}")
            
            # Extract face features
            face_info = self.extract_face_features(image)
            
            if not face_info:
                return FaceRecognitionResponse(
                    success=False,
                    message="No clear face detected. Please ensure your face is well-lit and clearly visible.",
                    attendance_marked=False
                )
            
            # Check face quality
            if face_info['confidence'] < REGISTRATION_MIN_CONFIDENCE:
                return FaceRecognitionResponse(
                    success=False,
                    message=f"Face detection confidence too low ({face_info['confidence']:.2f}). Please improve lighting.",
                    attendance_marked=False
                )
            
            unknown_embedding = face_info['embedding']
            
            # Compare with known student faces
            if not known_student_embeddings:
                return FaceRecognitionResponse(
                    success=False,
                    message="No registered students found in the system.",
                    attendance_marked=False
                )
            
            student_ids = [student_id for student_id, _ in known_student_embeddings]
            known_embeddings = [embedding for _, embedding in known_student_embeddings]
            
            is_match, similarity_score, best_index = self.compare_embeddings(known_embeddings, unknown_embedding)
            
            if is_match and best_index >= 0:
                matched_student_id = student_ids[best_index]
                return FaceRecognitionResponse(
                    success=True,
                    student_id=matched_student_id,
                    confidence_score=similarity_score,
                    message=f"Face recognized with {similarity_score:.1f}% confidence",
                    attendance_marked=True
                )
            else:
                return FaceRecognitionResponse(
                    success=False,
                    message=f"Face not recognized (highest similarity: {similarity_score:.1f}%). Please ensure you are registered.",
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
            logger.info("🔍 Validating face image quality...")
            
            image = self.decode_base64_image(base64_image)
            face_info = self.extract_face_features(image)
            
            if not face_info:
                return False, "No face detected in the image. Please ensure your face is clearly visible."
            
            # Check detection confidence
            if face_info['confidence'] < self.confidence_threshold:
                return False, f"Face detection confidence too low ({face_info['confidence']:.2f}). Please improve lighting and try again."
            
            # Check face size (bbox area should be reasonable)
            bbox = face_info['bbox']
            face_width = bbox[2] - bbox[0]
            face_height = bbox[3] - bbox[1]
            
            if face_width < MIN_FACE_PIXEL_SIZE or face_height < MIN_FACE_PIXEL_SIZE:
                return False, "Face appears too small. Please move closer to the camera."
            
            # Check embedding quality
            embedding_norm = face_info['embedding_norm']
            if embedding_norm < MIN_EMBEDDING_NORM:  # Very low norm indicates poor feature extraction
                return False, "Face features could not be extracted clearly. Please ensure good lighting and clear visibility."
            
            logger.info(f"✅ Face validation passed - Confidence: {face_info['confidence']:.3f}, "
                       f"Size: {face_width}x{face_height}, Norm: {embedding_norm:.3f}")
            
            return True, f"Excellent face quality! Detection confidence: {face_info['confidence']:.2f}"
        
        except Exception as e:
            logger.error(f"Error validating face image: {str(e)}")
            return False, "Error processing image. Please try again."
    
    def get_model_info(self) -> Dict[str, str]:
        """Get information about the loaded models."""
        if self.app is None:
            return {"status": "not_initialized"}
        
        # Get models from the app
        models = self.app.models
        detection_model = "Unknown"
        recognition_model = "Unknown"
        
        # Find detection and recognition models
        for model_name, model in models.items():
            if 'det' in model_name.lower():
                detection_model = model.__class__.__name__
            elif 'rec' in model_name.lower() or 'w600k' in model_name.lower():
                recognition_model = model.__class__.__name__
        
        return {
            "status": "initialized",
            "detection_model": detection_model,
            "recognition_model": recognition_model,
            "available_models": list(models.keys()),
            "tolerance": str(self.tolerance),
            "confidence_threshold": str(self.confidence_threshold)
        }
    
    def detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect all faces in an image and return detailed information.
        Returns list of face data including bounding boxes and confidence scores.
        """
        try:
            if self.app is None:
                logger.error("InsightFace model not initialized")
                return []
            
            if self.development_mode:
                # In development mode, create mock face data
                face_info = self._create_mock_face_data(image)
                return [face_info]
            
            # Detect faces using InsightFace
            faces = self.app.get(image)
            
            if not faces:
                logger.info("No faces detected in image")
                return []
            
            # Convert face data to detailed format
            face_list = []
            for i, face in enumerate(faces):
                face_data = {
                    'index': i,
                    'bbox': face.bbox.tolist(),  # [x1, y1, x2, y2]
                    'confidence': float(face.det_score),
                    'embedding': face.embedding.tolist(),
                    'landmark_2d_106': face.landmark_2d_106.tolist() if hasattr(face, 'landmark_2d_106') else None,
                    'age': int(face.age) if hasattr(face, 'age') else None,
                    'gender': int(face.gender) if hasattr(face, 'gender') else None,
                    'glasses': self._extract_glasses_attribute(image, face),  # NEW: Glasses detection
                    'embedding_norm': float(np.linalg.norm(face.embedding)),
                }
                
                # Calculate face area for quality assessment
                bbox = face_data['bbox']
                face_width = bbox[2] - bbox[0]
                face_height = bbox[3] - bbox[1]
                face_data['width'] = face_width
                face_data['height'] = face_height
                face_data['area'] = face_width * face_height
                
                face_list.append(face_data)
            
            # Sort by confidence score (highest first)
            face_list.sort(key=lambda x: x['confidence'], reverse=True)
            
            logger.info(f"✅ Detected {len(face_list)} faces with confidences: "
                       f"{[f'{f['confidence']:.3f}' for f in face_list]}")
            
            return face_list
        
        except Exception as e:
            logger.error(f"Error detecting faces: {str(e)}")
            return []
    
    def validate_face_quality(self, image: np.ndarray, face_data: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Validate if a detected face meets quality requirements for registration.
        
        Args:
            image: Original image array
            face_data: Face data from detect_faces()
            
        Returns:
            (is_valid, message): Validation result and description
        """
        try:
            # In development mode, always pass validation for testing
            if self.development_mode:
                logger.info("🚀 DEVELOPMENT MODE: Bypassing face quality validation")
                return True, "Development mode: Face quality validation passed"
            
            # Check detection confidence
            confidence = face_data['confidence']
            if confidence < REGISTRATION_MIN_CONFIDENCE:
                return False, f"Face detection confidence too low ({confidence:.2f}). Please improve lighting and face visibility."
            
            # Check face size relative to image
            image_height, image_width = image.shape[:2]
            face_width = face_data['width']
            face_height = face_data['height']
            
            # Face should be at least 80x80 pixels
            if face_width < MIN_FACE_PIXEL_SIZE or face_height < MIN_FACE_PIXEL_SIZE:
                return False, f"Face too small ({face_width:.0f}x{face_height:.0f}px). Please move closer to camera."
            
            # Face should not be too large (avoiding extreme close-ups)
            if face_width > image_width * 0.8 or face_height > image_height * 0.8:
                return False, "Face too close to camera. Please move back slightly for better framing."
            
            # Check face area percentage of image
            image_area = image_width * image_height
            face_area = face_data['area']
            face_percentage = (face_area / image_area) * 100
            
            if face_percentage < MIN_FACE_AREA_PERCENT:
                return False, f"Face too small in frame ({face_percentage:.1f}%). Please move closer."
            
            if face_percentage > MAX_FACE_AREA_PERCENT:
                return False, f"Face too large in frame ({face_percentage:.1f}%). Please move back."
            
            # Check embedding quality
            embedding_norm = face_data['embedding_norm']
            if embedding_norm < MIN_EMBEDDING_NORM:
                return False, "Face features unclear. Please ensure good lighting and clear facial visibility."
            
            # Check if face is reasonably centered
            bbox = face_data['bbox']
            face_center_x = (bbox[0] + bbox[2]) / 2
            face_center_y = (bbox[1] + bbox[3]) / 2
            image_center_x = image_width / 2
            image_center_y = image_height / 2
            
            center_offset_x = abs(face_center_x - image_center_x) / image_width
            center_offset_y = abs(face_center_y - image_center_y) / image_height
            
            if center_offset_x > MAX_CENTER_OFFSET or center_offset_y > MAX_CENTER_OFFSET:
                return False, "Please center your face in the camera frame."
            
            # All validation checks passed
            logger.info(f"✅ Face quality validation passed - "
                       f"Confidence: {confidence:.3f}, Size: {face_width:.0f}x{face_height:.0f}, "
                       f"Area: {face_percentage:.1f}%, Norm: {embedding_norm:.3f}")
            
            return True, f"Excellent face quality! Confidence: {confidence:.2f}, Size: {face_percentage:.1f}% of frame"
        
        except Exception as e:
            logger.error(f"Error validating face quality: {str(e)}")
            return False, "Error validating face quality. Please try again."
    
    def process_multi_image_face_registration(self, base64_images: List[str]) -> Dict[str, Any]:
        """
        Process multiple face images for registration - provides more robust face encoding.
        Analyzes all images, validates quality, and creates a composite face profile.
        
        Args:
            base64_images: List of Base64 encoded images (typically 3: center, left, right)
            
        Returns:
            Dictionary with registration result and composite face data
        """
        try:
            logger.info(f"🎯 Processing multi-image face registration with {len(base64_images)} images...")
            
            if len(base64_images) == 0:
                return {
                    'success': False,
                    'message': 'No images provided for registration.',
                    'images_processed': 0,
                    'encoding': None
                }
            
            all_face_data = []
            valid_encodings = []
            image_results = []
            
            # Process each image
            for i, base64_image in enumerate(base64_images):
                logger.info(f"📷 Processing image {i+1}/{len(base64_images)}...")
                
                try:
                    # Decode image
                    image = self.decode_base64_image(base64_image)
                    
                    # Detect faces
                    detected_faces = self.detect_faces(image)
                    
                    image_result = {
                        'image_index': i,
                        'faces_detected': len(detected_faces),
                        'valid': False,
                        'message': '',
                        'face_data': None
                    }
                    
                    if len(detected_faces) == 0:
                        image_result['message'] = 'No face detected'
                    elif len(detected_faces) > 1:
                        image_result['message'] = f'Multiple faces detected ({len(detected_faces)})'
                    else:
                        face_data = detected_faces[0]
                        
                        # Validate face quality
                        is_valid, validation_message = self.validate_face_quality(image, face_data)
                        
                        image_result['valid'] = is_valid
                        image_result['message'] = validation_message
                        image_result['face_data'] = {
                            'confidence': face_data['confidence'],
                            'area_percentage': (face_data['area'] / (image.shape[0] * image.shape[1])) * 100,
                            'bbox': face_data['bbox']
                        }
                        
                        if is_valid:
                            all_face_data.append(face_data)
                            valid_encodings.append(face_data['embedding'])
                    
                    image_results.append(image_result)
                    
                except Exception as e:
                    logger.error(f"Error processing image {i+1}: {str(e)}")
                    image_results.append({
                        'image_index': i,
                        'faces_detected': 0,
                        'valid': False,
                        'message': f'Error processing image: {str(e)}',
                        'face_data': None
                    })
            
            # Check if we have enough valid images
            valid_count = len(valid_encodings)
            
            if valid_count == 0:
                return {
                    'success': False,
                    'message': 'No valid faces found in any of the provided images.',
                    'images_processed': len(base64_images),
                    'image_results': image_results,
                    'encoding': None
                }
            
            # Create composite encoding from multiple valid images
            if valid_count == 1:
                # Use single encoding
                composite_encoding = valid_encodings[0]
                logger.info("📊 Using single valid encoding")
            else:
                # Average multiple encodings for more robust representation
                composite_encoding = np.mean(valid_encodings, axis=0)
                # Normalize the averaged encoding
                composite_encoding = composite_encoding / np.linalg.norm(composite_encoding)
                logger.info(f"📊 Created composite encoding from {valid_count} images")
            
            # Calculate quality metrics
            avg_confidence = np.mean([fd['confidence'] for fd in all_face_data])
            avg_area_percentage = np.mean([(fd['area'] / (image.shape[0] * image.shape[1])) * 100 
                                         for fd, image in zip(all_face_data, 
                                         [self.decode_base64_image(img) for img in base64_images[:valid_count]])])
            
            success_message = f"Successfully processed {valid_count}/{len(base64_images)} images. "
            if valid_count >= 2:
                success_message += "Multi-angle face profile created for enhanced recognition accuracy."
            else:
                success_message += "Single-angle face profile created."
            
            return {
                'success': True,
                'message': success_message,
                'images_processed': len(base64_images),
                'valid_images': valid_count,
                'image_results': image_results,
                'composite_face_data': {
                    'avg_confidence': avg_confidence,
                    'avg_area_percentage': avg_area_percentage,
                    'embedding_dimensions': len(composite_encoding),
                    'encoding_method': 'composite' if valid_count > 1 else 'single'
                },
                'encoding': composite_encoding.tolist()  # Convert to list for JSON serialization
            }
            
        except Exception as e:
            logger.error(f"Multi-image face registration error: {str(e)}")
            return {
                'success': False,
                'message': f'Error processing multiple images: {str(e)}',
                'images_processed': len(base64_images) if base64_images else 0,
                'encoding': None
            }
    
    def process_face_registration(self, base64_image: str) -> Dict[str, Any]:
        """
        Complete face registration processing - detection, validation, and encoding extraction.
        This replaces all frontend MediaPipe functionality.
        
        Returns:
            Dictionary with registration result, face data, and detailed feedback
        """
        try:
            logger.info("🎯 Processing face registration with backend-only approach...")
            
            # 1. Decode the image
            image = self.decode_base64_image(base64_image)
            logger.info(f"📷 Image decoded - Shape: {image.shape}")
            
            # 2. Detect all faces in the image
            detected_faces = self.detect_faces(image)
            
            if len(detected_faces) == 0:
                return {
                    'success': False,
                    'message': 'No face detected in the image. Please ensure your face is clearly visible and well-lit.',
                    'faces_detected': 0,
                    'face_data': None,
                    'encoding': None
                }
            
            if len(detected_faces) > 1:
                return {
                    'success': False,
                    'message': f'Multiple faces detected ({len(detected_faces)}). Please ensure only one person is visible in the image.',
                    'faces_detected': len(detected_faces),
                    'face_data': detected_faces,
                    'encoding': None
                }
            
            # 3. Get the single detected face
            face_data = detected_faces[0]
            
            # 4. Validate face quality
            is_valid, validation_message = self.validate_face_quality(image, face_data)
            
            if not is_valid:
                return {
                    'success': False,
                    'message': validation_message,
                    'faces_detected': 1,
                    'face_data': face_data,
                    'encoding': None
                }
            
            # 5. Extract face encoding (already available in face_data)
            face_encoding = face_data['embedding']
            
            # 6. Success - return all data
            result = {
                'success': True,
                'message': validation_message,
                'faces_detected': 1,
                'face_data': {
                    'bbox': face_data['bbox'],
                    'confidence': face_data['confidence'],
                    'width': face_data['width'],
                    'height': face_data['height'],
                    'area_percentage': (face_data['area'] / (image.shape[0] * image.shape[1])) * 100,
                    'embedding_dimensions': len(face_encoding),
                    'embedding_norm': face_data['embedding_norm']
                },
                'encoding': face_encoding
            }
            
            logger.info(f"✅ Face registration processed successfully - "
                       f"Confidence: {face_data['confidence']:.3f}, "
                       f"Encoding dimensions: {len(face_encoding)}")
            
            return result
        
        except ValueError as e:
            logger.error(f"Image processing error: {str(e)}")
            return {
                'success': False,
                'message': 'Invalid image format. Please capture a new image.',
                'faces_detected': 0,
                'face_data': None,
                'encoding': None
            }
        except Exception as e:
            logger.error(f"Face registration processing error: {str(e)}")
            return {
                'success': False,
                'message': 'Error processing image. Please try again.',
                'faces_detected': 0,
                'face_data': None,
                'encoding': None
            }

# Create global instance
try:
    insightface_service = InsightFaceService()
    logger.info("🔥 InsightFace service initialized successfully!")
except Exception as e:
    logger.error(f"❌ Failed to initialize InsightFace service: {str(e)}")
    insightface_service = None
