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
  deleteMany: vi.fn(),
  deleteUser: vi.fn(),
  transaction: vi.fn(),
}));

// Mock Prisma
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
      delete: mocks.deleteUser,
    },
    entry: {
      deleteMany: mocks.deleteMany,
    },
    $transaction: mocks.transaction,
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

describe("DELETE /api/users/:id", () => {
  const adminUser = {
    id: "admin-123",
    username: "adminuser@example.com",
    password: "AdminPassword123!",
    admin: true,
  };

  const regularUser = {
    id: "user-456",
    username: "regularuser@example.com",
    password: "RegularPassword123!",
    admin: false,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    process.env.JWT_SECRET = "test_jwt_secret";

    // Clear in-memory database
    mocks.users.length = 0;
    mocks.entries.length = 0;

    // Hash passwords before inserting users
    const adminPasswordHash = await bcrypt.hash(
      adminUser.password,
      10
    );

    const regularPasswordHash = await bcrypt.hash(
      regularUser.password,
      10
    );

    // Populate mock database with users
    mocks.users.push(
      {
        id: adminUser.id,
        username: adminUser.username,
        password: adminPasswordHash,
        admin: adminUser.admin,
      },
      {
        id: regularUser.id,
        username: regularUser.username,
        password: regularPasswordHash,
        admin: regularUser.admin,
      }
    );

    // Populate mock database with associated entries
    mocks.entries.push(
      {
        id: "entry-1",
        name: "Regular expense 1",
        amount: 100,
        user_id: regularUser.id,
        income: false,
      },
      {
        id: "entry-2",
        name: "Regular expense 2",
        amount: 200,
        user_id: regularUser.id,
        income: false,
      },
      {
        id: "entry-3",
        name: "Admin expense",
        amount: 300,
        user_id: adminUser.id,
        income: false,
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

    // Mock deletion of associated entries
    mocks.deleteMany.mockImplementation(async ({ where }) => {
      const initialCount = mocks.entries.length;

      for (let i = mocks.entries.length - 1; i >= 0; i--) {
        if (mocks.entries[i].user_id === where.user_id) {
          mocks.entries.splice(i, 1);
        }
      }

      return {
        count: initialCount - mocks.entries.length,
      };
    });

    // Mock user deletion
    mocks.deleteUser.mockImplementation(async ({ where }) => {
      const index = mocks.users.findIndex(
        user => user.id === where.id
      );

      if (index === -1) {
        throw new Error("User not found");
      }

      return mocks.users.splice(index, 1)[0];
    });

    // Mock Prisma transaction
    mocks.transaction.mockImplementation(async (operations) => {
      return Promise.all(operations);
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

  // Regular user cannot access the admin endpoint
  it("should deny a regular user access to the admin deletion endpoint", async () => {
    // Log in as regular user
    const token = await getAuthCookie(
      regularUser.username,
      regularUser.password
    );

    // Attempt to delete another user
    const response = await request(app)
      .delete(`/api/users/${adminUser.id}`)
      .set("Cookie", token);

    expect(response.status).toBe(403);

    // Verify no database deletion occurred
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.users).toHaveLength(2);
    expect(mocks.entries).toHaveLength(3);
  });
});