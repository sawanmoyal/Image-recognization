/**
 * Activity Recognition Routes
 *
 * POST /api/activity/analyze - Analyze uploaded image for human activities
 * GET  /api/stats             - Get aggregate statistics
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db, eventsTable } from "@workspace/db";
import { count, desc, eq, sql } from "drizzle-orm";
import {
  classifyActivities,
  SPECIAL_ACTIVITIES,
} from "../lib/activityClassifier.js";
import { annotateImage, getImageDimensions } from "../lib/imageAnnotator.js";
import {
  AnalyzeActivityResponse,
  GetStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Use memory storage so we have the buffer for processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are accepted"));
    }
  },
});

/**
 * POST /api/activity/analyze
 * Accepts a multipart image upload, runs activity detection,
 * saves special events, and returns annotated image + detections.
 */
router.post(
  "/activity/analyze",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: "UPLOAD_ERROR", message: String(err) });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "NO_FILE", message: "No file uploaded" });
        return;
      }

      const buffer = req.file.buffer;

      // Get image dimensions for classifier
      const { width, height } = await getImageDimensions(buffer);

      // Run activity classification
      const detections = classifyActivities(width, height);

      // Annotate image with bounding boxes
      const processedImageUrl = await annotateImage(buffer, detections);

      const frameTimestamp = new Date().toISOString();
      let eventsSaved = 0;

      // Save special activity events to the database
      const specialDetections = detections.filter((d) =>
        SPECIAL_ACTIVITIES.includes(d.activity)
      );

      for (const det of specialDetections) {
        await db.insert(eventsTable).values({
          activity: det.activity,
          confidence: det.confidence,
          personId: det.personId,
          imageUrl: null, // Could store processed image URL here
        });
        eventsSaved++;
      }

      // Always save all detections to the event log
      for (const det of detections) {
        if (!SPECIAL_ACTIVITIES.includes(det.activity)) {
          await db.insert(eventsTable).values({
            activity: det.activity,
            confidence: det.confidence,
            personId: det.personId,
            imageUrl: null,
          });
        }
      }

      const responseData = AnalyzeActivityResponse.parse({
        detections: detections.map((d) => ({
          activity: d.activity,
          confidence: d.confidence,
          bbox: d.bbox,
          personId: d.personId,
        })),
        processedImageUrl,
        frameTimestamp,
        eventsSaved,
      });

      res.json(responseData);
    } catch (err) {
      console.error("Activity analysis error:", err);
      res.status(500).json({ error: "ANALYSIS_FAILED", message: String(err) });
    }
  }
);

/**
 * GET /api/stats
 * Returns aggregate statistics about all detected activities.
 */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const totalResult = await db
      .select({ total: count() })
      .from(eventsTable);
    const totalDetections = totalResult[0]?.total ?? 0;

    const breakdown = await db
      .select({
        activity: eventsTable.activity,
        count: count(),
        avgConfidence: sql<number>`avg(${eventsTable.confidence})`,
      })
      .from(eventsTable)
      .groupBy(eventsTable.activity)
      .orderBy(desc(count()));

    const specialEventsResult = await db
      .select({ cnt: count() })
      .from(eventsTable)
      .where(
        sql`${eventsTable.activity} IN ('falling', 'fighting')`
      );
    const specialEventsCount = specialEventsResult[0]?.cnt ?? 0;

    const data = GetStatsResponse.parse({
      totalDetections,
      activityBreakdown: breakdown.map((b) => ({
        activity: b.activity,
        count: b.count,
        avgConfidence: Number(b.avgConfidence.toFixed(3)),
      })),
      specialEventsCount,
    });

    res.json(data);
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "STATS_FAILED", message: String(err) });
  }
});

export default router;
