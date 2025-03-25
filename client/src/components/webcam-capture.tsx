import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Sun, AlertTriangle, User, XCircle, Users, SmilePlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const MAX_FILE_SIZE = 512 * 1024; // 512KB in bytes
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

// Update the image capture and compression function
const compressImage = (imageSrc: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Create temporary canvas for compression
      const canvas = document.createElement('canvas');

      // Start with smaller dimensions
      let width = Math.min(CAPTURE_WIDTH, 240);
      let height = Math.min(CAPTURE_HEIGHT, 180);

      // If still too large, scale down proportionally
      const maxDimension = 240;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw image with reduced dimensions
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels if needed
      let quality = 0.4; // Start with lower quality
      let compressedImage = canvas.toDataURL('image/png', quality);
      let base64Size = (compressedImage.length * 3) / 4;

      // Gradually reduce quality until file size is under limit
      while (base64Size > MAX_FILE_SIZE && quality > 0.1) {
        quality -= 0.1;
        compressedImage = canvas.toDataURL('image/png', quality);
        base64Size = (compressedImage.length * 3) / 4;
      }

      if (base64Size > MAX_FILE_SIZE) {
        reject(new Error(`Image size (${(base64Size / 1024).toFixed(2)}KB) exceeds 512KB limit. Try moving closer to the camera or ensuring better lighting.`));
        return;
      }

      // Convert to base64 without the data URL prefix
      const base64Data = compressedImage.split(',')[1];
      resolve(base64Data);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
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
    const imageSrc = webcamRef.current?.getScreenshot({
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT
    });

    if (!imageSrc) {
      setError("Failed to capture image");
      return;
    }

    try {
      const compressedImage = await compressImage(imageSrc);

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

      const { brightness, contrast } = await analyzeLighting(imageSrc); // analyzeLighting should use original imageSrc, not compressed
      if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) {
        setError("Poor lighting conditions. Please adjust lighting.");
        return;
      }
      if (contrast < MIN_CONTRAST) {
        setError("Image lacks contrast. Please improve lighting conditions.");
        return;
      }

      setCapturedImage(compressedImage);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to process image");
    }
  }, [faceDetected, isLive, imageQuality.score]);

  const confirmCapture = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture]);

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
            screenshotFormat="image/png"
            videoConstraints={{
              width: CAPTURE_WIDTH,
              height: CAPTURE_HEIGHT,
              facingMode: "user"
            }}
            className="w-full"
          />
        ) : (
          <div className="relative">
            <img
              src={`data:image/png;base64,${capturedImage}`} // Add data URL prefix back for display
              alt="Captured"
              className="w-full h-auto"
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