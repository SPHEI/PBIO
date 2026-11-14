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

describe("User everything integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users.length = 0;
    mocks.entries.length = 0;
    process.env.JWT_SECRET = "test_jwt_secret";
  });

  it("registers, logs in, adds an entry, retrieves it, deletes it, adds another entry, changes password, logs in again, and deletes the account", async () => {
    const username = `testuser_${Date.now()}@example.com`;
    const password = "StrongPassword123!";

    const registration = await request(app).post("/api/register").send({ username, password });
    expect(registration.status).toBe(201);
    expect(registration.body).toEqual({
      message: "User created successfully",
      userId: "user-2",
      username,
    });
    expect(mocks.users).toHaveLength(2);
    expect(mocks.users[1].password).not.toBe(password);
    expect(await bcrypt.compare(password, mocks.users[1].password)).toBe(true);

    const login = await request(app).post("/api/login").send({ username, password });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    expect(login.body).toEqual({
      message: "Login successful",
      userId: "user-2",
      username,
      admin: false,
    });
    expect(login.headers["set-cookie"][0]).toContain("token=");
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");

    const cookie = login.headers["set-cookie"];
    const created = await request(app)
      .post("/api/entries")
      .set("Cookie", cookie)
      .send({ name: "Groceries", amount: "42.50", income: false });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.entry).toMatchObject({
      id: "entry-1",
      name: "Groceries",
      amount: 42.5,
      income: false,
      user_id: "user-2",
    });
    expect(mocks.entries).toHaveLength(1);

    const listed = await request(app).get("/api/entries").set("Cookie", cookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.entry.id);
    expect(listed.body[0].user_id).toBe("user-2");

    const deleted = await request(app)
      .delete(`/api/entries/${listed.body[0].id}`)
      .set("Cookie", cookie);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ message: "Entry deleted successfully" });
    expect(mocks.entries).toHaveLength(0);

    const listedAfterDelete = await request(app).get("/api/entries").set("Cookie", cookie);
    expect(listedAfterDelete.status).toBe(200);
    expect(listedAfterDelete.body).toEqual([]);


    const created2 = await request(app)
      .post("/api/entries")
      .set("Cookie", cookie)
      .send({ name: "Income", amount: "4552.50", income: true });
    expect(created2.status, JSON.stringify(created2.body)).toBe(201);
    expect(created2.body.entry).toMatchObject({
      id: "entry-1",
      name: "Income",
      amount: 4552.5,
      income: true,
      user_id: "user-2",
    });
    expect(mocks.entries).toHaveLength(1);

    const listed2 = await request(app).get("/api/entries").set("Cookie", cookie);
    expect(listed2.status).toBe(200);
    expect(listed2.body).toHaveLength(1);
    expect(listed2.body[0].id).toBe(created2.body.entry.id);
    expect(listed2.body[0].user_id).toBe("user-2");


    const change = await request(app)
    .put("/api/password")
    .send({oldPassword: "StrongPassword123!", newPassword: "NewPassword123!"})
    .set("Cookie", cookie);
    expect(change.status, JSON.stringify(change.body)).toBe(200);

    expect(await bcrypt.compare("NewPassword123!", mocks.users[1].password)).toBe(true);
    

    const login2 = await request(app)
      .post("/api/login")
      .send({ username, password: "NewPassword123!" });
    expect(login2.status, JSON.stringify(login2.body)).toBe(200);

    const cookie2 = login.headers["set-cookie"];
    expect(cookie2[0]).toContain("token=");
    const response = await request(app)
        .delete("/api/account")
        .set("Cookie", cookie2 )
        .send({ password: "NewPassword123!"});

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({
        message: "Account and associated data deleted successfully",
    });
    expect(mocks.users).toHaveLength(1);
  });

  
});
