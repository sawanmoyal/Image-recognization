import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, ScanLine, AlertTriangle, User, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalyzeActivity } from "@workspace/api-client-react";
import type { ActivityAnalysisResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatConfidence, getActivityColor } from "@/lib/utils";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const analyzeMutation = useAnalyzeActivity({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Scan Complete",
          description: "Subject activity analysis finished.",
        });
      },
      onError: (error) => {
        toast({
          title: "Analysis Failed",
          description: error.message || "Could not process media stream.",
          variant: "destructive",
        });
      }
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      
      analyzeMutation.mutate({ data: { file: selectedFile } });
    }
  }, [analyzeMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    maxFiles: 1,
  });

  const resetAnalysis = () => {
    setFile(null);
    setPreviewUrl(null);
    analyzeMutation.reset();
  };

  const result = analyzeMutation.data;
  const hasAlerts = result?.detections.some(
    d => d.activity.toLowerCase().includes('fall') || d.activity.toLowerCase().includes('fight')
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Upload Zone */}
        {!file && (
          <div
            {...getRootProps()}
            className={cn(
              "sci-fi-panel p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[400px]",
              isDragActive ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(0,240,255,0.2)]" : "border-border hover:border-primary/50 hover:bg-white/[0.02]"
            )}
          >
            <input {...getInputProps()} />
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <Upload className={cn("w-16 h-16 relative z-10 transition-colors", isDragActive ? "text-primary" : "text-muted-foreground")} />
            </div>
            <h3 className="text-2xl font-display text-foreground mb-2 glow-text">Initialize Media Scan</h3>
            <p className="text-muted-foreground font-mono text-sm max-w-md">
              Drag & drop visual data feed here, or click to browse secure local storage.
            </p>
          </div>
        )}

        {/* Processing State */}
        {analyzeMutation.isPending && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="sci-fi-panel p-12 flex flex-col items-center justify-center min-h-[400px] relative"
          >
            <div className="scan-line" />
            <Target className="w-16 h-16 text-primary mb-6 animate-[spin_3s_linear_infinite]" />
            <h3 className="text-2xl font-display text-primary tracking-widest mb-2">ANALYZING STREAM...</h3>
            <p className="text-muted-foreground font-mono animate-pulse">Running neural heuristics on subject subjects</p>
          </motion.div>
        )}

        {/* Results View */}
        <AnimatePresence>
          {result && !analyzeMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Image Display */}
              <div className="lg:col-span-2 space-y-4">
                {hasAlerts && (
                  <div className="sci-fi-panel alert-pulse bg-destructive/10 border-destructive p-4 flex items-center space-x-4">
                    <AlertTriangle className="w-8 h-8 text-destructive animate-bounce" />
                    <div>
                      <h4 className="text-destructive font-display font-bold text-lg tracking-widest uppercase">Critical Event Detected</h4>
                      <p className="text-destructive/80 font-mono text-sm">Immediate review recommended.</p>
                    </div>
                  </div>
                )}
                
                <div className="sci-fi-panel relative p-1">
                  <div className="absolute top-0 left-0 px-3 py-1 bg-background/80 border-b border-r border-border font-mono text-xs text-primary z-10 backdrop-blur-sm flex items-center">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2" />
                    FEED: {result.frameTimestamp.split('T')[1]?.split('.')[0] || 'LIVE'}
                  </div>
                  
                  {/* The annotated image from backend, fallback to local preview if not returned */}
                  <img 
                    src={result.processedImageUrl || previewUrl || ''} 
                    alt="Analyzed Frame" 
                    className="w-full h-auto object-contain bg-black/50"
                  />
                  
                  {/* Fallback box rendering if backend only sends coords but no processed image */}
                  {!result.processedImageUrl && result.detections.map((d, i) => {
                     if (!d.bbox) return null;
                     const colors = getActivityColor(d.activity);
                     return (
                       <div 
                         key={i}
                         className={cn("absolute border-2 transition-all", colors.border)}
                         style={{ 
                           left: `${d.bbox.x}%`, 
                           top: `${d.bbox.y}%`, 
                           width: `${d.bbox.width}%`, 
                           height: `${d.bbox.height}%` 
                         }}
                       >
                         <div className={cn("absolute -top-6 left-0 px-2 py-0.5 text-xs font-mono font-bold whitespace-nowrap", colors.bg, colors.text)}>
                           {d.activity.toUpperCase()} [{formatConfidence(d.confidence)}]
                         </div>
                       </div>
                     )
                  })}
                </div>
              </div>

              {/* Subject List */}
              <div className="space-y-4">
                <div className="sci-fi-panel p-4 flex justify-between items-center">
                  <h3 className="font-display tracking-widest text-primary">Subjects Found</h3>
                  <Badge variant="outline" className="border-primary text-primary text-lg px-3 py-1">
                    {result.detections.length}
                  </Badge>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                  {result.detections.map((detection) => {
                    const colors = getActivityColor(detection.activity);
                    const isAlert = detection.activity.toLowerCase().includes('fall') || detection.activity.toLowerCase().includes('fight');
                    
                    return (
                      <div 
                        key={detection.personId} 
                        className={cn(
                          "sci-fi-panel p-4 flex flex-col space-y-3",
                          isAlert && "alert-pulse"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-2 text-muted-foreground font-mono text-sm">
                            <User className="w-4 h-4" />
                            <span>ID: SUBJ-{String(detection.personId).padStart(4, '0')}</span>
                          </div>
                          <Badge className={cn("uppercase tracking-wider", colors.bg, colors.text, colors.border, "border")}>
                            {detection.activity}
                          </Badge>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs font-mono mb-1">
                            <span className="text-muted-foreground">Match Confidence</span>
                            <span className="text-foreground">{formatConfidence(detection.confidence)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full", colors.bg.replace('/20', ''))} 
                              style={{ width: `${detection.confidence * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {result.detections.length === 0 && (
                    <div className="p-8 text-center border border-dashed border-border text-muted-foreground font-mono">
                      No subjects detected in frame.
                    </div>
                  )}
                </div>

                <Button variant="outline" className="w-full mt-4" onClick={resetAnalysis}>
                  <ScanLine className="w-4 h-4 mr-2" /> New Scan
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
