import dotenv from "dotenv";
dotenv.config({ path: "./.env", override: true });
import connectDB from "./src/db/index.js";
import app from "./src/app.js";
import http from "http";

const port = 8081;
const server = http.createServer(app);
await connectDB();
await new Promise((resolve) => server.listen(port, resolve));
console.log("Server started on port", port);

let bearerToken = "";
let refreshToken = "";
const saveTokens = (data) => {
  if (!data || typeof data !== "object") return;
  const payload = data.data || data;
  if (payload.accessToken) {
    bearerToken = payload.accessToken;
  }
  if (payload.refreshToken) {
    refreshToken = payload.refreshToken;
  }
};

const request = async (method, path, body, headers = {}) => {
  const url = `http://localhost:${port}${path}`;
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  };
  if (bearerToken) {
    opts.headers.Authorization = `Bearer ${bearerToken}`;
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  saveTokens(data);
  return { status: res.status, headers: res.headers, data };
};

const unwrap = (result) => {
  if (!result || !result.data) return null;
  const body = result.data;
  if (body.data !== undefined) return body.data;
  return body;
};

const randomId = Date.now();
const user1 = {
  email: `route-test-${randomId}@example.com`,
  username: `routeuser${randomId}`,
  password: "Test1234",
};
const user2 = {
  email: `route-test-2-${randomId}@example.com`,
  username: `routeuser2-${randomId}`,
  password: "Test1234",
};

const results = [];
const check = async (name, fn, expectedStatus = 200) => {
  try {
    const result = await fn();
    if (result.status !== expectedStatus) {
      throw new Error(`${name} expected status ${expectedStatus} but got ${result.status} - ${JSON.stringify(result.data)}`);
    }
    results.push({ name, ok: true, result });
    console.log(`✅ ${name}`);
    return result;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    results.push({ name, ok: false, error: err.message });
    throw err;
  }
};

try {
  await check("Health check", async () => request("GET", "/api/v1/healthcheck/"), 200);
  await check("Register user 1", async () => request("POST", "/api/v1/auth/register", user1), 201);
  await check("Register user 2", async () => request("POST", "/api/v1/auth/register", user2), 201);
  const loginRes = await check("Login user 1", async () => request("POST", "/api/v1/auth/login", { email: user1.email, password: user1.password }), 200);
  await check("Get current user", async () => request("POST", "/api/v1/auth/current-user"), 200);
  await check("Refresh token", async () => request("POST", "/api/v1/auth/refresh-token", { refreshToken }), 200);
  const projectRes = await check("Create project", async () => request("POST", "/api/v1/projects/", { name: `Route Test Project ${randomId}`, description: "Route test project" }), 201);
  const projectId = unwrap(projectRes).data?._id || unwrap(projectRes)._id || unwrap(projectRes).doc?._id;
  console.log("Resolved projectId:", projectId, "createProjectResponse:", JSON.stringify(projectRes.data));
  await check("List projects", async () => request("GET", "/api/v1/projects/"), 200);
  await check("Get project by id", async () => request("GET", `/api/v1/projects/${projectId}`), 200);
  await check("Update project", async () => request("PUT", `/api/v1/projects/${projectId}`, { name: `Updated Project ${randomId}`, description: "Updated description" }), 200);
  await check("Invite member", async () => request("POST", `/api/v1/projects/${projectId}/members`, { email: user2.email, role: "member" }), 201);
  const memberListRes = await check("List project members", async () => request("GET", `/api/v1/projects/${projectId}/members`), 200);
  let user2Id = null;
  if (Array.isArray(memberListRes.data)) {
    const findUser = memberListRes.data.find((member) => member.user?.username === user2.username);
    if (findUser) user2Id = findUser.user._id;
  }
  if (!user2Id) {
    const users = await import("./src/models/user.models.js");
    const userDoc = await users.User.findOne({ email: user2.email }).lean();
    if (userDoc) {
      user2Id = userDoc._id.toString();
    }
  }
  if (!user2Id) {
    throw new Error("Unable to resolve second user id");
  }
  await check("Update member role", async () => request("PUT", `/api/v1/projects/${projectId}/members/${user2Id}`, { newRole: "project_admin" }));
  await check("Remove member", async () => request("DELETE", `/api/v1/projects/${projectId}/members/${user2Id}`));
  const taskRes = await check("Create task", async () => request("POST", `/api/v1/tasks/${projectId}`, { title: "Route Test Task", description: "Task for route testing", status: "todo" }), 201);
  const createdTask = unwrap(taskRes);
  const taskId = createdTask?._id || createdTask?._doc?._id;
  if (!taskId) {
    throw new Error(`Create task response did not include task _id: ${JSON.stringify(taskRes.data)}`);
  }
  await check("List tasks", async () => request("GET", `/api/v1/tasks/${projectId}`), 200);
  await check("Get task by id", async () => request("GET", `/api/v1/tasks/${projectId}/t/${taskId}`), 200);
  await check("Update task", async () => request("PUT", `/api/v1/tasks/${projectId}/t/${taskId}`, { title: "Updated task title", status: "in_progress" }));
  const subtaskRes = await check("Create subtask", async () => request("POST", `/api/v1/tasks/${projectId}/t/${taskId}/subtasks`, { title: "Route subtask" }), 201);
  const createdSubtask = unwrap(subtaskRes);
  const subTaskId = createdSubtask?._id || createdSubtask?._doc?._id;
  if (!subTaskId) {
    throw new Error(`Create subtask response did not include subTask _id: ${JSON.stringify(subtaskRes.data)}`);
  }
  await check("Update subtask", async () => request("PUT", `/api/v1/tasks/${projectId}/st/${subTaskId}`, { isCompleted: true }), 200);
  await check("Delete subtask", async () => request("DELETE", `/api/v1/tasks/${projectId}/st/${subTaskId}`));
  await check("Create note", async () => request("POST", `/api/v1/notes/${projectId}`, { content: "Route test note" }), 201);
  const notesRes = await check("List notes", async () => request("GET", `/api/v1/notes/${projectId}`), 200);
  const noteId = notesRes.data[0]?._id;
  if (noteId) {
    await check("Get note by id", async () => request("GET", `/api/v1/notes/${projectId}/${noteId}`));
    await check("Update note", async () => request("PUT", `/api/v1/notes/${projectId}/${noteId}`, { content: "Updated note content" }));
    await check("Delete note", async () => request("DELETE", `/api/v1/notes/${projectId}/${noteId}`));
  }
  await check("Delete task", async () => request("DELETE", `/api/v1/tasks/${projectId}/t/${taskId}`));
  await check("Delete project", async () => request("DELETE", `/api/v1/projects/${projectId}`));
  await check("Logout", async () => request("POST", "/api/v1/auth/logout"));

  console.log("All route tests passed.");
} catch (err) {
  console.error("Route tests failed:", err);
} finally {
  server.close();
  process.exit(0);
}
