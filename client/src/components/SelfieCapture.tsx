import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, RefreshCw, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

interface SelfieCaptureProps {
  onCapture: (base64: string) => void;
  onCancel: () => void;
}

let mediapipeDetectorPromise: Promise<FaceDetector> | null = null;

function getMediaPipeDetector(): Promise<FaceDetector> {
  if (!mediapipeDetectorPromise) {
    mediapipeDetectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })();
  }
  return mediapipeDetectorPromise;
}

export default function SelfieCapture({ onCapture, onCancel }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [validatingCapture, setValidatingCapture] = useState(false);
  const [captureValid, setCaptureValid] = useState<boolean | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const animFrameRef = useRef<number>(0);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Acesso à câmera negado. Permita o acesso para continuar.");
      } else if (err.name === "NotFoundError") {
        setError("Nenhuma câmera encontrada neste dispositivo.");
      } else {
        setError("Erro ao acessar a câmera. Verifique as permissões.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    startCamera();

    setModelLoading(true);
    getMediaPipeDetector()
      .then((detector) => {
        detectorRef.current = detector;
        setModelLoading(false);
      })
      .catch((err) => {
        console.error("MediaPipe FaceDetector failed to load:", err);
        setModelLoading(false);
        setError("Erro ao carregar detector facial. Recarregue a página.");
      });

    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (!cameraReady || capturedImage || !detectorRef.current || modelLoading) return;

    let running = true;

    const detectFaces = async () => {
      if (!running || !videoRef.current || !canvasRef.current || !detectorRef.current) return;

      if (videoRef.current.readyState >= 2) {
        try {
          const video = videoRef.current;
          const tmpCanvas = canvasRef.current;
          tmpCanvas.width = video.videoWidth;
          tmpCanvas.height = video.videoHeight;
          const ctx = tmpCanvas.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.translate(tmpCanvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);
            ctx.restore();

            const result = detectorRef.current.detect(tmpCanvas);
            if (running) {
              const hasFace = result.detections.length > 0;
              setFaceDetected(hasFace);
              setDetecting(true);
            }
          }
        } catch {
          if (running) {
            setFaceDetected(false);
            setDetecting(true);
          }
        }
      }

      if (running) {
        animFrameRef.current = requestAnimationFrame(() => {
          setTimeout(detectFaces, 400);
        });
      }
    };

    detectFaces();
    return () => { running = false; };
  }, [cameraReady, capturedImage, modelLoading]);

  const validateCapturedImage = useCallback(async (imageBase64: string): Promise<boolean> => {
    const detector = detectorRef.current;
    if (!detector) return false;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const tmpCanvas = document.createElement("canvas");
          tmpCanvas.width = img.width;
          tmpCanvas.height = img.height;
          const ctx = tmpCanvas.getContext("2d");
          if (!ctx) { resolve(false); return; }
          ctx.drawImage(img, 0, 0);

          const result = detector.detect(tmpCanvas);
          resolve(result.detections.length > 0);
        } catch {
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = imageBase64;
    });
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.8);

    setCapturedImage(base64);
    stopCamera();

    setValidatingCapture(true);
    setCaptureValid(null);
    const isValid = await validateCapturedImage(base64);
    setCaptureValid(isValid);
    setValidatingCapture(false);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setFaceDetected(false);
    setDetecting(false);
    setCaptureValid(null);
    setValidatingCapture(false);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage && captureValid) {
      onCapture(capturedImage);
    }
  };

  const isReady = cameraReady && !modelLoading && detectorRef.current !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-gray-800 text-sm">Verificação por foto</h3>
        <button onClick={onCancel} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center" data-testid="button-cancel-selfie">
          <X size={14} />
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Tire uma foto do seu rosto para comprovar sua identidade. Posicione seu rosto dentro do guia oval.
      </p>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
          <button onClick={() => { setError(null); startCamera(); }}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-semibold"
            data-testid="button-retry-camera">
            Tentar novamente
          </button>
        </div>
      ) : capturedImage ? (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-black">
            <img src={capturedImage} alt="Selfie capturada" className="w-full" data-testid="img-captured-selfie" />
            {validatingCapture && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-white/20 border-t-white rounded-full mx-auto mb-2" />
                  <p className="text-white text-xs font-medium">Verificando rosto...</p>
                </div>
              </div>
            )}
            {captureValid === false && !validatingCapture && (
              <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-4 mx-4 text-center shadow-lg">
                  <AlertCircle size={32} className="text-red-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-red-700">Rosto não detectado</p>
                  <p className="text-xs text-gray-500 mt-1">A foto precisa mostrar claramente o rosto de uma pessoa. Tente novamente com boa iluminação.</p>
                </div>
              </div>
            )}
            {captureValid === true && !validatingCapture && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium bg-green-500/90 text-white">
                Rosto verificado ✓
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleRetake}
              className="flex-1 py-3 border border-gray-200 rounded-2xl font-semibold text-gray-600 flex items-center justify-center gap-2"
              data-testid="button-retake-selfie">
              <RefreshCw size={16} />
              Tirar outra
            </button>
            <button onClick={handleConfirm}
              disabled={!captureValid || validatingCapture}
              className="flex-1 py-3 bg-green-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              data-testid="button-confirm-selfie">
              <Check size={16} />
              Confirmar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
              data-testid="video-selfie-camera"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-48 h-60 rounded-[50%] border-[3px] ${
                detecting ? (faceDetected ? "border-green-400" : "border-red-400") : "border-white/60"
              } transition-colors duration-300`} />
            </div>

            {(!cameraReady || modelLoading) && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 size={32} className="animate-spin text-white mx-auto mb-2" />
                  <p className="text-white/60 text-xs">
                    {modelLoading ? "Carregando detector facial..." : "Iniciando câmera..."}
                  </p>
                </div>
              </div>
            )}

            {isReady && detecting && (
              <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium ${
                faceDetected ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
              }`}>
                {faceDetected ? "Rosto detectado ✓" : "Posicione seu rosto"}
              </div>
            )}
          </div>

          <button
            onClick={handleCapture}
            disabled={!isReady || !faceDetected}
            className="w-full py-3.5 bg-green-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]"
            data-testid="button-capture-selfie"
          >
            <Camera size={18} />
            {modelLoading ? "Carregando..." : !faceDetected ? "Posicione seu rosto para capturar" : "Capturar foto"}
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
