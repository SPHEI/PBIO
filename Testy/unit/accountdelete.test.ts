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

// Import router directly, without starting the server
import accountRoutes from "../../App/backend/routes/accountRoutes";

// Create test Express application
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/api", accountRoutes);

describe("DELETE /api/account", () => {
  const username = "delete_test_user@example.com";
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

    // Populate mock database with associated entries
    mocks.entries.push(
      { id: 1, user_id: userId, content: "User entry 1" },
      { id: 2, user_id: userId, content: "User entry 2" },
      { id: 3, user_id: 999, content: "Another user's entry" },
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
    mocks.transaction.mockImplementation(async operations => {
      return Promise.all(operations);
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

    expect(loginResponse.status, JSON.stringify(loginResponse.body)).toBe(200);

    expect(loginResponse.body).toMatchObject({
      message: "Login successful",
      userId,
      username,
    });

    const cookies = loginResponse.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const tokenCookie = cookies
      .find((cookie: string) => cookie.startsWith("token="))
      ?.split(";")[0];

    expect(tokenCookie).toBeDefined();

    return tokenCookie!;
  }

  // TEST 1: Successful account deletion
  it("should delete an authenticated user's account and associated entries", async () => {
    const token = await getAuthCookie();

    // Verify mock database population
    expect(mocks.users).toHaveLength(1);
    expect(mocks.entries).toHaveLength(3);

    expect(
      await bcrypt.compare(password, mocks.users[0].password)
    ).toBe(true);

    // Delete account
    const response = await request(app)
      .delete("/api/account")
      .set("Cookie", token)
      .send({ password });

    // Check HTTP response
    expect(response.status, JSON.stringify(response.body)).toBe(200);

    expect(response.body).toEqual({
      message: "Account and associated data deleted successfully",
    });

    // Verify Prisma user lookups
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username },
    });

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
    });

    // Verify transaction
    expect(mocks.transaction).toHaveBeenCalledOnce();

    // Verify associated entries were deleted
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { user_id: userId },
    });

    // Verify user was deleted
    expect(mocks.deleteUser).toHaveBeenCalledWith({
      where: { id: userId },
    });

    // Verify final database state
    expect(mocks.users).toHaveLength(0);

    // Only another user's entry should remain
    expect(mocks.entries).toHaveLength(1);

    expect(mocks.entries[0]).toEqual({
      id: 3,
      user_id: 999,
      content: "Another user's entry",
    });
  });

  // TEST 2: Missing password
  it("should reject account deletion when password is missing", async () => {
    const token = await getAuthCookie();

    // Clear login-related Prisma calls
    mocks.findUnique.mockClear();

    const response = await request(app)
      .delete("/api/account")
      .set("Cookie", token)
      .send({});

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Current password is required to delete your account",
    });

    // No database lookup or deletion should happen
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.users).toHaveLength(1);
    expect(mocks.entries).toHaveLength(3);
  });

  // TEST 3: Incorrect current password
  it("should reject account deletion when the current password is incorrect", async () => {
    const token = await getAuthCookie();

    // Clear login-related Prisma calls
    mocks.findUnique.mockClear();

    const response = await request(app)
      .delete("/api/account")
      .set("Cookie", token)
      .send({
        password: "WrongPassword123!",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Incorrect password",
    });

    // Verify Prisma found the authenticated user
    expect(mocks.findUnique).toHaveBeenCalledOnce();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
    });

    // No deletion should happen
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.users).toHaveLength(1);
    expect(mocks.entries).toHaveLength(3);

    // Original password remains valid
    expect(
      await bcrypt.compare(password, mocks.users[0].password)
    ).toBe(true);
  });

  // TEST 4: User no longer exists in the database
  it("should return 404 when the authenticated user no longer exists", async () => {
    const token = await getAuthCookie();

    // Remove user from mock database while keeping their entries
    mocks.users.length = 0;

    // Clear login-related Prisma calls
    mocks.findUnique.mockClear();

    const response = await request(app)
      .delete("/api/account")
      .set("Cookie", token)
      .send({ password });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: "User not found",
    });

    // Verify Prisma attempted to find the user
    expect(mocks.findUnique).toHaveBeenCalledOnce();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
    });

    // No deletion should happen
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();

    // Entries remain untouched
    expect(mocks.users).toHaveLength(0);
    expect(mocks.entries).toHaveLength(3);
  });
});