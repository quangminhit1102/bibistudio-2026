"use strict";
const { validateDatabaseMetadata } = require("./database-metadata.cjs");
const { validateAccessLogMetadata } = require("./access-log-metadata.cjs");
const { validateProfileMetadata } = require("./profile-metadata.cjs");
const { validateVisitorMetadata } = require("./visitor-metadata.cjs");
const { validateVisitorContextMetadata } = require("./visitor-context-metadata.cjs");
const {
  validateContentMetadata,
  validateContentPublicMetadata,
} = require("./content-metadata.cjs");
function makeManifest(
  sourceSha,
  ciRunId = null,
  database,
  accessLogs,
  profiles,
  visitorAnalytics,
  visitorContext,
  contentCapability = {},
) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("Invalid source SHA");
  if (ciRunId !== null && !/^[1-9][0-9]*$/.test(String(ciRunId)))
    throw new Error("Invalid CI run ID");
  if (
    Object.keys(contentCapability).some((key) => !["content", "contentPublic"].includes(key)) ||
    (contentCapability.content && contentCapability.contentPublic) ||
    ((contentCapability.content || contentCapability.contentPublic) && !visitorContext)
  )
    throw Error("Invalid content release capability");
  return {
    schemaVersion: contentCapability.content
      ? 7
      : visitorContext
        ? 6
        : visitorAnalytics
          ? 5
          : profiles
            ? 4
            : accessLogs
              ? 3
              : database
                ? 2
                : 1,
    releaseId: ciRunId ? `${sourceSha}-${ciRunId}` : `local-${sourceSha}`,
    sourceSha,
    ciRunId: ciRunId ? String(ciRunId) : null,
    ...(database ? { database: validateDatabaseMetadata(database) } : {}),
    ...(accessLogs ? { accessLogs: validateAccessLogMetadata(accessLogs) } : {}),
    ...(profiles ? { profiles: validateProfileMetadata(profiles) } : {}),
    ...(visitorAnalytics ? { visitorAnalytics: validateVisitorMetadata(visitorAnalytics) } : {}),
    ...(visitorContext ? { visitorContext: validateVisitorContextMetadata(visitorContext) } : {}),
    ...(contentCapability.content
      ? { content: validateContentMetadata(contentCapability.content) }
      : {}),
    ...(contentCapability.contentPublic
      ? { contentPublic: validateContentPublicMetadata(contentCapability.contentPublic) }
      : {}),
  };
}
function validateManifest(data, { requireCI = false } = {}) {
  if (
    !data ||
    ![1, 2, 3, 4, 5, 6, 7].includes(data.schemaVersion) ||
    (data.schemaVersion === 1 && Object.hasOwn(data, "database")) ||
    (data.schemaVersion >= 2 && !data.database) ||
    (data.schemaVersion < 3 && Object.hasOwn(data, "accessLogs")) ||
    (data.schemaVersion >= 3 && !data.accessLogs) ||
    (data.schemaVersion < 4 && Object.hasOwn(data, "profiles")) ||
    (data.schemaVersion >= 4 && !data.profiles) ||
    (data.schemaVersion < 5 && Object.hasOwn(data, "visitorAnalytics")) ||
    (data.schemaVersion >= 5 && !data.visitorAnalytics) ||
    (data.schemaVersion < 6 && Object.hasOwn(data, "visitorContext")) ||
    (data.schemaVersion >= 6 && !data.visitorContext) ||
    (data.schemaVersion === 7 && !data.content) ||
    (data.schemaVersion < 7 && Object.hasOwn(data, "content")) ||
    (Object.hasOwn(data, "contentPublic") && data.schemaVersion !== 6)
  )
    throw new Error("Invalid release manifest");
  const expected = makeManifest(
    data.sourceSha,
    data.ciRunId,
    data.database,
    data.accessLogs,
    data.profiles,
    data.visitorAnalytics,
    data.visitorContext,
    {
      ...(Object.hasOwn(data, "content") ? { content: data.content } : {}),
      ...(Object.hasOwn(data, "contentPublic") ? { contentPublic: data.contentPublic } : {}),
    },
  );
  if (data.releaseId !== expected.releaseId) throw new Error("Invalid release identity");
  if (requireCI && !data.ciRunId) throw new Error("CI release is required");
  return expected;
}
module.exports = { makeManifest, validateManifest };
