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
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

// Mock Prisma
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
  },
}));

// Import routers directly, without starting the server
import accountRoutes from "../../App/backend/routes/accountRoutes";
import adminRoutes from "../../App/backend/routes/adminRoutes";

// Create test Express application
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/api", accountRoutes);
app.use("/api", adminRoutes);

describe("GET /api/users", () => {
  const adminUser = {
    id: 123,
    username: "adminuser",
    password: "AdminPassword123!",
    admin: true,
  };

  const regularUser = {
    id: 456,
    username: "regularuser",
    password: "RegularPassword123!",
    admin: false,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    process.env.JWT_SECRET = "test_jwt_secret";

    // Clear in-memory database
    mocks.users.length = 0;

    // Hash passwords before inserting users
    const adminPasswordHash = await bcrypt.hash(
      adminUser.password,
      10
    );

    const regularPasswordHash = await bcrypt.hash(
      regularUser.password,
      10
    );

    // Populate mock database
    mocks.users.push(
      {
        id: adminUser.id,
        username: adminUser.username,
        password: adminPasswordHash,
        admin: adminUser.admin,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      },
      {
        id: regularUser.id,
        username: regularUser.username,
        password: regularPasswordHash,
        admin: regularUser.admin,
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
      }
    );

    // Mock Prisma user lookup for login
    mocks.findUnique.mockImplementation(async ({ where }) => {
      return mocks.users.find(user =>
        where.id !== undefined
          ? user.id === where.id
          : user.username === where.username
      ) ?? null;
    });

    // Mock Prisma user listing
    mocks.findMany.mockImplementation(async ({ select }) => {
      return mocks.users.map(user => {
        const result: Record<string, any> = {};

        for (const field of Object.keys(select)) {
          if (select[field]) {
            result[field] = user[field];
          }
        }

        return result;
      });
    });
  });

  // Helper: log in and obtain a real JWT authentication cookie
  async function getAuthCookie(
    username: string,
    password: string
  ): Promise<string> {
    const response = await request(app)
      .post("/api/login")
      .send({ username, password });

    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const cookies = response.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const tokenCookie = cookies
      .find((cookie: string) => cookie.startsWith("token="))
      ?.split(";")[0];

    expect(tokenCookie).toBeDefined();

    return tokenCookie!;
  }

  //Admin can fetch all users
  it("should allow an admin to fetch all users", async () => {
    // Log in as admin
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    // Verify database population
    expect(mocks.users).toHaveLength(2);

    expect(
      await bcrypt.compare(
        adminUser.password,
        mocks.users[0].password
      )
    ).toBe(true);

    expect(
      await bcrypt.compare(
        regularUser.password,
        mocks.users[1].password
      )
    ).toBe(true);

    // Request all users
    const response = await request(app)
      .get("/api/users")
      .set("Cookie", token);

    // Check HTTP response
    expect(response.status).toBe(200);

    // Check returned users
    expect(response.body).toEqual([
      {
        id: adminUser.id,
        username: adminUser.username,
        createdAt: "2026-01-01T10:00:00.000Z",
        admin: true,
      },
      {
        id: regularUser.id,
        username: regularUser.username,
        createdAt: "2026-02-01T10:00:00.000Z",
        admin: false,
      },
    ]);

    // Verify Prisma was called with the correct selection
    expect(mocks.findMany).toHaveBeenCalledOnce();

    expect(mocks.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        username: true,
        createdAt: true,
        admin: true,
      },
    });

    // Verify passwords are not exposed in the response
    for (const user of response.body) {
      expect(user).not.toHaveProperty("password");
    }
  });
});