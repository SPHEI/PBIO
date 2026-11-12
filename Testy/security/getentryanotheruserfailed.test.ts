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
  findMany: vi.fn(),
}));

// Mock Prisma
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
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

describe("GET /api/entries - User access restrictions", () => {
  const regularUser = {
    id: "user-123",
    username: "regularuser",
    password: "RegularPassword123!",
    admin: false,
  };

  const anotherUser = {
    id: "user-456",
    username: "anotheruser",
    password: "AnotherPassword123!",
    admin: false,
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

    const anotherPasswordHash = await bcrypt.hash(
      anotherUser.password,
      10
    );

    // Populate mock database with users
    mocks.users.push(
      {
        id: regularUser.id,
        username: regularUser.username,
        password: regularPasswordHash,
        admin: false,
      },
      {
        id: anotherUser.id,
        username: anotherUser.username,
        password: anotherPasswordHash,
        admin: false,
      }
    );

    // Populate mock database with entries belonging to both users
    mocks.entries.push(
      {
        id: "entry-1",
        name: "My expense",
        amount: 100,
        income: false,
        user_id: regularUser.id,
        date: new Date("2026-11-10T10:00:00.000Z"),
      },
      {
        id: "entry-2",
        name: "My income",
        amount: 500,
        income: true,
        user_id: regularUser.id,
        date: new Date("2026-11-11T10:00:00.000Z"),
      },
      {
        id: "entry-3",
        name: "Another user's expense",
        amount: 999,
        income: false,
        user_id: anotherUser.id,
        date: new Date("2026-11-12T10:00:00.000Z"),
      }
    );

    // Mock Prisma user lookup
    mocks.findUnique.mockImplementation(async ({ where }) => {
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

      if (orderBy?.date === "desc") {
        results.sort(
          (a, b) => b.date.getTime() - a.date.getTime()
        );
      }

      return results;
    });
  });

  it("should prevent a user from accessing another user's entries", async () => {
    // STEP 1: Verify mock database population
    expect(mocks.users).toHaveLength(2);
    expect(mocks.entries).toHaveLength(3);

    expect(
      await bcrypt.compare(
        regularUser.password,
        mocks.users[0].password
      )
    ).toBe(true);

    expect(
      await bcrypt.compare(
        anotherUser.password,
        mocks.users[1].password
      )
    ).toBe(true);

    // STEP 2: Log in as the regular user and obtain a real JWT
    const loginResponse = await request(app)
      .post("/api/login")
      .send({
        username: regularUser.username,
        password: regularUser.password,
      });

    expect(loginResponse.status).toBe(200);

    expect(loginResponse.body).toMatchObject({
      message: "Login successful",
      userId: regularUser.id,
      username: regularUser.username,
    });

    // Extract authentication cookie
    const cookies = loginResponse.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const tokenCookie = cookies
      .find((cookie: string) => cookie.startsWith("token="))
      ?.split(";")[0];

    expect(tokenCookie).toBeDefined();

    // Clear login-related Prisma call history
    mocks.findUnique.mockClear();

    // STEP 3: Try accessing another user's entries
    const response = await request(app)
      .get("/api/entries")
      .query({ userId: anotherUser.id })
      .set("Cookie", tokenCookie!);

    // STEP 4: Verify successful response
    expect(response.status).toBe(200);

    // User must receive only their own entries
    expect(response.body).toHaveLength(2);

    expect(response.body).toEqual([
      {
        id: "entry-2",
        name: "My income",
        amount: 500,
        income: true,
        user_id: regularUser.id,
        date: "2026-11-11T10:00:00.000Z",
      },
      {
        id: "entry-1",
        name: "My expense",
        amount: 100,
        income: false,
        user_id: regularUser.id,
        date: "2026-11-10T10:00:00.000Z",
      },
    ]);

    // STEP 5: Verify Prisma received the logged-in user's ID,
    // not the userId supplied in the query parameter
    expect(mocks.findMany).toHaveBeenCalledOnce();

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        user_id: regularUser.id,
      },
      orderBy: {
        date: "desc",
      },
    });

    // STEP 6: Verify another user's entries were not exposed
    expect(
      response.body.some(
        (entry: any) => entry.user_id === anotherUser.id
      )
    ).toBe(false);

    expect(
      response.body.some(
        (entry: any) => entry.id === "entry-3"
      )
    ).toBe(false);

    // STEP 7: Verify original mock database remains unchanged
    expect(mocks.users).toHaveLength(2);
    expect(mocks.entries).toHaveLength(3);

    expect(
      mocks.entries.filter(
        entry => entry.user_id === anotherUser.id
      )
    ).toHaveLength(1);
  });
});