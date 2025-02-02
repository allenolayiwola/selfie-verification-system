import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Sun, AlertTriangle, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MIN_BRIGHTNESS = 100;
const MAX_BRIGHTNESS = 200;
const MIN_CONTRAST = 30;
const FACE_CONFIDENCE_THRESHOLD = 0.8;
const MOVEMENT_THRESHOLD = 20;
const MOVEMENT_HISTORY_LENGTH = 10;
const IDEAL_FACE_WIDTH_RATIO = 0.5; // Face should take up ~50% of frame width
const MAX_HEAD_TILT_ANGLE = 15; // Maximum allowed head tilt in degrees
const MIN_FACE_SIZE = 0.3; // Minimum face size relative to frame
const MAX_FACE_SIZE = 0.7; // Maximum face size relative to frame

interface WebcamCaptureProps {
  onCapture: (imageData: string) => void;
}

interface FacePosition {
  x: number;
  y: number;
  width: number;
  height: number;
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
  const [facePosition, setFacePosition] = useState<FacePosition | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [movementHistory, setMovementHistory] = useState<FacePosition[]>([]);
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

  // Initialize face detector
  useEffect(() => {
    const loadModel = async () => {
      await tf.ready();
      const model = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        { runtime: 'tfjs' }
      );
      setFaceDetector(model);
    };
    loadModel();
  }, []);

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

  const analyzeImageQuality = useCallback((face: FacePosition) => {
    // Check if face is centered
    const centerX = CAPTURE_WIDTH / 2;
    const centerY = CAPTURE_HEIGHT / 2;
    const faceCenter = {
      x: face.x + face.width / 2,
      y: face.y + face.height / 2
    };

    const isCentered = 
      Math.abs(faceCenter.x - centerX) < CAPTURE_WIDTH * 0.1 &&
      Math.abs(faceCenter.y - centerY) < CAPTURE_HEIGHT * 0.1;

    // Check face size
    const faceWidthRatio = face.width / CAPTURE_WIDTH;
    const isRightSize = 
      faceWidthRatio >= MIN_FACE_SIZE && 
      faceWidthRatio <= MAX_FACE_SIZE;

    // Calculate head tilt (simplified)
    const isStraight = true; // Placeholder for head tilt detection

    // Check sharpness (simplified)
    const isSharp = true; // Placeholder for blur detection

    // Calculate overall quality score (0-100)
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

  // Check face detection and liveness
  const detectFace = useCallback(async () => {
    if (!faceDetector || !webcamRef.current) return;

    const video = webcamRef.current.video;
    if (!video) return;

    try {
      const faces = await faceDetector.estimateFaces(video);
      const face = faces[0];

      if (face && face.box && face.box.width) {
        const newPosition = {
          x: face.box.xMin,
          y: face.box.yMin,
          width: face.box.width,
          height: face.box.height
        };

        setFacePosition(newPosition);
        setFaceDetected(true);
        setImageQuality(analyzeImageQuality(newPosition));

        // Update movement history for liveness detection
        setMovementHistory(prev => {
          const newHistory = [...prev, newPosition].slice(-MOVEMENT_HISTORY_LENGTH);

          // Check for movement
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
      } else {
        setFaceDetected(false);
        setFacePosition(null);
      }
    } catch (error) {
      console.error('Face detection error:', error);
    }
  }, [faceDetector, analyzeImageQuality]);

  // Run face detection loop
  useEffect(() => {
    const interval = setInterval(detectFace, 100);
    return () => clearInterval(interval);
  }, [detectFace]);

  const checkLightingConditions = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    const { brightness, contrast } = await analyzeLighting(imageSrc);
    const isGood = brightness >= MIN_BRIGHTNESS && 
                   brightness <= MAX_BRIGHTNESS && 
                   contrast >= MIN_CONTRAST;

    setLightingStatus({ brightness, contrast, isGood });
  }, []);

  // Check lighting conditions every second
  useEffect(() => {
    const interval = setInterval(checkLightingConditions, 1000);
    return () => clearInterval(interval);
  }, [checkLightingConditions]);

  const capture = useCallback(async () => {
    setError(null);
    const imageSrc = webcamRef.current?.getScreenshot();

    if (!imageSrc) {
      setError("Failed to capture image");
      return;
    }

    // Check file size
    const base64Size = (imageSrc.length * 3) / 4;
    if (base64Size > MAX_FILE_SIZE) {
      setError("Image size exceeds 1MB limit");
      return;
    }

    // Check face detection
    if (!faceDetected) {
      setError("No face detected in frame");
      return;
    }

    // Check liveness
    if (!isLive) {
      setError("Please move slightly to confirm liveness");
      return;
    }

    // Check image quality
    if (imageQuality.score < 75) {
      setError("Please adjust your position according to the guidelines");
      return;
    }

    // Final lighting check
    const { brightness, contrast } = await analyzeLighting(imageSrc);
    if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) {
      setError("Poor lighting conditions. Please adjust lighting.");
      return;
    }
    if (contrast < MIN_CONTRAST) {
      setError("Image lacks contrast. Please improve lighting conditions.");
      return;
    }

    onCapture(imageSrc);
  }, [onCapture, faceDetected, isLive, imageQuality.score]);

  return (
    <div className="space-y-4">
      <div className="relative border rounded-lg overflow-hidden">
        <Webcam
          ref={webcamRef}
          audio={false}
          width={CAPTURE_WIDTH}
          height={CAPTURE_HEIGHT}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: CAPTURE_WIDTH,
            height: CAPTURE_HEIGHT,
            facingMode: "user"
          }}
          className="w-full"
        />

        {/* Face detection overlay */}
        {facePosition && (
          <div
            className="absolute border-2 border-green-500 rounded-lg"
            style={{
              left: `${(facePosition.x / CAPTURE_WIDTH) * 100}%`,
              top: `${(facePosition.y / CAPTURE_HEIGHT) * 100}%`,
              width: `${(facePosition.width / CAPTURE_WIDTH) * 100}%`,
              height: `${(facePosition.height / CAPTURE_HEIGHT) * 100}%`
            }}
          />
        )}

        {/* Ideal face position guide */}
        <div 
          className="absolute border-4 border-dashed border-primary/20 rounded-full face-guide"
          style={{
            left: '25%',
            top: '15%',
            width: '50%',
            height: '70%',
            pointerEvents: 'none'
          }}
        />

        {/* Center cross guide */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-8 h-px bg-primary/20"></div>
            <div className="h-8 w-px bg-primary/20 -mt-4 ml-[15px]"></div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-3 text-white space-y-4">
          {/* Image Quality Status */}
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

          {/* Lighting status */}
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

          {/* Face detection status */}
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
                <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-xs">{isLive ? 'Liveness Confirmed' : 'Checking Liveness'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!lightingStatus.isGood && !error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Adjust lighting conditions for optimal verification.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button 
          onClick={capture} 
          className="flex-1 capture-button"
          disabled={!lightingStatus.isGood || !faceDetected || !isLive || imageQuality.score < 75}
        >
          <Camera className="w-4 h-4 mr-2" />
          {!faceDetected ? "No Face Detected" : 
           !isLive ? "Confirm Liveness" :
           !lightingStatus.isGood ? "Adjust Lighting" :
           imageQuality.score < 75 ? "Follow Guidelines" :
           "Capture Photo"}
        </Button>
        <Button variant="outline" onClick={() => webcamRef.current?.getScreenshot()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}