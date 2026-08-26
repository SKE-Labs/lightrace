import { db } from "@lightrace/shared/db";

export async function pruneErrorEvents(now: Date = new Date()): Promise<{ deletedEvents: number }> {
  // Find distinct affected issues first (smaller than loading all events)
  const distinctIssues = await db.errorEvent.findMany({
    where: { expiresAt: { lt: now } },
    distinct: ["issueId"],
    select: { issueId: true },
  });

  if (distinctIssues.length === 0) {
    return { deletedEvents: 0 };
  }

  const issueIds = distinctIssues.map((e) => e.issueId);

  const deleteResult = await db.$transaction(async (tx) => {
    // Delete all expired events in one go (no need to load IDs)
    const del = await tx.errorEvent.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // For each affected issue, recount remaining events
    for (const issueId of issueIds) {
      const remainingCount = await tx.errorEvent.count({ where: { issueId } });
      // Count distinct traces via groupBy for efficiency
      const traceGroups = await tx.errorEvent.groupBy({
        by: ["traceId"],
        where: { issueId },
      });
      const traceCount = traceGroups.length;

      if (remainingCount === 0) {
        await tx.errorIssue.update({
          where: { id: issueId },
          data: {
            count: 0,
            traceCount: 0,
            userCount: 0,
            status: "ARCHIVED",
          },
        });
      } else {
        await tx.errorIssue.update({
          where: { id: issueId },
          data: {
            count: remainingCount,
            traceCount,
          },
        });
      }
    }
    return del;
  });

  return { deletedEvents: deleteResult.count };
}
