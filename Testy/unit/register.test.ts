import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

// Mock Prisma
vi.mock("../../App/backend/config/db", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
      create: mocks.create,
    },
  },
}));

// Import router directly, without starting the server
import accountRoutes from "../../App/backend/routes/accountRoutes";

const app = express();

app.use(express.json());
app.use("/api", accountRoutes);

describe("POST /api/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: username does not exist
    mocks.findUnique.mockResolvedValue(null);

    // Mock successful database insertion
    mocks.create.mockImplementation(async ({ data }) => ({
      id: 123,
      username: data.username,
      password: data.password,
    }));
  });

  // TEST 1: Successful registration
  it("should register a user and send the correct data to Prisma", async () => {
    const username = `testuser_${Date.now()}@example.com`;
    const password = "StrongPassword123!";

    const response = await request(app)
      .post("/api/register")
      .send({
        username,
        password,
      });

    expect(response.status).toBe(201);

    expect(response.body).toEqual({
      message: "User created successfully",
      userId: 123,
      username,
    });

    // Check username lookup
    expect(mocks.findUnique).toHaveBeenCalledOnce();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username },
    });

    // Check database insertion
    expect(mocks.create).toHaveBeenCalledOnce();

    const databaseData = mocks.create.mock.calls[0][0].data;

    expect(databaseData.username).toBe(username);

    // Password must be hashed
    expect(databaseData.password).toEqual(expect.any(String));
    expect(databaseData.password).not.toBe(password);

    // Check exact data received by Prisma
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        username,
        password: databaseData.password,
      },
    });
  });

  // TEST 2: Missing username
  it("should reject registration when username is missing", async () => {
    const response = await request(app)
      .post("/api/register")
      .send({
        password: "StrongPassword123!",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Username and password are required",
    });

    // Database should not be queried or modified
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("should reject registration when username is not a valid email address", async () => {
    const response = await request(app)
      .post("/api/register")
      .send({ username: "not-an-email", password: "StrongPassword123!" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Username must be a valid email address",
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  // TEST 3: Missing password
  it("should reject registration when password is missing", async () => {
    const response = await request(app)
      .post("/api/register")
      .send({
        username: "testuser@example.com",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Username and password are required",
    });

    // Database should not be queried or modified
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  // TEST 4: Invalid password
  it("should reject registration when password does not meet validation rules", async () => {
    const response = await request(app)
      .post("/api/register")
      .send({
        username: "testuser@example.com",
        password: "short",
      });

    expect(response.status).toBe(400);

    expect(response.body.error).toEqual(expect.any(String));

    // Validation happens before checking the database
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  // TEST 5: Username already exists
  it("should reject registration when username is already taken", async () => {
    const username = "existinguser@example.com";

    // Simulate an existing database user
    mocks.findUnique.mockResolvedValue({
      id: 456,
      username,
      password: "existing_hashed_password",
    });

    const response = await request(app)
      .post("/api/register")
      .send({
        username,
        password: "StrongPassword123!",
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Username is already taken",
    });

    // Verify Prisma checked the username
    expect(mocks.findUnique).toHaveBeenCalledOnce();

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username },
    });

    // Existing user must not be overwritten
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
