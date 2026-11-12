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

    mocks.findUnique.mockResolvedValue(null);

    mocks.create.mockImplementation(async ({ data }) => ({
      id: 123,
      username: data.username,
      password: data.password,
    }));
  });

  it("should register a user and send the correct data to Prisma", async () => {
    const username = `testuser_${Date.now()}`;
    const password = "StrongPassword123!";

    const response = await request(app)
      .post("/api/register")
      .send({
        username,
        password,
      });

    // Check HTTP response
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

    // Check exact username sent to Prisma
    expect(databaseData.username).toBe(username);

    // Check that password was hashed before being sent to Prisma
    expect(databaseData.password).toEqual(expect.any(String));
    expect(databaseData.password).not.toBe(password);

    // Check the complete data received by Prisma
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        username,
        password: databaseData.password,
      },
    });
  });
});