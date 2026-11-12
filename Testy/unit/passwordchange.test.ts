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
  update: vi.fn(),
}));

// Mock Prisma with an in-memory database
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

// Import router directly, without starting the server
import accountRoutes from "../../App/backend/routes/accountRoutes";

// Create test Express application
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/api", accountRoutes);

describe("PUT /api/password", () => {
  const username = "testuser";
  const oldPassword = "OldPassword123!";
  const newPassword = "NewPassword456!";
  const userId = 123;

  beforeEach(async () => {
    vi.clearAllMocks();

    process.env.JWT_SECRET = "test_jwt_secret";

    // Clear in-memory database
    mocks.users.length = 0;

    // Hash original password
    const hashedPassword = await bcrypt.hash(oldPassword, 10);

    // Populate mock database with an existing user
    mocks.users.push({
      id: userId,
      username,
      password: hashedPassword,
      admin: false,
    });

    // Mock Prisma user lookup
    mocks.findUnique.mockImplementation(async ({ where }) => {
      return mocks.users.find(user =>
        where.id !== undefined
          ? user.id === where.id
          : user.username === where.username
      ) ?? null;
    });

    // Mock Prisma database update
    mocks.update.mockImplementation(async ({ where, data }) => {
      const user = mocks.users.find(
        user => user.id === where.id
      );

      if (!user) {
        throw new Error("User not found");
      }

      Object.assign(user, data);

      return user;
    });
  });

  // Helper: log in and obtain a real JWT authentication cookie
  async function getAuthCookie(): Promise<string> {
    const response = await request(app)
      .post("/api/login")
      .send({
        username,
        password: oldPassword,
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const cookies = response.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const tokenCookie = cookies[0].split(";")[0];

    expect(tokenCookie).toContain("token=");

    return tokenCookie;
  }

  // TEST 1: Successful password change
  it("should successfully change the password of an authenticated user", async () => {
    // Log in to obtain JWT
    const tokenCookie = await getAuthCookie();

    // Change password
    const response = await request(app)
      .put("/api/password")
      .set("Cookie", tokenCookie)
      .send({
        oldPassword,
        newPassword,
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      message: "Password updated successfully",
    });

    // Verify Prisma looked up the correct user
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username },
    });

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
    });

    // Verify Prisma received the correct update
    expect(mocks.update).toHaveBeenCalledOnce();

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      data: {
        password: expect.any(String),
      },
    });

    // Verify the password was actually changed
    const updatedUser = mocks.users[0];

    expect(updatedUser.password).not.toBe(oldPassword);
    expect(updatedUser.password).not.toBe(newPassword);

    // New password must match stored hash
    expect(
      await bcrypt.compare(newPassword, updatedUser.password)
    ).toBe(true);

    // Old password must no longer match
    expect(
      await bcrypt.compare(oldPassword, updatedUser.password)
    ).toBe(false);
  });

  // TEST 2: Missing old password
  it("should reject password change when old password is missing", async () => {
    const tokenCookie = await getAuthCookie();

    // Clear login-related Prisma calls
    mocks.findUnique.mockClear();

    const response = await request(app)
      .put("/api/password")
      .set("Cookie", tokenCookie)
      .send({
        newPassword,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Old password and new password are required",
    });

    // No database lookup or update should happen
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();

    // Original password remains unchanged
    expect(
      await bcrypt.compare(oldPassword, mocks.users[0].password)
    ).toBe(true);
  });

  // TEST 3: Missing new password
  it("should reject password change when new password is missing", async () => {
    const tokenCookie = await getAuthCookie();

    // Clear login-related Prisma calls
    mocks.findUnique.mockClear();

    const response = await request(app)
      .put("/api/password")
      .set("Cookie", tokenCookie)
      .send({
        oldPassword,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Old password and new password are required",
    });

    // No database lookup or update should happen
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();

    // Original password remains unchanged
    expect(
      await bcrypt.compare(oldPassword, mocks.users[0].password)
    ).toBe(true);
  });

  // TEST 4: Incorrect old password
  it("should reject password change when old password is incorrect", async () => {
    const tokenCookie = await getAuthCookie();

    // Clear login-related Prisma calls
    mocks.findUnique.mockClear();

    const response = await request(app)
      .put("/api/password")
      .set("Cookie", tokenCookie)
      .send({
        oldPassword: "WrongPassword123!",
        newPassword,
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Incorrect old password",
    });

    // Verify Prisma found the correct user
    expect(mocks.findUnique).toHaveBeenCalledOnce();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
    });

    // No database update should happen
    expect(mocks.update).not.toHaveBeenCalled();

    // Original password remains valid
    expect(
      await bcrypt.compare(oldPassword, mocks.users[0].password)
    ).toBe(true);
  });

  // TEST 5: Invalid new password
  it("should reject a new password that fails password validation", async () => {
    const tokenCookie = await getAuthCookie();

    // Clear login-related Prisma calls
    mocks.findUnique.mockClear();

    const response = await request(app)
      .put("/api/password")
      .set("Cookie", tokenCookie)
      .send({
        oldPassword,
        newPassword: "short",
      });

    expect(response.status).toBe(400);

    expect(response.body.error).toEqual(expect.any(String));

    // Validation happens before the database lookup
    expect(mocks.findUnique).not.toHaveBeenCalled();

    // No database update should happen
    expect(mocks.update).not.toHaveBeenCalled();

    // Original password remains unchanged
    expect(
      await bcrypt.compare(oldPassword, mocks.users[0].password)
    ).toBe(true);
  });
});