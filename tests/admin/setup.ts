import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { Blob, File } from "node:buffer";
import { vi } from "vitest";
// fake-indexeddb uses Node structuredClone; jsdom's Blob is not cloneable there.
vi.stubGlobal("Blob", Blob);
vi.stubGlobal("File", File);
afterEach(cleanup);
