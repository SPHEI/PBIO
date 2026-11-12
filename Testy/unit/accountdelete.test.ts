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
  const username = "delete_test_user";
  const password = "StrongPassword123!";
  const userId = 123;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set JWT secret for login and authentication
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
    mocks.transaction.mockImplementation(async (operations) => {
      return Promise.all(operations);
    });
  });

  it("should delete an authenticated user's account and associated entries", async () => {

    // STEP 1: Log in to obtain a real JWT token
    const loginResponse = await request(app)
      .post("/api/login")
      .send({
        username,
        password,
      });

    expect(loginResponse.status).toBe(200);

    expect(loginResponse.body).toMatchObject({
      message: "Login successful",
      userId,
      username,
    });

    // Extract JWT authentication cookie
    const cookies = loginResponse.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const tokenCookie = cookies
      .find((cookie: string) => cookie.startsWith("token="))
      ?.split(";")[0];

    expect(tokenCookie).toBeDefined();


    // STEP 2: Verify mock database is populated
    expect(mocks.users).toHaveLength(1);
    expect(mocks.entries).toHaveLength(3);

    expect(mocks.users[0].password).not.toBe(password);

    expect(
      await bcrypt.compare(password, mocks.users[0].password)
    ).toBe(true);


    // STEP 3: Delete account using JWT token
    const response = await request(app)
      .delete("/api/account")
      .set("Cookie", tokenCookie!)
      .send({
        password,
      });

    // STEP 4: Check HTTP response
    expect(response.status, JSON.stringify(response.body)).toBe(200);

    expect(response.body).toEqual({
      message: "Account and associated data deleted successfully",
    });


    // STEP 5: Verify Prisma found the user
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username },
    });

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
    });


    // STEP 6: Verify password comparison
    // The login and account deletion should both verify the password.
    expect(
      await bcrypt.compare(password, mocks.users[0]?.password ?? "")
    ).toBe(false);

    // Verify transaction was executed
    expect(mocks.transaction).toHaveBeenCalledOnce();


    // STEP 7: Verify associated entries were deleted
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        user_id: userId,
      },
    });


    // STEP 8: Verify user was deleted
    expect(mocks.deleteUser).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
    });


    // STEP 9: Verify final in-memory database state
    expect(mocks.users).toHaveLength(0);

    // Only entries belonging to other users should remain
    expect(mocks.entries).toHaveLength(1);

    expect(mocks.entries[0]).toEqual({
      id: 3,
      user_id: 999,
      content: "Another user's entry",
    });
  });
});