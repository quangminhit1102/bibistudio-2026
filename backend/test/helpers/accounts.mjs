import { createAuthFixture } from "./auth.mjs";
import { serve } from "./http.mjs";
import { createApp } from "../../dist/app.js";

export async function createAccountFixture(t) {
  const fixture = await createAuthFixture(t);
  const base = await serve(
    t,
    createApp(
      { releaseId: "test", sourceSha: "test" },
      { db: fixture.pool, config: fixture.config, clock: fixture.clock },
    ),
  );
  const admin = await fixture.auth.login({
    username: "admin",
    password: fixture.secrets.masterPassword,
  });
  const request = async (path, method = "GET", body, token = admin.accessToken) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
        "X-Bibi-Request": "1",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  };
  return { ...fixture, base, admin, request };
}
