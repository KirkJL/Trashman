const API_BASE = "https://trashman.kirkjlemon.workers.dev";

let memoryToken = "";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (memoryToken) {
    headers.set("Authorization", `Bearer ${memoryToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({ ok: false, error: "Bad response" }));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  if (data.token) {
    memoryToken = data.token;
  }

  return data;
}

export const api = {
  async register(username, password) {
    return request("/api/register", {
      method: "POST",
      body: { username, password }
    });
  },

  async login(username, password) {
    return request("/api/login", {
      method: "POST",
      body: { username, password }
    });
  },

  async logout() {
    try {
      await request("/api/logout", { method: "POST", body: {} });
    } finally {
      memoryToken = "";
    }
  },

  async me() {
    return request("/api/me");
  },

  async loadSave() {
    return request("/api/save");
  },

  async saveGame(save) {
    return request("/api/save", {
      method: "POST",
      body: { save }
    });
  },

  async leaderboard() {
    return request("/api/leaderboard");
  }
};

window.trashApi = api;
