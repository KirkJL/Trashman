import { api } from "./api.js";

const el = {
  authPanel: document.getElementById("authPanel"),
  gameShell: document.getElementById("gameShell"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginBtn: document.getElementById("loginBtn"),
  registerBtn: document.getElementById("registerBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  authMessage: document.getElementById("authMessage"),
  gameMessage: document.getElementById("gameMessage"),

  moneyText: document.getElementById("moneyText"),
  repText: document.getElementById("repText"),
  workersText: document.getElementById("workersText"),
  capacityText: document.getElementById("capacityText"),
  capacityMaxText: document.getElementById("capacityMaxText"),

  shopBtn: document.getElementById("shopBtn"),
  saveBtn: document.getElementById("saveBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  shopPanel: document.getElementById("shopPanel"),
  pausePanel: document.getElementById("pausePanel"),
  closeShopBtn: document.getElementById("closeShopBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  soundToggle: document.getElementById("soundToggle"),

  buyWorkerBtn: document.getElementById("buyWorkerBtn"),
  vanCapacityBtn: document.getElementById("vanCapacityBtn"),
  vanSpeedBtn: document.getElementById("vanSpeedBtn"),
  workerEffBtn: document.getElementById("workerEffBtn"),
  repMultBtn: document.getElementById("repMultBtn"),

  leaderboardList: document.getElementById("leaderboardList")
};

function setMessage(target, text) {
  target.textContent = text;
  if (text) {
    window.setTimeout(() => {
      if (target.textContent === text) target.textContent = "";
    }, 3500);
  }
}

function cleanCreds() {
  return {
    username: el.usernameInput.value.trim(),
    password: el.passwordInput.value
  };
}

async function authFlow(mode) {
  const { username, password } = cleanCreds();

  try {
    el.authMessage.textContent = "Checking...";
    const result = mode === "register"
      ? await api.register(username, password)
      : await api.login(username, password);

    el.authMessage.textContent = "";
    el.authPanel.classList.add("hidden");
    el.gameShell.classList.remove("hidden");

    window.dispatchEvent(new CustomEvent("trash:authed", {
      detail: { user: result.user }
    }));
  } catch (err) {
    el.authMessage.textContent = err.message;
  }
}

el.loginBtn.addEventListener("click", () => authFlow("login"));
el.registerBtn.addEventListener("click", () => authFlow("register"));

el.passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") authFlow("login");
});

el.shopBtn.addEventListener("click", () => {
  el.shopPanel.classList.toggle("hidden");
});

el.closeShopBtn.addEventListener("click", () => {
  el.shopPanel.classList.add("hidden");
});

el.pauseBtn.addEventListener("click", () => {
  el.pausePanel.classList.remove("hidden");
  window.dispatchEvent(new Event("trash:pause"));
});

el.resumeBtn.addEventListener("click", () => {
  el.pausePanel.classList.add("hidden");
  window.dispatchEvent(new Event("trash:resume"));
});

el.saveBtn.addEventListener("click", () => {
  window.dispatchEvent(new Event("trash:save"));
});

el.logoutBtn.addEventListener("click", async () => {
  await api.logout();
  location.reload();
});

el.soundToggle.addEventListener("change", () => {
  window.dispatchEvent(new CustomEvent("trash:sound", {
    detail: { enabled: el.soundToggle.checked }
  }));
});

el.buyWorkerBtn.addEventListener("click", () => window.dispatchEvent(new Event("trash:buyWorker")));
el.vanCapacityBtn.addEventListener("click", () => window.dispatchEvent(new Event("trash:upgradeCapacity")));
el.vanSpeedBtn.addEventListener("click", () => window.dispatchEvent(new Event("trash:upgradeSpeed")));
el.workerEffBtn.addEventListener("click", () => window.dispatchEvent(new Event("trash:upgradeWorkers")));
el.repMultBtn.addEventListener("click", () => window.dispatchEvent(new Event("trash:upgradeRep")));

export const ui = {
  showGame() {
    el.authPanel.classList.add("hidden");
    el.gameShell.classList.remove("hidden");
  },

  updateHud(state) {
    el.moneyText.textContent = String(Math.floor(state.money));
    el.repText.textContent = String(Math.floor(state.reputation));
    el.workersText.textContent = String(state.workers);
    el.capacityText.textContent = String(state.vanLoad);
    el.capacityMaxText.textContent = String(state.vanCapacity);
  },

  toast(text) {
    setMessage(el.gameMessage, text);
  },

  setLeaderboard(rows) {
    while (el.leaderboardList.firstChild) {
      el.leaderboardList.removeChild(el.leaderboardList.firstChild);
    }

    for (const row of rows) {
      const li = document.createElement("li");
      li.textContent = `${row.username}: £${row.money} / Rep ${row.reputation}`;
      el.leaderboardList.appendChild(li);
    }
  }
};

window.trashUi = ui;
