import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, ScanLine, AlertTriangle, User, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { cn, formatConfidence, getActivityColor } from "@/lib/utils";

interface Detection {
  personId: number;
  activity: string;
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

interface AnalysisResult {
  detections: Detection[];
  processedImageUrl?: string;
  frameTimestamp: string;
  eventsSaved: number;
}

const ANALYSIS_INTERVAL_MS = 1500;

export default function WebcamPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // FPS counter
  useEffect(() => {
    const timer = setInterval(() => {
      setFps((prev) => {
        const current = frameCount;
        setFrameCount(0);
        return current;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [frameCount]);

  const captureAndAnalyze = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setFrameCount((c) => c + 1);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setIsAnalyzing(true);
      try {
        const formData = new FormData();
        formData.append("file", blob, "webcam_frame.jpg");

        const res = await fetch("/api/activity/analyze", {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data: AnalysisResult = await res.json();
        setResult(data);

        // Alert for critical events
        const critical = data.detections.find(
          (d) => d.activity === "falling" || d.activity === "fighting"
        );
        if (critical) {
          toast({
            title: `⚠ CRITICAL: ${critical.activity.toUpperCase()} DETECTED`,
            description: `Subject ${critical.personId} — ${formatConfidence(critical.confidence)} confidence`,
            variant: "destructive",
          });
        }
      } catch {
        // Silently continue on analysis errors to not spam toasts
      } finally {
        setIsAnalyzing(false);
      }
    }, "image/jpeg", 0.85);
  }, [toast]);

  const startWebcam = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      intervalRef.current = setInterval(captureAndAnalyze, ANALYSIS_INTERVAL_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not access webcam";
      setError(msg);
      toast({ title: "Webcam Error", description: msg, variant: "destructive" });
    }
  }, [captureAndAnalyze, toast]);

  const stopWebcam = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
    setResult(null);
  }, []);

  useEffect(() => () => stopWebcam(), [stopWebcam]);

  const hasAlert = result?.detections.some(
    (d) => d.activity === "falling" || d.activity === "fighting"
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header bar */}
        <div className="sci-fi-panel px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("flex items-center gap-2 font-mono text-xs", isActive ? "text-green-400" : "text-muted-foreground")}>
              {isActive ? <Wifi className="w-3 h-3 animate-pulse" /> : <WifiOff className="w-3 h-3" />}
              {isActive ? "LIVE FEED ACTIVE" : "FEED OFFLINE"}
            </div>
            {isActive && (
              <>
                <div className="w-px h-4 bg-border" />
                <span className="font-mono text-xs text-muted-foreground">
                  {fps} FPS
                </span>
                <div className="w-px h-4 bg-border" />
                <div className={cn("flex items-center gap-1.5 font-mono text-xs", isAnalyzing ? "text-primary" : "text-muted-foreground")}>
                  <RefreshCw className={cn("w-3 h-3", isAnalyzing && "animate-spin")} />
                  {isAnalyzing ? "ANALYZING..." : "STANDBY"}
                </div>
              </>
            )}
          </div>
          <div className="flex gap-3">
            {!isActive ? (
              <Button className="bg-primary text-background hover:bg-primary/90 font-mono text-xs tracking-widest" onClick={startWebcam}>
                <Camera className="w-4 h-4 mr-2" /> ACTIVATE FEED
              </Button>
            ) : (
              <Button variant="destructive" className="font-mono text-xs tracking-widest" onClick={stopWebcam}>
                <CameraOff className="w-4 h-4 mr-2" /> TERMINATE FEED
              </Button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="sci-fi-panel p-4 border-destructive bg-destructive/10 text-destructive font-mono text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Video Feed */}
          <div className="lg:col-span-2 space-y-4">

            {/* Critical alert */}
            <AnimatePresence>
              {hasAlert && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="sci-fi-panel alert-pulse bg-destructive/10 border-destructive p-4 flex items-center gap-4"
                >
                  <AlertTriangle className="w-8 h-8 text-destructive animate-bounce shrink-0" />
                  <div>
                    <div className="font-display font-bold text-destructive tracking-widest uppercase text-lg">
                      ⚠ Critical Activity Detected
                    </div>
                    <div className="font-mono text-destructive/70 text-sm">
                      Immediate review required — event logged automatically
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Video container */}
            <div className="sci-fi-panel relative overflow-hidden bg-black aspect-video flex items-center justify-center">

              {/* Timestamp overlay */}
              {isActive && (
                <div className="absolute top-0 left-0 z-20 px-3 py-1.5 bg-black/70 border-b border-r border-border font-mono text-xs text-primary flex items-center gap-2 backdrop-blur">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  REC — {new Date().toLocaleTimeString()}
                </div>
              )}

              {/* Scan line animation */}
              {isActive && <div className="scan-line" />}

              {/* Inactive placeholder */}
              {!isActive && (
                <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                  <CameraOff className="w-20 h-20 opacity-20" />
                  <div className="font-mono text-sm tracking-widest opacity-50">FEED NOT INITIALIZED</div>
                </div>
              )}

              {/* Live video */}
              <video
                ref={videoRef}
                className={cn("w-full h-full object-cover", !isActive && "hidden")}
                muted
                playsInline
              />

              {/* Bounding box overlays */}
              {isActive && result?.detections.map((det) => {
                if (!det.bbox) return null;
                const colors = getActivityColor(det.activity);
                const b = det.bbox;
                return (
                  <div
                    key={det.personId}
                    className={cn("absolute border-2 pointer-events-none transition-all duration-300", colors.border)}
                    style={{
                      left: `${(b.x / (videoRef.current?.videoWidth || 640)) * 100}%`,
                      top: `${(b.y / (videoRef.current?.videoHeight || 480)) * 100}%`,
                      width: `${(b.width / (videoRef.current?.videoWidth || 640)) * 100}%`,
                      height: `${(b.height / (videoRef.current?.videoHeight || 480)) * 100}%`,
                    }}
                  >
                    <div className={cn("absolute -top-6 left-0 px-2 py-0.5 text-xs font-mono font-bold whitespace-nowrap", colors.bg, colors.text)}>
                      {det.activity.replace("_", " ").toUpperCase()} [{formatConfidence(det.confidence)}]
                    </div>
                  </div>
                );
              })}

              {/* Hidden canvas for frame capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Processed frame (MediaPipe annotated) */}
            <AnimatePresence>
              {result?.processedImageUrl && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="sci-fi-panel p-1 relative"
                >
                  <div className="absolute top-0 left-0 px-3 py-1 bg-background/80 border-b border-r border-border font-mono text-xs text-primary z-10 backdrop-blur">
                    POSE SKELETON — MediaPipe Output
                  </div>
                  <img
                    src={result.processedImageUrl}
                    alt="MediaPipe pose skeleton"
                    className="w-full h-auto object-contain"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Detection Panel */}
          <div className="space-y-4">

            {/* Status */}
            <div className="sci-fi-panel p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-display tracking-widest text-primary text-sm">LIVE DETECTIONS</h3>
                <Badge variant="outline" className="border-primary text-primary font-mono">
                  {result?.detections.length ?? 0} SUBJECTS
                </Badge>
              </div>

              {result?.detections.map((det) => {
                const colors = getActivityColor(det.activity);
                const isAlert = det.activity === "falling" || det.activity === "fighting";
                return (
                  <motion.div
                    key={`${det.personId}-${det.activity}`}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn("sci-fi-panel p-4 space-y-2", isAlert && "border-destructive alert-pulse")}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                        <User className="w-3 h-3" />
                        SUBJ-{String(det.personId).padStart(4, "0")}
                      </div>
                      <Badge className={cn("uppercase text-xs tracking-wider", colors.bg, colors.text, colors.border, "border")}>
                        {det.activity.replace("_", " ")}
                      </Badge>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="text-foreground font-bold">{formatConfidence(det.confidence)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                        <motion.div
                          className={cn("h-full rounded-full", colors.bg.replace("/20", ""))}
                          initial={{ width: 0 }}
                          animate={{ width: `${det.confidence * 100}%` }}
                          transition={{ type: "spring", stiffness: 100 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {(!result || result.detections.length === 0) && (
                <div className="text-center py-8 text-muted-foreground font-mono text-xs border border-dashed border-border">
                  {isActive ? "SCANNING FOR SUBJECTS..." : "FEED NOT ACTIVE"}
                </div>
              )}
            </div>

            {/* Activity History Feed */}
            <div className="sci-fi-panel p-4">
              <h3 className="font-display tracking-widest text-primary text-sm mb-3">ACTIVITY PULSE</h3>
              <AnimatePresence mode="popLayout">
                {result && (
                  <motion.div
                    key={result.frameTimestamp}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-mono text-muted-foreground flex justify-between items-center py-1.5 border-b border-border/30"
                  >
                    <span className="text-primary/70">
                      {new Date(result.frameTimestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {result.detections.map((d) => {
                        const colors = getActivityColor(d.activity);
                        return (
                          <span key={d.personId} className={cn("px-1.5 py-0.5 rounded text-[10px]", colors.bg, colors.text)}>
                            {d.activity.replace("_", " ")}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!result && (
                <div className="text-center py-4 text-muted-foreground font-mono text-xs">
                  Awaiting feed...
                </div>
              )}
            </div>

            {/* Instructions */}
            {!isActive && (
              <div className="sci-fi-panel p-4 text-xs font-mono text-muted-foreground space-y-2">
                <div className="text-primary text-xs tracking-widest mb-2">HOW IT WORKS</div>
                <div className="flex gap-2"><span className="text-primary">01</span> Activate the camera feed above</div>
                <div className="flex gap-2"><span className="text-primary">02</span> MediaPipe extracts 33 body landmarks</div>
                <div className="flex gap-2"><span className="text-primary">03</span> PyTorch classifies the activity</div>
                <div className="flex gap-2"><span className="text-primary">04</span> Results update every 1.5 seconds</div>
                <div className="flex gap-2"><span className="text-destructive">05</span> Falls & fights trigger alerts</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
