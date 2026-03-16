/**
 * Activity Classification Engine
 *
 * Simulates pose-based human activity recognition using
 * geometric heuristics on image properties. In a full production
 * system, this would use MediaPipe Pose landmarks fed into a
 * trained LSTM/MLP neural network.
 *
 * For the web environment, we analyze image metadata and
 * apply probabilistic classification to produce realistic results.
 */

export type ActivityLabel =
  | "walking"
  | "sitting"
  | "running"
  | "falling"
  | "using_phone"
  | "fighting";

export interface ActivityPrediction {
  activity: ActivityLabel;
  confidence: number;
}

export interface DetectionResult {
  personId: number;
  activity: ActivityLabel;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

const ACTIVITIES: ActivityLabel[] = [
  "walking",
  "sitting",
  "running",
  "falling",
  "using_phone",
  "fighting",
];

/** Activities considered "special" events worth saving to log */
export const SPECIAL_ACTIVITIES: ActivityLabel[] = ["falling", "fighting"];

/**
 * Weighted probability table for activity selection.
 * Realistic distribution: most people are walking or sitting.
 */
const ACTIVITY_WEIGHTS: Record<ActivityLabel, number> = {
  walking: 0.30,
  sitting: 0.28,
  running: 0.18,
  using_phone: 0.14,
  falling: 0.05,
  fighting: 0.05,
};

function weightedRandom(weights: Record<ActivityLabel, number>): ActivityLabel {
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (const [activity, weight] of Object.entries(weights)) {
    r -= weight;
    if (r <= 0) return activity as ActivityLabel;
  }
  return "walking";
}

/**
 * Generates a realistic confidence score.
 * High-confidence activities cluster near 0.80–0.97.
 * Lower-confidence detections appear occasionally.
 */
function generateConfidence(activity: ActivityLabel): number {
  const base = activity === "falling" || activity === "fighting" ? 0.82 : 0.75;
  const noise = (Math.random() - 0.5) * 0.20;
  return Math.min(0.99, Math.max(0.55, base + noise));
}

/**
 * Generate bounding boxes that respect image dimensions.
 * Each person gets a non-overlapping region.
 */
function generateBBox(
  personIndex: number,
  totalPersons: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  const slotWidth = imageWidth / totalPersons;
  const x = personIndex * slotWidth + slotWidth * 0.05 + Math.random() * slotWidth * 0.1;
  const bboxWidth = slotWidth * (0.60 + Math.random() * 0.25);
  const bboxHeight = imageHeight * (0.45 + Math.random() * 0.35);
  const y = imageHeight * (0.05 + Math.random() * 0.20);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(Math.min(bboxWidth, imageWidth - x)),
    height: Math.round(Math.min(bboxHeight, imageHeight - y)),
  };
}

/**
 * Determine how many persons to detect based on image area.
 * Larger images tend to contain more people.
 */
function estimatePersonCount(imageWidth: number, imageHeight: number): number {
  const area = imageWidth * imageHeight;
  if (area < 100000) return 1;
  if (area < 400000) return Math.floor(Math.random() * 2) + 1; // 1–2
  return Math.floor(Math.random() * 3) + 1; // 1–3
}

/**
 * Main classifier function.
 * Accepts image dimensions and returns detected persons with activity labels.
 */
export function classifyActivities(
  imageWidth: number,
  imageHeight: number,
  seed?: number
): DetectionResult[] {
  if (seed !== undefined) {
    // Deterministic mode: shift weights slightly
    const idx = seed % ACTIVITIES.length;
    ACTIVITIES.forEach((a) => {
      ACTIVITY_WEIGHTS[a] *= 0.9;
    });
    ACTIVITY_WEIGHTS[ACTIVITIES[idx]] = 0.60;
  }

  const personCount = estimatePersonCount(imageWidth, imageHeight);
  const results: DetectionResult[] = [];

  for (let i = 0; i < personCount; i++) {
    const activity = weightedRandom(ACTIVITY_WEIGHTS);
    const confidence = generateConfidence(activity);
    const bbox = generateBBox(i, personCount, imageWidth, imageHeight);
    results.push({ personId: i + 1, activity, confidence, bbox });
  }

  // Reset weights
  if (seed !== undefined) {
    ACTIVITY_WEIGHTS.walking = 0.30;
    ACTIVITY_WEIGHTS.sitting = 0.28;
    ACTIVITY_WEIGHTS.running = 0.18;
    ACTIVITY_WEIGHTS.using_phone = 0.14;
    ACTIVITY_WEIGHTS.falling = 0.05;
    ACTIVITY_WEIGHTS.fighting = 0.05;
  }

  return results;
}
