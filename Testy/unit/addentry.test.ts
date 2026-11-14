import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Load dependencies from App/node_modules
const appRequire = createRequire(
  fileURLToPath(new URL("../../App/package.json", import.meta.url))
);

const bcrypt = appRequire("bcrypt");
const cookieParser = appRequire("cookie-parser");

// In-memory mock database
const mocks = vi.hoisted(() => ({
  users: [] as any[],
  entries: [] as any[],
  findUnique: vi.fn(),
  createEntry: vi.fn(),
}));

// Mock Prisma
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
    },
    entry: {
      create: mocks.createEntry,
    },
  },
}));

// Import routers directly, without starting the server
import accountRoutes from "../../App/backend/routes/accountRoutes";
import entryRoutes from "../../App/backend/routes/entryRoutes";

// Create test Express application
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/api", accountRoutes);
app.use("/api", entryRoutes);

describe("POST /api/entries", () => {
  const username = "entry_test_user@example.com";
  const password = "StrongPassword123!";
  const userId = 123;

  beforeEach(async () => {
    vi.clearAllMocks();

    process.env.JWT_SECRET = "test_jwt_secret";

    // Clear in-memory database
    mocks.users.length = 0;
    mocks.entries.length = 0;

    // Hash password before inserting user
    const hashedPassword = await bcrypt.hash(password, 10);

    // Populate mock database with an existing user
    mocks.users.push({
      id: userId,
      username,
      password: hashedPassword,
      admin: false,
    });

    // Populate mock database with existing entries
    mocks.entries.push({
      id: 1,
      name: "Existing entry",
      amount: 50,
      user_id: userId,
      income: false,
    });

    // Mock Prisma user lookup
    mocks.findUnique.mockImplementation(async ({ where }) => {
      return mocks.users.find(user =>
        where.id !== undefined
          ? user.id === where.id
          : user.username === where.username
      ) ?? null;
    });

    // Mock Prisma entry creation
    mocks.createEntry.mockImplementation(async ({ data }) => {
      const newEntry = {
        id: 456,
        ...data,
      };

      mocks.entries.push(newEntry);

      return newEntry;
    });
  });

  // Helper: log in and obtain a real JWT authentication cookie
  async function getAuthCookie(): Promise<string> {
    const loginResponse = await request(app)
      .post("/api/login")
      .send({
        username,
        password,
      });

    expect(loginResponse.status).toBe(200);

    const cookies = loginResponse.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const tokenCookie = cookies
      .find((cookie: string) => cookie.startsWith("token="))
      ?.split(";")[0];

    expect(tokenCookie).toBeDefined();

    return tokenCookie!;
  }

  // TEST 1: Successful entry creation
  it("should create a new entry for an authenticated user", async () => {
    const tokenCookie = await getAuthCookie();

    const entryName = "Test expense";
    const amount = "125.50";
    const date = "2026-11-12T10:00:00.000Z";

    // Verify mock database population
    expect(mocks.users).toHaveLength(1);
    expect(mocks.entries).toHaveLength(1);

    expect(
      await bcrypt.compare(password, mocks.users[0].password)
    ).toBe(true);

    // Create entry using JWT token
    const response = await request(app)
      .post("/api/entries")
      .set("Cookie", tokenCookie)
      .send({
        name: entryName,
        amount,
        date,
        income: true,
      });

    // Check HTTP response
    expect(response.status, JSON.stringify(response.body)).toBe(201);

    expect(response.body.message).toBe("Entry created successfully");

    // Verify Prisma received the correct data
    expect(mocks.createEntry).toHaveBeenCalledOnce();

    expect(mocks.createEntry).toHaveBeenCalledWith({
      data: {
        name: entryName,
        amount: 125.5,
        date: new Date(date),
        income: true,
        user_id: userId,
      },
    });

    // Verify returned entry
    expect(response.body.entry).toMatchObject({
      id: 456,
      name: entryName,
      amount: 125.5,
      income: true,
      user_id: userId,
      date,
    });

    // Verify in-memory database
    expect(mocks.entries).toHaveLength(2);

    expect(mocks.entries[1]).toMatchObject({
      id: 456,
      name: entryName,
      amount: 125.5,
      income: true,
      user_id: userId,
    });

    expect(mocks.entries[1].date).toEqual(new Date(date));
  });

  // TEST 2: Missing amount
  it("should reject entry creation when amount is missing", async () => {
    const tokenCookie = await getAuthCookie();

    const response = await request(app)
      .post("/api/entries")
      .set("Cookie", tokenCookie)
      .send({
        name: "Invalid expense",
        income: false,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Amount is required",
    });

    // Prisma must not receive a creation request
    expect(mocks.createEntry).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.entries).toHaveLength(1);
  });

  // TEST 3: Non-numeric amount
  it("should reject entry creation when amount is not a valid number", async () => {
    const tokenCookie = await getAuthCookie();

    const response = await request(app)
      .post("/api/entries")
      .set("Cookie", tokenCookie)
      .send({
        name: "Invalid expense",
        amount: "not-a-number",
        income: false,
      });

    expect(response.status).toBe(400);

    // Prisma must not receive a creation request
    expect(mocks.createEntry).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.entries).toHaveLength(1);
  });
});