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
  findUserUnique: vi.fn(),
  findEntryUnique: vi.fn(),
  deleteEntry: vi.fn(),
}));

// Mock Prisma
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUserUnique,
    },
    entry: {
      findUnique: mocks.findEntryUnique,
      delete: mocks.deleteEntry,
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

describe("DELETE /api/entries/:id", () => {
  const regularUser = {
    id: 123,
    username: "regularuser@example.com",
    password: "RegularPassword123!",
    admin: false,
  };

  const adminUser = {
    id: 456,
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

    // Hash user passwords
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
        id: "entry-regular",
        name: "Regular user's entry",
        amount: 100,
        user_id: regularUser.id,
        income: false,
      },
      {
        id: "entry-admin",
        name: "Admin's entry",
        amount: 200,
        user_id: adminUser.id,
        income: true,
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
    mocks.findEntryUnique.mockImplementation(async ({ where }) => {
      return mocks.entries.find(
        entry => String(entry.id) === String(where.id)
      ) ?? null;
    });

    // Mock Prisma entry deletion
    mocks.deleteEntry.mockImplementation(async ({ where }) => {
      const index = mocks.entries.findIndex(
        entry => String(entry.id) === String(where.id)
      );

      if (index === -1) {
        throw new Error("Entry not found");
      }

      return mocks.entries.splice(index, 1)[0];
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

  // TEST 1: Admin deletes another user's entry
  it("should allow an admin to delete another user's entry", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    expect(mocks.users).toHaveLength(2);
    expect(mocks.entries).toHaveLength(2);

    const response = await request(app)
      .delete("/api/entries/entry-regular")
      .set("Cookie", token);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      message: "Entry deleted successfully",
    });

    expect(mocks.findEntryUnique).toHaveBeenCalledWith({
      where: { id: "entry-regular" },
    });

    expect(mocks.deleteEntry).toHaveBeenCalledOnce();

    expect(mocks.deleteEntry).toHaveBeenCalledWith({
      where: { id: "entry-regular" },
    });

    // Verify final database state
    expect(mocks.entries).toHaveLength(1);

    expect(
      mocks.entries.find(entry => entry.id === "entry-regular")
    ).toBeUndefined();

    // Admin's own entry must remain untouched
    expect(mocks.entries[0]).toMatchObject({
      id: "entry-admin",
      user_id: adminUser.id,
    });
  });

  // TEST 2: Entry does not exist
  it("should return 404 when trying to delete a nonexistent entry", async () => {
    const token = await getAuthCookie(
      adminUser.username,
      adminUser.password
    );

    const response = await request(app)
      .delete("/api/entries/nonexistent-entry")
      .set("Cookie", token);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: "Entry not found",
    });

    // Verify Prisma searched for the requested entry
    expect(mocks.findEntryUnique).toHaveBeenCalledWith({
      where: { id: "nonexistent-entry" },
    });

    // No deletion should occur
    expect(mocks.deleteEntry).not.toHaveBeenCalled();

    // Database remains unchanged
    expect(mocks.entries).toHaveLength(2);

    expect(
      mocks.entries.find(entry => entry.id === "entry-regular")
    ).toBeDefined();

    expect(
      mocks.entries.find(entry => entry.id === "entry-admin")
    ).toBeDefined();
  });
});