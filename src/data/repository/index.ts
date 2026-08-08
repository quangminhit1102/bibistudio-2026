// src/data/repository/index.ts
// Singleton repository — the single import point for all data access in the app.
//
// To swap from static data to a real API:
//   1. Create src/data/adapters/api.ts implementing ProductRepository
//   2. Change the import below to: import { apiAdapter } from "../adapters/api";
//   3. Change the export to: export const repository: ProductRepository = apiAdapter;

import type { ProductRepository } from "../types";
import { staticAdapter } from "../adapters/static";

export const repository: ProductRepository = staticAdapter;
