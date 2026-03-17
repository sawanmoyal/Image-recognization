import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, ScanLine, AlertTriangle, User, Target, CheckCircle2, Brain, Cpu, ZapOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalyzeActivity } from "@workspace/api-client-react";
import type { ActivityAnalysisResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatConfidence, getActivityColor } from "@/lib/utils";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";

const ACTIVITY_ICONS: Record<string, string> = {
  walking: "🚶",
  sitting: "🪑",
  running: "🏃",
  falling: "⚠️",
  using_phone: "📱",
  fighting: "🚨",
};

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const analyzeMutation = useAnalyzeActivity({
    mutation: {
      onSuccess: (data) => {
        const critical = data.detections.find(
          (d) => d.activity === "falling" || d.activity === "fighting"
        );
        if (critical) {
          toast({
            title: `⚠ ALERT: ${critical.activity.toUpperCase()} DETECTED`,
            description: `Confidence: ${formatConfidence(critical.confidence)} — event logged`,
            variant: "destructive",
          });
        } else {
          toast({ title: "Scan Complete", description: `${data.detections.length} subject(s) identified.` });
        }
      },
      onError: (error) => {
        toast({
          title: "Analysis Failed",
          description: error.message || "Could not process image.",
          variant: "destructive",
        });
      },
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const f = acceptedFiles[0];
      if (f) {
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
        analyzeMutation.mutate({ data: { file: f } });
      }
    },
    [analyzeMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
  });

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    analyzeMutation.reset();
  };

  const result = analyzeMutation.data;
  const hasAlert = result?.detections.some(
    (d) => d.activity === "falling" || d.activity === "fighting"
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Drop zone */}
        {!file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            {...(getRootProps() as any)}
            className={cn(
              "sci-fi-panel p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[420px] relative overflow-hidden",
              isDragActive
                ? "border-primary bg-primary/5 shadow-[0_0_40px_rgba(0,240,255,0.15)]"
                : "border-border hover:border-primary/40 hover:bg-white/[0.015]"
            )}
          >
            <input {...getInputProps()} />
            {isDragActive && <div className="scan-line" />}

            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
              <div className="relative z-10 w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/5">
                <Upload className={cn("w-8 h-8 transition-colors", isDragActive ? "text-primary" : "text-muted-foreground")} />
              </div>
            </div>

            <h3 className="text-2xl font-display text-foreground mb-2 glow-text tracking-widest">
              {isDragActive ? "RELEASE TO SCAN" : "UPLOAD IMAGE FOR ANALYSIS"}
            </h3>
            <p className="text-muted-foreground font-mono text-sm max-w-md mb-6">
              Supports JPG, PNG, WEBP — Max 20MB. Real MediaPipe pose detection + PyTorch classification.
            </p>

            {/* Tech pills */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {["MediaPipe Pose", "PyTorch MLP", "OpenCV", "Real-time AI"].map((t) => (
                <div key={t} className="text-[10px] font-mono bg-primary/10 border border-primary/20 text-primary/70 px-3 py-1 rounded-full">
                  {t}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Processing */}
        {analyzeMutation.isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="sci-fi-panel p-12 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden"
          >
            <div className="scan-line" />
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse" />
              <Target className="w-16 h-16 text-primary relative z-10 animate-[spin_2s_linear_infinite]" />
            </div>
            <h3 className="text-xl font-display text-primary tracking-widest mb-2 glow-text">PROCESSING FRAME…</h3>
            <div className="space-y-1 text-center">
              {["Extracting MediaPipe pose landmarks", "Running PyTorch neural network", "Classifying activity pattern"].map((step, i) => (
                <motion.p
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.4 }}
                  className="text-muted-foreground font-mono text-xs"
                >
                  {step}…
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && !analyzeMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Alert banner */}
              {hasAlert && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="sci-fi-panel alert-pulse bg-destructive/10 border-destructive p-4 flex items-center gap-4"
                >
                  <AlertTriangle className="w-7 h-7 text-destructive animate-bounce shrink-0" />
                  <div>
                    <div className="font-display font-bold text-destructive tracking-widest uppercase">
                      ⚠ Critical Event Detected — Logged Automatically
                    </div>
                    <div className="font-mono text-destructive/70 text-xs mt-0.5">
                      {result.eventsSaved} special event(s) saved to database
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Image panel */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="sci-fi-panel relative overflow-hidden p-1 bg-black/40">
                    {/* Feed overlay */}
                    <div className="absolute top-0 left-0 z-10 px-3 py-1.5 bg-black/70 border-b border-r border-border font-mono text-[10px] text-primary flex items-center gap-2 backdrop-blur">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      ANALYZED · {result.frameTimestamp.split("T")[1]?.split(".")[0]}
                    </div>

                    {/* MediaPipe annotated image */}
                    <img
                      src={result.processedImageUrl ?? previewUrl ?? ""}
                      alt="Analyzed frame"
                      className="w-full h-auto object-contain bg-black/60 mt-6"
                    />

                    {/* Fallback bbox overlays if no processed image */}
                    {!result.processedImageUrl &&
                      result.detections.map((d, i) => {
                        if (!d.bbox) return null;
                        const colors = getActivityColor(d.activity);
                        return (
                          <div
                            key={i}
                            className={cn("absolute border-2 pointer-events-none", colors.border)}
                            style={{
                              left: `${d.bbox.x}%`,
                              top: `${d.bbox.y}%`,
                              width: `${d.bbox.width}%`,
                              height: `${d.bbox.height}%`,
                            }}
                          >
                            <div className={cn("absolute -top-6 left-0 px-2 py-0.5 text-[10px] font-mono font-bold whitespace-nowrap", colors.bg, colors.text)}>
                              {d.activity.toUpperCase()} [{formatConfidence(d.confidence)}]
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Subjects", value: result.detections.length, icon: User },
                      { label: "AI Engine", value: result.processedImageUrl ? "MediaPipe" : "Heuristic", icon: Brain },
                      { label: "Events Logged", value: result.eventsSaved, icon: result.eventsSaved > 0 ? AlertTriangle : CheckCircle2 },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="sci-fi-panel p-3 flex items-center gap-3">
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <div className="text-xs font-mono text-muted-foreground">{label}</div>
                          <div className="font-mono font-bold text-foreground">{value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detections panel */}
                <div className="space-y-3">
                  <div className="sci-fi-panel p-4 flex justify-between items-center">
                    <h3 className="font-display tracking-widest text-primary text-sm">SUBJECTS DETECTED</h3>
                    <Badge variant="outline" className="border-primary text-primary font-mono text-base px-3">
                      {result.detections.length}
                    </Badge>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {result.detections.length === 0 ? (
                      <div className="sci-fi-panel p-8 text-center">
                        <ZapOff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <div className="text-muted-foreground font-mono text-xs">No humans detected in frame</div>
                      </div>
                    ) : (
                      result.detections.map((det, i) => {
                        const colors = getActivityColor(det.activity);
                        const isAlert = det.activity === "falling" || det.activity === "fighting";
                        const emoji = ACTIVITY_ICONS[det.activity] ?? "👤";
                        return (
                          <motion.div
                            key={det.personId}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={cn("sci-fi-panel p-4 space-y-3", isAlert && "alert-pulse border-destructive")}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                                <span className="text-lg">{emoji}</span>
                                <span>SUBJ-{String(det.personId).padStart(4, "0")}</span>
                              </div>
                              <Badge className={cn("uppercase text-[10px] tracking-wider", colors.bg, colors.text, colors.border, "border")}>
                                {det.activity.replace("_", " ")}
                              </Badge>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-muted-foreground">Confidence</span>
                                <span className="font-bold text-foreground">{formatConfidence(det.confidence)}</span>
                              </div>
                              <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-border/30">
                                <motion.div
                                  className={cn("h-full rounded-full", colors.bg.replace("/20", ""))}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${det.confidence * 100}%` }}
                                  transition={{ type: "spring", stiffness: 80, delay: i * 0.1 + 0.2 }}
                                />
                              </div>
                            </div>

                            {det.bbox && (
                              <div className="text-[9px] font-mono text-muted-foreground/40 grid grid-cols-2 gap-1">
                                <span>X: {Math.round(det.bbox.x)}</span>
                                <span>Y: {Math.round(det.bbox.y)}</span>
                                <span>W: {Math.round(det.bbox.width)}</span>
                                <span>H: {Math.round(det.bbox.height)}</span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>

                  <Button variant="outline" className="w-full font-mono tracking-widest text-xs" onClick={reset}>
                    <ScanLine className="w-4 h-4 mr-2" /> NEW SCAN
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
