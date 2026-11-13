import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const appRequire = createRequire(
  fileURLToPath(new URL("../../App/package.json", import.meta.url)),
);
const bcrypt = appRequire("bcrypt");

// This is a small in-memory Prisma substitute. Each mocked Prisma operation
// reads or mutates the same collections so requests exercise realistic state.
const mocks = vi.hoisted(() => {
  const users: any[] = [];
  const entries: any[] = [];

  const matches = (record: any, where: any = {}) =>
    Object.entries(where).every(([key, value]) => record[key] === value);

  const database = {
    users,
    entries,
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.find((user) => matches(user, where)) ?? null),
      findFirst: vi.fn(async ({ where }: any = {}) => users.find((user) => matches(user, where)) ?? null),
      findMany: vi.fn(async ({ where }: any = {}) => users.filter((user) => matches(user, where))),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: `user-${users.length + 1}`,
          username: data.username,
          password: data.password,
          admin: data.admin ?? false,
          createdAt: new Date(),
        };
        users.push(user);
        return user;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = users.find((record) => matches(record, where));
        if (!user) throw new Error("User not found");
        Object.assign(user, data);
        return user;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const index = users.findIndex((user) => matches(user, where));
        if (index < 0) throw new Error("User not found");
        return users.splice(index, 1)[0];
      }),
    },
    entry: {
      create: vi.fn(async ({ data }: any) => {
        const entry = {
          id: `entry-${entries.length + 1}`,
          name: data.name ?? "Transfer",
          amount: data.amount,
          date: data.date ?? new Date(),
          income: data.income ?? false,
          user_id: data.user_id,
        };
        entries.push(entry);
        return entry;
      }),
      findUnique: vi.fn(async ({ where }: any) => entries.find((entry) => matches(entry, where)) ?? null),
      findMany: vi.fn(async ({ where, orderBy }: any = {}) => {
        const result = entries.filter((entry) => matches(entry, where));
        if (orderBy?.date) {
          result.sort((a, b) => orderBy.date === "desc"
            ? b.date.getTime() - a.date.getTime()
            : a.date.getTime() - b.date.getTime());
        }
        return result;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const index = entries.findIndex((entry) => matches(entry, where));
        if (index < 0) throw new Error("Entry not found");
        return entries.splice(index, 1)[0];
      }),
      deleteMany: vi.fn(async ({ where }: any = {}) => {
        const before = entries.length;
        for (let i = entries.length - 1; i >= 0; i--) {
          if (matches(entries[i], where)) entries.splice(i, 1);
        }
        return { count: before - entries.length };
      }),
    },
    $transaction: vi.fn(async (operations: Promise<any>[]) => Promise.all(operations)),
  };

  return database;
});

vi.mock("../../App/backend/config/db", () => ({ default: mocks }));

// Import the Express app without starting a real database connection.
import app from "../../App/backend/server";

describe("User password change integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users.length = 0;
    mocks.entries.length = 0;
    process.env.JWT_SECRET = "test_jwt_secret";
  });


  it("logs in, changes password, and logs in again", async () => {
    const upasswordhash = await bcrypt.hash("UserPassword123!", 10);
    const user = {
      id: "user-2",
      username: "regular-user",
      password: upasswordhash,
      admin: false,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    mocks.users.push(user);

    const login = await request(app)
      .post("/api/login")
      .send({ username: "regular-user", password: "UserPassword123!" });
    expect(login.status, JSON.stringify(login.body)).toBe(200);

    const cookie = login.headers["set-cookie"];
    expect(cookie[0]).toContain("token=");
    expect(cookie[0]).toContain("HttpOnly");

    const change = await request(app)
    .put("/api/password")
    .send({oldPassword: "UserPassword123!", newPassword: "NewPassword123!"})
    .set("Cookie", cookie);
    expect(change.status, JSON.stringify(change.body)).toBe(200);

    expect(await bcrypt.compare("NewPassword123!", mocks.users[1].password)).toBe(true);
    

    const login2 = await request(app)
      .post("/api/login")
      .send({ username: "regular-user", password: "NewPassword123!" });
    expect(login2.status, JSON.stringify(login2.body)).toBe(200);

    const cookie2 = login.headers["set-cookie"];
    expect(cookie2[0]).toContain("token=");
    expect(cookie2[0]).toContain("HttpOnly");
  });
});
