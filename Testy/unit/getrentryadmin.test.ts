import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Load bcrypt from App/node_modules
const appRequire = createRequire(
  fileURLToPath(new URL("../../App/package.json", import.meta.url))
);

const bcrypt = appRequire("bcrypt");
const cookieParser = appRequire("cookie-parser");

// In-memory mock database
const mocks = vi.hoisted(() => ({
  users: [] as any[],
  entries: [] as any[],
  findUserUnique: vi.fn(),
  findMany: vi.fn(),
}));

// Mock Prisma
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUserUnique,
    },
    entry: {
      findMany: mocks.findMany,
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

describe("GET /api/entries", () => {
  const regularUser = {
    id: "user-123",
    username: "regularuser@example.com",
    password: "RegularPassword123!",
    admin: false,
  };

  const adminUser = {
    id: "admin-456",
    username: "adminuser@example.com",
    password: "AdminPassword123!",
    admin: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    process.env.JWT_SECRET = "test_jwt_secret";

    // Clear in-memory database
    mocks.users.length = 0;
    mocks.entries.length = 0;

    // Hash passwords before inserting users
    const regularPasswordHash = await bcrypt.hash(
      regularUser.password,
      10
    );

    const adminPasswordHash = await bcrypt.hash(
      adminUser.password,
      10
    );

    // Populate mock database with users
    mocks.users.push(
      {
        id: regularUser.id,
        username: regularUser.username,
        password: regularPasswordHash,
        admin: regularUser.admin,
      },
      {
        id: adminUser.id,
        username: adminUser.username,
        password: adminPasswordHash,
        admin: adminUser.admin,
      }
    );

    // Populate mock database with entries belonging to both users
    mocks.entries.push(
      {
        id: "entry-1",
        name: "Regular expense",
        amount: 100,
        income: false,
        user_id: regularUser.id,
        date: new Date("2026-11-10T10:00:00.000Z"),
      },
      {
        id: "entry-2",
        name: "Regular income",
        amount: 500,
        income: true,
        user_id: regularUser.id,
        date: new Date("2026-11-11T10:00:00.000Z"),
      },
      {
        id: "entry-3",
        name: "Admin expense",
        amount: 200,
        income: false,
        user_id: adminUser.id,
        date: new Date("2026-11-12T10:00:00.000Z"),
      }
    );

    // Mock Prisma user lookup
    mocks.findUserUnique.mockImplementation(async ({ where }) => {
      return mocks.users.find(user =>
        where.id !== undefined
          ? user.id === where.id
          : user.username === where.username
      ) ?? null;
    });

    // Mock Prisma entry lookup
    mocks.findMany.mockImplementation(async ({ where, orderBy }) => {
      const results = mocks.entries.filter(
        entry => entry.user_id === where.user_id
      );

      // Apply requested ordering
      if (orderBy?.date === "desc") {
        results.sort(
          (a, b) => b.date.getTime() - a.date.getTime()
        );
      }

      return results;
    });
  });

  // Helper: log in and obtain a real JWT authentication cookie
  async function getAuthCookie(
    username: string,
    password: string
  ): Promise<string> {
    const response = await request(app)
      .post("/api/login")
      .send({
        username,
        password,
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const cookies = response.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const tokenCookie = cookies
      .find((cookie: string) => cookie.startsWith("token="))
      ?.split(";")[0];

    expect(tokenCookie).toBeDefined();

    return tokenCookie!;
  }

  // TEST 1: Admin can fetch entries belonging to a specified user
  it("should allow an admin to fetch entries of a specified user", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    const response = await request(app)
      .get("/api/entries")
      .query({ userId: regularUser.id })
      .set("Cookie", token);

    expect(response.status).toBe(200);

    expect(response.body).toHaveLength(2);

    expect(response.body).toEqual([
      {
        id: "entry-2",
        name: "Regular income",
        amount: 500,
        income: true,
        user_id: regularUser.id,
        date: "2026-11-11T10:00:00.000Z",
      },
      {
        id: "entry-1",
        name: "Regular expense",
        amount: 100,
        income: false,
        user_id: regularUser.id,
        date: "2026-11-10T10:00:00.000Z",
      },
    ]);

    expect(mocks.findMany).toHaveBeenCalledOnce();

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        user_id: regularUser.id,
      },
      orderBy: {
        date: "desc",
      },
    });

    for (const entry of response.body) {
      expect(entry.user_id).toBe(regularUser.id);
    }
  });

  // TEST 2: Admin without userId defaults to their own entries
  it("should return the admin's own entries when no userId is provided", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    const response = await request(app)
      .get("/api/entries")
      .set("Cookie", token);

    expect(response.status).toBe(200);

    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toMatchObject({
      id: "entry-3",
      name: "Admin expense",
      amount: 200,
      income: false,
      user_id: adminUser.id,
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        user_id: adminUser.id,
      },
      orderBy: {
        date: "desc",
      },
    });
  });

  // TEST 3: Nonexistent userId
  it("should return an empty array when the requested user does not exist", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    const nonexistentUserId = "nonexistent-user-999";

    const response = await request(app)
      .get("/api/entries")
      .query({ userId: nonexistentUserId })
      .set("Cookie", token);

    expect(response.status).toBe(200);

    expect(response.body).toEqual([]);

    // Verify Prisma searched for the requested ID
    expect(mocks.findMany).toHaveBeenCalledOnce();

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        user_id: nonexistentUserId,
      },
      orderBy: {
        date: "desc",
      },
    });

    // Original database remains unchanged
    expect(mocks.entries).toHaveLength(3);
  });

  // TEST 4: Empty userId
  it("should return an empty array when the admin supplies an empty userId", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    const response = await request(app)
      .get("/api/entries")
      .query({ userId: "" })
      .set("Cookie", token);

    expect(response.status).toBe(200);

    expect(response.body).toEqual([]);

    // Empty string is still a string, so the route uses it
    // instead of defaulting to the admin's own user ID.
    expect(mocks.findMany).toHaveBeenCalledOnce();

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        user_id: "",
      },
      orderBy: {
        date: "desc",
      },
    });

    // Original database remains unchanged
    expect(mocks.entries).toHaveLength(3);
  });
});