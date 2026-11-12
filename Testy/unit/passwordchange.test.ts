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

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear in-memory database
    mocks.users.length = 0;

    // Hash the original password
    const hashedPassword = await bcrypt.hash(oldPassword, 10);

    // Populate mock database with an existing user
    mocks.users.push({
      id: 123,
      username,
      password: hashedPassword,
      admin: false,
    });

    // Simulate Prisma user lookup
    mocks.findUnique.mockImplementation(async ({ where }) => {
      return mocks.users.find(user =>
        where.id !== undefined
          ? user.id === where.id
          : user.username === where.username
      ) ?? null;
    });

    // Simulate Prisma database update
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

  it("should successfully change the password of an authenticated user", async () => {

    // STEP 1: Log in to obtain a real JWT token
    const loginResponse = await request(app)
      .post("/api/login")
      .send({
        username,
        password: oldPassword,
      });

    expect(loginResponse.status).toBe(200);

    expect(loginResponse.body).toMatchObject({
      message: "Login successful",
      userId: 123,
      username,
    });

    // Extract authentication cookie
    const setCookie = loginResponse.headers["set-cookie"];

    expect(setCookie).toBeDefined();

    const tokenCookie = setCookie[0].split(";")[0];

    expect(tokenCookie).toContain("token=");


    // STEP 2: Change password using the obtained JWT
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


    // STEP 3: Verify Prisma looked up the correct user
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username },
    });

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 123 },
    });


    // STEP 4: Verify Prisma received the correct update
    expect(mocks.update).toHaveBeenCalledOnce();

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: 123,
      },
      data: {
        password: expect.any(String),
      },
    });


    // STEP 5: Verify the password was actually changed
    const updatedUser = mocks.users[0];

    expect(updatedUser.password).not.toBe(oldPassword);
    expect(updatedUser.password).not.toBe(newPassword);

    // New password should match the stored hash
    expect(
      await bcrypt.compare(newPassword, updatedUser.password)
    ).toBe(true);

    // Old password should no longer match
    expect(
      await bcrypt.compare(oldPassword, updatedUser.password)
    ).toBe(false);
  });
});