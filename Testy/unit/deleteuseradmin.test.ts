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
    username: "adminuser",
    password: "AdminPassword123!",
    admin: true,
  };

  const regularUser = {
    id: "user-456",
    username: "regularuser",
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
    mocks.transaction.mockImplementation(async operations => {
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

  // TEST 1: Admin successfully deletes another user
  it("should allow an admin to delete a user and all their entries", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    // Verify initial database population
    expect(mocks.users).toHaveLength(2);
    expect(mocks.entries).toHaveLength(3);

    // Verify passwords were hashed
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

    // Delete regular user
    const response = await request(app)
      .delete(`/api/users/${regularUser.id}`)
      .set("Cookie", token);

    // Check HTTP response
    expect(response.status, JSON.stringify(response.body)).toBe(200);

    expect(response.body).toEqual({
      message: `User '${regularUser.username}' and all associated entries deleted successfully`,
    });

    // Verify Prisma found the correct user
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: regularUser.id,
      },
    });

    // Verify Prisma transaction
    expect(mocks.transaction).toHaveBeenCalledOnce();

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        user_id: regularUser.id,
      },
    });

    expect(mocks.deleteUser).toHaveBeenCalledWith({
      where: {
        id: regularUser.id,
      },
    });

    // Verify final database state
    expect(mocks.users).toHaveLength(1);
    expect(mocks.users[0].id).toBe(adminUser.id);

    // All entries belonging to the deleted user must be gone
    expect(
      mocks.entries.filter(
        entry => entry.user_id === regularUser.id
      )
    ).toHaveLength(0);

    // Admin's entries must remain untouched
    expect(mocks.entries).toHaveLength(1);

    expect(mocks.entries[0]).toMatchObject({
      id: "entry-3",
      user_id: adminUser.id,
    });
  });

  // TEST 2: Admin cannot delete their own account
  it("should prevent an admin from deleting their own account", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    // Clear login-related Prisma calls
    mocks.findUnique.mockClear();

    const response = await request(app)
      .delete(`/api/users/${adminUser.id}`)
      .set("Cookie", token);

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "You cannot delete your own admin account from the user management panel.",
    });

    // No database lookup or deletion should happen
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.users).toHaveLength(2);
    expect(mocks.entries).toHaveLength(3);
  });

  // TEST 3: Admin receives 404 when target user does not exist
  it("should return 404 when the target user does not exist", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    mocks.findUnique.mockClear();

    const response = await request(app)
      .delete("/api/users/nonexistent-user")
      .set("Cookie", token);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: "User not found",
    });

    // Verify lookup was performed

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: "nonexistent-user",
      },
    });

    // No deletion should occur
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.users).toHaveLength(2);
    expect(mocks.entries).toHaveLength(3);
  });

  // TEST 4: Admin provides an invalid user ID
  it("should reject a user ID containing only whitespace", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    mocks.findUnique.mockClear();

    const response = await request(app)
      .delete("/api/users/%20")
      .set("Cookie", token);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: "User not found",
    });

    // Verify Prisma received the whitespace ID

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: " ",
      },
    });

    // No deletion should occur
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.users).toHaveLength(2);
    expect(mocks.entries).toHaveLength(3);
  });
});