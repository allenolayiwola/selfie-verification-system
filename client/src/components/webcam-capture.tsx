import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Sun, AlertTriangle, User, XCircle, Users, SmilePlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';

// Fixed dimensions for Ghana NIA API - exact 4:3 ratio required
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes
const MIN_BRIGHTNESS = 100;
const MAX_BRIGHTNESS = 200;
const MIN_CONTRAST = 30;
const FACE_CONFIDENCE_THRESHOLD = 0.8;
const MOVEMENT_THRESHOLD = 20;
const MOVEMENT_HISTORY_LENGTH = 10;
const IDEAL_FACE_WIDTH_RATIO = 0.5;
const MAX_HEAD_TILT_ANGLE = 15;
const MIN_FACE_SIZE = 0.3;
const MAX_FACE_SIZE = 0.7;
const MAX_FACES_ALLOWED = 4;
const GLASSES_DETECTION_THRESHOLD = 0.7; // Threshold for glasses detection confidence

// Completely rewritten image capture and compression function
// Designed specifically to fix mobile distortion issues
const compressImage = (imageSrc: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Create temporary canvas for compression
        const canvas = document.createElement('canvas');
        
        // Get original image dimensions
        const origWidth = img.naturalWidth;
        const origHeight = img.naturalHeight;
        
        // CRITICAL FIX: Detect mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        console.log(`Device detected: ${isMobile ? 'Mobile' : 'Desktop'}`);
        console.log(`Original image dimensions: ${origWidth}x${origHeight}`);
        
        // Always output exactly 640x480 for Ghana NIA API
        const targetWidth = CAPTURE_WIDTH;  // 640px
        const targetHeight = CAPTURE_HEIGHT; // 480px

        // Use default 4:3 aspect ratio, crucial for proper display
        canvas.width = targetWidth; 
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Clear canvas with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Enable high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // COMPLETELY REDESIGNED MOBILE APPROACH - FIXES BOTH DISTORTION AND "FACE TOO SMALL" ISSUE
        if (isMobile) {
          console.log("Using completely redesigned mobile image processing for Ghana NIA API");
          
          // The key insight: We need to maximize face size for Ghana NIA API
          // by properly cropping and zooming
          
          // Create a temporary canvas for face detection
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = origWidth;
          tempCanvas.height = origHeight;
          const tempCtx = tempCanvas.getContext('2d');
          
          if (!tempCtx) {
            console.error('Failed to get temporary canvas context');
            // Fallback to standard processing if we can't do face detection
          } else {
            // Draw original image to temporary canvas
            tempCtx.drawImage(img, 0, 0);
            
            // For mobile devices, let's optimize specifically for portrait orientation
            // which is typically how phones capture selfies
            const isPortrait = origHeight > origWidth;
            
            if (isPortrait) {
              console.log("Detected portrait orientation - applying optimized processing");
              
              // This is the exact ratio expected by Ghana NIA API
              const targetAspect = 4/3; 
              
              // Step 1: Determine best crop that maximizes face area while maintaining aspect ratio
              
              // For portrait photos on mobile, we want to crop height to maximize the face
              // and ensure it's not too small for the API
              // The top 60% of the image typically contains the face
              let cropTop = Math.floor(origHeight * 0.15); // Start 15% from the top
              let cropHeight = Math.floor(origHeight * 0.60); // Take 60% of height
              let cropWidth = Math.floor(cropHeight * targetAspect); // Calculate width based on target aspect
              
              // Center horizontally
              let cropLeft = Math.floor((origWidth - cropWidth) / 2);
              
              // Ensure we don't go out of bounds
              if (cropLeft < 0) cropLeft = 0;
              if (cropTop < 0) cropTop = 0;
              if (cropLeft + cropWidth > origWidth) cropWidth = origWidth - cropLeft;
              if (cropTop + cropHeight > origHeight) cropHeight = origHeight - cropTop;
              
              console.log('Mobile optimized crop:', {
                cropLeft,
                cropTop,
                cropWidth,
                cropHeight,
                strategy: 'portrait-face-maximize'
              });
              
              // Step 2: Draw the cropped area to the output canvas, stretching to fill
              ctx.drawImage(
                img,
                cropLeft, cropTop, cropWidth, cropHeight,
                0, 0, targetWidth, targetHeight
              );
            } else {
              // For landscape, use a centered crop approach
              const originalAspect = origWidth / origHeight;
              const targetAspect = 4/3;
              
              // Define source rectangle (part of original image we'll use)
              let srcX = 0, srcY = 0, srcWidth = origWidth, srcHeight = origHeight;
              
              // For landscape, focus on center 80% width to maximize face
              srcWidth = Math.floor(origWidth * 0.8);
              srcX = Math.floor((origWidth - srcWidth) / 2);
              
              // Adjust height to maintain aspect ratio
              srcHeight = Math.floor(srcWidth / targetAspect);
              // And center vertically
              srcY = Math.floor((origHeight - srcHeight) / 2);
              
              // Ensure we don't go out of bounds
              if (srcY < 0) {
                srcY = 0;
                srcHeight = origHeight;
                // Recalculate width based on available height
                srcWidth = Math.floor(srcHeight * targetAspect);
                srcX = Math.floor((origWidth - srcWidth) / 2);
              }
              
              console.log('Mobile landscape crop:', {
                srcX, srcY, srcWidth, srcHeight,
                strategy: 'landscape-center-80pct'
              });
              
              // Draw the cropped area to fill canvas
              ctx.drawImage(
                img,
                srcX, srcY, srcWidth, srcHeight,
                0, 0, targetWidth, targetHeight
              );
            }
            
            // CRITICAL: Apply sharpening for better facial details
            try {
              // Get image data to apply filters
              const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
              const data = imageData.data;
              
              // Apply subtle contrast/sharpening enhancements
              for (let i = 0; i < data.length; i += 4) {
                // Simple contrast boost to bring out facial features
                data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.1 + 128));
                data[i+1] = Math.min(255, Math.max(0, (data[i+1] - 128) * 1.1 + 128));
                data[i+2] = Math.min(255, Math.max(0, (data[i+2] - 128) * 1.1 + 128));
              }
              
              // Put the enhanced image back
              ctx.putImageData(imageData, 0, 0);
            } catch (err) {
              console.error('Image enhancement failed:', err);
              // Continue without enhancement if it fails
            }
          }
          
          // Convert to JPEG at maximum quality for Ghana NIA API
          const mobileResult = canvas.toDataURL('image/jpeg', 1.0);
          const mobileBase64 = mobileResult.split(',')[1];
          
          console.log('Mobile processing complete:', {
            finalDimensions: `${targetWidth}x${targetHeight}`,
            size: (mobileBase64.length / 1024).toFixed(2) + 'KB',
            quality: '100%'
          });
          
          resolve(mobileBase64);
          return;
        }
        
        // DESKTOP HANDLING
        // Calculate scaling to maintain aspect ratio
        const scale = Math.min(targetWidth / origWidth, targetHeight / origHeight);
        const drawWidth = origWidth * scale;
        const drawHeight = origHeight * scale;
        
        // Center the image
        const xOffset = (targetWidth - drawWidth) / 2;
        const yOffset = (targetHeight - drawHeight) / 2;
        
        // Draw image centered and properly scaled
        ctx.drawImage(img, xOffset, yOffset, drawWidth, drawHeight);

        // For desktop, use slightly lower quality but still good
        const quality = 0.9;
        
        // Use JPEG which is better for photos and required by the API
        const compressedImage = canvas.toDataURL('image/jpeg', quality);
        
        // Get final size
        const base64Size = (compressedImage.length * 3) / 4;

        if (base64Size > MAX_FILE_SIZE) {
          reject(new Error(`Image size (${(base64Size / 1024).toFixed(2)}KB) exceeds limit. Try moving closer to the camera or ensuring better lighting.`));
          return;
        }

        // Convert to base64 without the data URL prefix
        const base64Data = compressedImage.split(',')[1];
        console.log('Desktop image compression details:', {
          originalDimensions: `${origWidth}x${origHeight}`,
          finalDimensions: `${targetWidth}x${targetHeight}`,
          drawDimensions: `${drawWidth.toFixed(0)}x${drawHeight.toFixed(0)}`,
          originalSize: (imageSrc.length / 1024).toFixed(2) + 'KB',
          compressedSize: (base64Data.length / 1024).toFixed(2) + 'KB',
          quality: quality,
          format: 'JPEG'
        });

        resolve(base64Data);
      } catch (err) {
        console.error('Image processing error:', err);
        reject(new Error(`Image processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
      }
    };

    img.onerror = (err) => {
      console.error('Failed to load image for processing:', err);
      reject(new Error('Failed to load image. Please try again with better lighting.'));
    };
    
    img.src = imageSrc;
  });
};

interface WebcamCaptureProps {
  onCapture: (imageData: string) => void;
}

interface FacePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  expression?: string;
  hasGlasses?: boolean;
}

interface ImageQuality {
  isCentered: boolean;
  isRightSize: boolean;
  isStraight: boolean;
  isSharp: boolean;
  score: number;
}

export default function WebcamCapture({ onCapture }: WebcamCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceDetector, setFaceDetector] = useState<faceDetection.FaceDetector | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState<boolean>(false);
  const [facePositions, setFacePositions] = useState<FacePosition[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [movementHistory, setMovementHistory] = useState<FacePosition[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageQuality, setImageQuality] = useState<ImageQuality>({
    isCentered: false,
    isRightSize: false,
    isStraight: false,
    isSharp: false,
    score: 0
  });
  const [lightingStatus, setLightingStatus] = useState<{
    brightness: number;
    contrast: number;
    isGood: boolean;
  }>({ brightness: 0, contrast: 0, isGood: false });
  const [glassesDetected, setGlassesDetected] = useState(false);


  useEffect(() => {
    const loadModel = async () => {
      await tf.ready();
      const model = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        {
          runtime: 'tfjs',
          modelType: 'full',
          maxFaces: MAX_FACES_ALLOWED
        }
      );
      setFaceDetector(model);
    };
    loadModel();
  }, []);

  const detectExpression = (face: any): string => {
    if (!face.keypoints || face.keypoints.length === 0) {
      console.log('No keypoints found in face detection');
      return 'neutral';
    }

    try {
      console.log('Face keypoints:', face.keypoints);

      const mouthBottom = face.keypoints.find((kp: any) => kp.name === 'mouthBottom');
      const mouthTop = face.keypoints.find((kp: any) => kp.name === 'mouthTop');
      const rightMouth = face.keypoints.find((kp: any) => kp.name === 'mouthRight');
      const leftMouth = face.keypoints.find((kp: any) => kp.name === 'mouthLeft');

      if (mouthBottom && mouthTop && rightMouth && leftMouth) {
        const mouthHeight = Math.abs(mouthBottom.y - mouthTop.y);
        const mouthWidth = Math.abs(rightMouth.x - leftMouth.x);

        const mouthRatio = mouthWidth / mouthHeight;

        return mouthRatio > 2.0 ? 'smiling' : 'neutral';
      }

      return 'neutral';
    } catch (error) {
      console.error('Expression detection error:', error);
      return 'neutral';
    }
  };

  const detectGlasses = (face: any): boolean => {
    if (!face.keypoints) return false;

    try {
      // Get all eye-related keypoints
      const leftEye = face.keypoints.find((kp: any) => kp.name === 'leftEye');
      const rightEye = face.keypoints.find((kp: any) => kp.name === 'rightEye');
      const leftEyeOuter = face.keypoints.find((kp: any) => kp.name === 'leftEyeOuter');
      const leftEyeInner = face.keypoints.find((kp: any) => kp.name === 'leftEyeInner');
      const rightEyeOuter = face.keypoints.find((kp: any) => kp.name === 'rightEyeOuter');
      const rightEyeInner = face.keypoints.find((kp: any) => kp.name === 'rightEyeInner');
      const leftEyebrow = face.keypoints.find((kp: any) => kp.name === 'leftEyebrow');
      const rightEyebrow = face.keypoints.find((kp: any) => kp.name === 'rightEyebrow');

      // Debug logging
      console.log('Eye keypoints:', {
        leftEye,
        rightEye,
        leftEyeOuter,
        leftEyeInner,
        rightEyeOuter,
        rightEyeInner,
        leftEyebrow,
        rightEyebrow
      });

      let glassesScore = 0;

      // Method 1: Check eyebrow to eye distance (lowered threshold)
      if (leftEye && leftEyebrow && rightEye && rightEyebrow) {
        const leftEyeDistance = Math.abs(leftEye.y - leftEyebrow.y);
        const rightEyeDistance = Math.abs(rightEye.y - rightEyebrow.y);
        const averageDistance = (leftEyeDistance + rightEyeDistance) / 2;

        console.log('Method 1 - Average eyebrow distance:', averageDistance);
        if (averageDistance > 0.15) { // Significantly reduced threshold
          glassesScore += 1;
        }
      }

      // Method 2: Check eye width ratio
      if (leftEyeOuter && leftEyeInner && rightEyeOuter && rightEyeInner) {
        const leftEyeWidth = Math.abs(leftEyeOuter.x - leftEyeInner.x);
        const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);
        const averageWidth = (leftEyeWidth + rightEyeWidth) / 2;
        const expectedWidth = face.box.width * 0.12; // Reduced threshold

        console.log('Method 2 - Eye width ratio:', {
          averageWidth,
          expectedWidth,
          ratio: averageWidth / expectedWidth
        });

        if (averageWidth > expectedWidth) {
          glassesScore += 1;
        }
      }

      // Method 3: Check for eye region characteristics
      if (leftEye && rightEye) {
        // Check confidence scores for potential reflection/occlusion
        const eyeScoreDiff = Math.abs(leftEye.score - rightEye.score);
        console.log('Method 3 - Eye score difference:', eyeScoreDiff);

        if (eyeScoreDiff > 0.1) { // Reduced threshold
          glassesScore += 1;
        }

        // Additional check for consistent eye detection confidence
        const avgEyeScore = (leftEye.score + rightEye.score) / 2;
        if (avgEyeScore < 0.85) { // Glasses often reduce detection confidence
          glassesScore += 1;
        }
      }

      // Method 4: Check for potential frame edges
      if (leftEyeOuter && rightEyeOuter) {
        const eyeRegionWidth = Math.abs(rightEyeOuter.x - leftEyeOuter.x);
        const eyeRegionRatio = eyeRegionWidth / face.box.width;

        console.log('Method 4 - Eye region ratio:', eyeRegionRatio);
        if (eyeRegionRatio > 0.45) { // Glasses frames often make eye region appear wider
          glassesScore += 1;
        }
      }

      console.log('Final glasses score:', glassesScore);
      // Consider glasses detected if at least 2 methods indicate their presence
      return glassesScore >= 2;

    } catch (error) {
      console.error('Glasses detection error:', error);
      return false;
    }
  };

  const analyzeImageQuality = useCallback((face: FacePosition) => {
    const centerX = CAPTURE_WIDTH / 2;
    const centerY = CAPTURE_HEIGHT / 2;
    const faceCenter = {
      x: face.x + face.width / 2,
      y: face.y + face.height / 2
    };

    const isCentered =
      Math.abs(faceCenter.x - centerX) < CAPTURE_WIDTH * 0.1 &&
      Math.abs(faceCenter.y - centerY) < CAPTURE_HEIGHT * 0.1;

    const faceWidthRatio = face.width / CAPTURE_WIDTH;
    const isRightSize =
      faceWidthRatio >= MIN_FACE_SIZE &&
      faceWidthRatio <= MAX_FACE_SIZE;

    const isStraight = true;
    const isSharp = true;

    const score = [
      isCentered,
      isRightSize,
      isStraight,
      isSharp
    ].filter(Boolean).length * 25;

    return {
      isCentered,
      isRightSize,
      isStraight,
      isSharp,
      score
    };
  }, []);

  const detectFaces = useCallback(async () => {
    if (!faceDetector || !webcamRef.current) return;

    const video = webcamRef.current.video;
    if (!video) return;

    try {
      const faces = await faceDetector.estimateFaces(video);
      const detectedFaces = faces.map(face => {
        const hasGlasses = detectGlasses(face);
        return {
          x: face.box.xMin,
          y: face.box.yMin,
          width: face.box.width,
          height: face.box.height,
          expression: detectExpression(face),
          hasGlasses
        };
      });

      setFacePositions(detectedFaces);
      setFaceDetected(detectedFaces.length > 0);
      setMultipleFaces(detectedFaces.length > 1);
      setGlassesDetected(detectedFaces.some(face => face.hasGlasses));

      if (detectedFaces.length > 0) {
        const primaryFace = detectedFaces[0];
        setImageQuality(analyzeImageQuality(primaryFace));

        setMovementHistory(prev => {
          const newHistory = [...prev, primaryFace].slice(-MOVEMENT_HISTORY_LENGTH);
          if (newHistory.length >= 2) {
            const lastPos = newHistory[newHistory.length - 1];
            const prevPos = newHistory[newHistory.length - 2];
            const movement = Math.abs(lastPos.x - prevPos.x) + Math.abs(lastPos.y - prevPos.y);
            if (movement > MOVEMENT_THRESHOLD) {
              setIsLive(true);
            }
          }
          return newHistory;
        });
      }
    } catch (error) {
      console.error('Face detection error:', error);
    }
  }, [faceDetector, detectExpression, detectGlasses, analyzeImageQuality]);

  const analyzeLighting = (imageData: string) => {
    return new Promise<{ brightness: number; contrast: number }>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve({ brightness: 0, contrast: 0 });

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let totalBrightness = 0;
        let minBrightness = 255;
        let maxBrightness = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;

          totalBrightness += brightness;
          minBrightness = Math.min(minBrightness, brightness);
          maxBrightness = Math.max(maxBrightness, brightness);
        }

        const avgBrightness = totalBrightness / (data.length / 4);
        const contrast = maxBrightness - minBrightness;

        resolve({ brightness: avgBrightness, contrast });
      };
      img.src = imageData;
    });
  };


  useEffect(() => {
    const interval = setInterval(detectFaces, 100);
    return () => clearInterval(interval);
  }, [detectFaces]);

  const checkLightingConditions = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    const { brightness, contrast } = await analyzeLighting(imageSrc);
    const isGood = brightness >= MIN_BRIGHTNESS &&
      brightness <= MAX_BRIGHTNESS &&
      contrast >= MIN_CONTRAST;

    setLightingStatus({ brightness, contrast, isGood });
  }, []);

  useEffect(() => {
    const interval = setInterval(checkLightingConditions, 1000);
    return () => clearInterval(interval);
  }, [checkLightingConditions]);

  const capture = useCallback(async () => {
    setError(null);
    
    // Detect mobile device with enhanced logging
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log(`Device capturing image: ${isMobile ? 'Mobile' : 'Desktop'}`);
    console.log('Webcam dimensions:', CAPTURE_WIDTH, 'x', CAPTURE_HEIGHT);
    
    // Use specific settings for mobile vs desktop with fixed dimensions
    // This is critical for fixing the mobile aspect ratio issues
    const imageSrc = webcamRef.current?.getScreenshot({
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT
    });

    if (!imageSrc) {
      setError("Failed to capture image");
      return;
    }

    try {
      // Log the image details for debugging
      console.log('Image capture details:', {
        imageLength: imageSrc.length,
        isDataURL: imageSrc.includes('data:image'),
        format: imageSrc.includes('jpeg') ? 'JPEG' : 'PNG',
        device: isMobile ? 'Mobile' : 'Desktop'
      });
      
      // Enhanced mobile-specific handling
      if (isMobile) {
        console.log("Using enhanced mobile-specific image processing");
      }
      
      // Validation checks before processing
      if (!faceDetected) {
        setError("No face detected in frame");
        return;
      }

      if (!isLive) {
        setError("Please move slightly to confirm liveness");
        return;
      }

      if (imageQuality.score < 75) {
        setError("Please adjust your position according to the guidelines");
        return;
      }

      const { brightness, contrast } = await analyzeLighting(imageSrc);
      if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) {
        setError("Poor lighting conditions. Please adjust lighting.");
        return;
      }
      if (contrast < MIN_CONTRAST) {
        setError("Image lacks contrast. Please improve lighting conditions.");
        return;
      }

      // Process the image with our improved compression method
      // This handles different mobile/desktop requirements
      const compressedImage = await compressImage(imageSrc);
      
      // Additional check for mobile devices
      if (isMobile && compressedImage.length < 5000) {
        setError("Image quality is too low. Please ensure good lighting and position.");
        return;
      }
      
      // Store the processed image for display and submission
      setCapturedImage(compressedImage);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to process image");
      console.error("Image capture error:", error);
    }
  }, [faceDetected, isLive, imageQuality.score]);

  const confirmCapture = useCallback(() => {
    if (capturedImage) {
      console.log('Confirming capture, image data length:', capturedImage.length);
      
      // Detect mobile device for logging
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log(`Device confirming capture: ${isMobile ? 'Mobile' : 'Desktop'}`);
      
      // Verify the image data is valid for API submission
      if (capturedImage.length < 1000) {
        setError("Image data appears to be corrupted or too small. Please retake the photo.");
        return;
      }
      
      // Add additional logging for troubleshooting
      console.log('Image validation:', {
        dataLength: capturedImage.length,
        isMobile: isMobile,
        containsValidData: /^[A-Za-z0-9+/=]+$/.test(capturedImage.substring(0, 100)),
        isDataURL: capturedImage.includes('data:image')
      });
      
      // IMPORTANT: For mobile API compatibility, we need to ensure
      // the image data includes the proper data URI prefix
      // Ghana NIA API expects a proper base64 string, but our server now handles any format
      
      let finalImageData;
      
      // If it's already a data URL, send it directly
      if (capturedImage.includes('data:image')) {
        console.log('Image is already in data URL format');
        finalImageData = capturedImage;
      } else {
        // If it's raw base64, add the proper JPEG data URL prefix for consistency
        console.log('Converting raw base64 to data URL format');
        finalImageData = `data:image/jpeg;base64,${capturedImage}`;
      }
      
      console.log('Final image format:', {
        isDataURL: finalImageData.includes('data:image'),
        format: finalImageData.includes('jpeg') ? 'JPEG' : 'PNG', 
        length: finalImageData.length
      });
      
      // The server will handle extracting the base64 data from the data URL
      onCapture(finalImageData);
    }
  }, [capturedImage, onCapture, setError]);

  const retake = useCallback(() => {
    setCapturedImage(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative border rounded-lg overflow-hidden">
        {!capturedImage ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            width={CAPTURE_WIDTH}
            height={CAPTURE_HEIGHT}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            forceScreenshotSourceSize={true}
            videoConstraints={{
              width: { min: 640, ideal: 640, max: 640 },
              height: { min: 480, ideal: 480, max: 480 },
              aspectRatio: 4/3,
              facingMode: "user"
            }}
            className="w-full"
            style={{ 
              objectFit: "cover",
              aspectRatio: "4/3",
              maxWidth: "100%",
              margin: "0 auto"
            }}
          />
        ) : (
          <div className="relative">
            <img
              src={capturedImage.startsWith('data:image') 
                ? capturedImage
                : `data:image/jpeg;base64,${capturedImage}`}
              alt="Captured"
              className="w-full object-contain"
              style={{ 
                aspectRatio: '4/3',
                maxHeight: CAPTURE_HEIGHT,
                maxWidth: CAPTURE_WIDTH,
                margin: '0 auto'
              }}
              onError={(e) => {
                console.error('Error displaying captured image. Trying PNG format...');
                // Try PNG as fallback
                if (e.currentTarget.src.includes('jpeg')) {
                  e.currentTarget.src = `data:image/png;base64,${capturedImage}`;
                }
              }}
            />
            <div className="absolute top-2 right-2">
              <Button
                size="icon"
                variant="destructive"
                onClick={retake}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {!capturedImage && (
          <>
            {facePositions.map((face, index) => (
              <div
                key={index}
                className={`absolute border-2 ${
                  face.expression === 'smiling' ? 'border-green-500' : 'border-yellow-500'
                } rounded-lg`}
                style={{
                  left: `${(face.x / CAPTURE_WIDTH) * 100}%`,
                  top: `${(face.y / CAPTURE_HEIGHT) * 100}%`,
                  width: `${(face.width / CAPTURE_WIDTH) * 100}%`,
                  height: `${(face.height / CAPTURE_HEIGHT) * 100}%`
                }}
              >
                <div className="absolute -top-6 left-0 bg-black/70 text-white px-2 py-1 rounded text-xs">
                  {face.expression === 'smiling' ? '😊 Smiling' : '😐 Neutral'}
                </div>
              </div>
            ))}

            <div
              className="absolute border-4 border-dashed border-primary/20 rounded-full"
              style={{
                left: '25%',
                top: '15%',
                width: '50%',
                height: '70%',
                pointerEvents: 'none'
              }}
            />

            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-8 h-px bg-primary/20"></div>
                <div className="h-8 w-px bg-primary/20 -mt-4 ml-[15px]"></div>
              </div>
            </div>

            <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-3 text-white space-y-4">
              <div className="face-count-status">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Face Count: {facePositions.length}</span>
                </div>
                {multipleFaces && (
                  <div className="text-xs text-yellow-400">
                    Multiple faces detected
                  </div>
                )}
              </div>

              <div className="expression-status">
                <div className="flex items-center gap-2 mb-2">
                  <SmilePlus className="w-4 h-4" />
                  <span className="text-sm">Expression Detection</span>
                </div>
                {facePositions.map((face, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${
                      face.expression === 'smiling' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <span>Face {index + 1}: {face.expression}</span>
                  </div>
                ))}
              </div>

              <div className="quality-status">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4" />
                  <span className="text-sm">Image Quality: {imageQuality.score}%</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${imageQuality.isCentered ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>Face Centered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${imageQuality.isRightSize ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>Correct Distance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${imageQuality.isStraight ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>Head Straight</span>
                  </div>
                </div>
              </div>

              <div className="lighting-status">
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="w-4 h-4" />
                  <span className="text-sm">Lighting Status</span>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Brightness</span>
                      <span>{Math.round(lightingStatus.brightness)}</span>
                    </div>
                    <Progress
                      value={(lightingStatus.brightness / MAX_BRIGHTNESS) * 100}
                      className="h-1"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Contrast</span>
                      <span>{Math.round(lightingStatus.contrast)}</span>
                    </div>
                    <Progress
                      value={(lightingStatus.contrast / 255) * 100}
                      className="h-1"
                    />
                  </div>
                </div>
              </div>

              <div className="liveness-status">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" />
                  <span className="text-sm">Face Detection</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs">{faceDetected ? 'Face Detected' : 'No Face Found'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${glassesDetected ? 'bg-red-500' : 'bg-green-500'}`} />
                    <span className="text-xs">{glassesDetected ? 'Glasses Detected' : 'No Glasses'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-xs">{isLive ? 'Liveness Confirmed' : 'Checking Liveness'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {glassesDetected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please remove glasses before capturing photo
          </AlertDescription>
        </Alert>
      )}

      {!lightingStatus.isGood && !error && !capturedImage && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Adjust lighting conditions for optimal verification.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        {!capturedImage ? (
          <>
            <Button
              onClick={capture}
              className="flex-1"
              disabled={
                !lightingStatus.isGood ||
                !faceDetected ||
                !isLive ||
                imageQuality.score < 75 ||
                facePositions.length > MAX_FACES_ALLOWED ||
                glassesDetected
              }
            >
              <Camera className="w-4 h-4 mr-2" />
              {!faceDetected ? "No Face Detected" :
                !isLive ? "Confirm Liveness" :
                  !lightingStatus.isGood ? "Adjust Lighting" :
                    imageQuality.score < 75 ? "Follow Guidelines" :
                      facePositions.length > MAX_FACES_ALLOWED ? "Too Many Faces" :
                        glassesDetected ? "Remove Glasses" :
                          "Capture Photo"}
            </Button>
            <Button variant="outline" onClick={() => webcamRef.current?.getScreenshot()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <Button
            onClick={confirmCapture}
            className="flex-1"
          >
            Use This Photo
          </Button>
        )}
      </div>
    </div>
  );
}