import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Resolve bcrypt from App/node_modules
const appRequire = createRequire(
  fileURLToPath(new URL("../../App/package.json", import.meta.url))
);

const bcrypt = appRequire("bcrypt");

const mocks = vi.hoisted(() => ({
  users: [] as any[],
  findUnique: vi.fn(),
}));

const username = "testuser";
const password = "StrongPassword123!";

// Mock Prisma with an in-memory database
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

// Import router directly, without starting the server
import accountRoutes from "../../App/backend/routes/accountRoutes";

const app = express();

app.use(express.json());
app.use("/api", accountRoutes);

describe("POST /api/login", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear mock database
    mocks.users.length = 0;

    // Hash password before inserting the user
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert existing user into mock database
    mocks.users.push({
      id: 123,
      username,
      password: hashedPassword,
      admin: false,
    });

    // Search mock database
    mocks.findUnique.mockImplementation(async ({ where }) => {
      return mocks.users.find(
        user => user.username === where.username
      ) ?? null;
    });
  });

  it("should successfully log in an existing user", async () => {
    const response = await request(app)
      .post("/api/login")
      .send({
        username,
        password,
      });

    // Check HTTP response
    expect(response.status, JSON.stringify(response.body)).toBe(200);

    expect(response.body).toEqual({
      message: "Login successful",
      userId: 123,
      username,
      admin: false,
    });

    // Verify Prisma searched for the correct user
    expect(mocks.findUnique).toHaveBeenCalledOnce();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username },
    });

    // Verify stored password is actually hashed
    expect(mocks.users[0].password).not.toBe(password);

    expect(
      await bcrypt.compare(password, mocks.users[0].password)
    ).toBe(true);

    // Verify authentication cookie
    expect(response.headers["set-cookie"]).toBeDefined();
    expect(response.headers["set-cookie"][0]).toContain("token=");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
  });
});