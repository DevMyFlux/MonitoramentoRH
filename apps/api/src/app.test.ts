import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("api bootstrap", () => {
  it("exposes versioned health endpoint", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.json()).toEqual({
      service: "my-flux-api",
      status: "ok",
      version: "0.0.0"
    });

    await app.close();
  }, 15000);
});
