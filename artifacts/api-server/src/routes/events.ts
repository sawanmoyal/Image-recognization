/**
 * Events Routes
 *
 * GET    /api/events         - List all activity events with optional filters
 * DELETE /api/events         - Clear all events
 * GET    /api/events/export  - Export events as CSV
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, eventsTable } from "@workspace/db";
import { count, desc, eq } from "drizzle-orm";
import { ListEventsResponse, ClearEventsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /api/events
 * Returns paginated list of activity events, optionally filtered by activity type.
 */
router.get("/events", async (req: Request, res: Response) => {
  try {
    const limitParam = parseInt(String(req.query.limit ?? "50"), 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 500);
    const activityFilter = req.query.activity as string | undefined;

    let query = db
      .select()
      .from(eventsTable)
      .orderBy(desc(eventsTable.timestamp))
      .limit(limit);

    const events = activityFilter
      ? await db
          .select()
          .from(eventsTable)
          .where(eq(eventsTable.activity, activityFilter))
          .orderBy(desc(eventsTable.timestamp))
          .limit(limit)
      : await query;

    const totalResult = await db.select({ total: count() }).from(eventsTable);
    const total = totalResult[0]?.total ?? 0;

    const data = ListEventsResponse.parse({
      events: events.map((e) => ({
        id: e.id,
        activity: e.activity,
        confidence: e.confidence,
        personId: e.personId,
        timestamp: e.timestamp.toISOString(),
        imageUrl: e.imageUrl ?? null,
      })),
      total,
    });

    res.json(data);
  } catch (err) {
    console.error("List events error:", err);
    res.status(500).json({ error: "LIST_FAILED", message: String(err) });
  }
});

/**
 * DELETE /api/events
 * Deletes all events from the log.
 */
router.delete("/events", async (_req: Request, res: Response) => {
  try {
    await db.delete(eventsTable);
    const data = ClearEventsResponse.parse({
      success: true,
      message: "All events cleared successfully",
    });
    res.json(data);
  } catch (err) {
    console.error("Clear events error:", err);
    res.status(500).json({ error: "CLEAR_FAILED", message: String(err) });
  }
});

/**
 * GET /api/events/export
 * Streams all events as a CSV file download.
 */
router.get("/events/export", async (_req: Request, res: Response) => {
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .orderBy(desc(eventsTable.timestamp));

    const csvHeader = "id,activity,confidence,person_id,timestamp,image_url\n";
    const csvRows = events
      .map((e) =>
        [
          e.id,
          e.activity,
          e.confidence.toFixed(4),
          e.personId,
          e.timestamp.toISOString(),
          e.imageUrl ?? "",
        ].join(",")
      )
      .join("\n");

    const csv = csvHeader + csvRows;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="activity_events_${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (err) {
    console.error("Export events error:", err);
    res.status(500).json({ error: "EXPORT_FAILED", message: String(err) });
  }
});

export default router;
