import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "recover quote discussion delivery",
  { minutes: 1 },
  internal.quoteDiscussions.recover,
  {}
);

crons.interval(
  "recover CRM quote sync outbox",
  { minutes: 1 },
  internal.crmQuoteSync.recoverOutbox,
  {}
);

crons.interval(
  "purge expired delivered quote data",
  { hours: 6 },
  internal.quoteRetention.cleanupExpiredQuoteData,
  {}
);

export default crons;
