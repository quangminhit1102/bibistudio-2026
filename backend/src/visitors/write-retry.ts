import { ApiError } from "../http/errors";
/** Retry only transactions MySQL has rolled back in full; never retry a commit ambiguity. */
export async function withVisitorWriteRetry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ER_LOCK_DEADLOCK"
      )
        throw error;
      if (attempt >= 2) throw new ApiError(503, "VISITOR_WRITE_BUSY", "Vui lòng thử lại sau");
    }
  }
}
