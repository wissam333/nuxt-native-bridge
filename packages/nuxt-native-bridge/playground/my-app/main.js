import { app, BrowserWindow, protocol, net } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (require("electron-squirrel-startup")) app.quit();

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow = null;

const publicDir = app.isPackaged
  ? path.join(process.resourcesPath, "app.asar.unpacked", "public_nuxt")
  : path.join(__dirname, "../.output/public");

const isDev = !fs.existsSync(path.join(publicDir, "index.html"));

const loadWindow = async (win, route = "") => {
  const url = isDev
    ? `http://localhost:3000/${route ? "#" + route : ""}`
    : `app://./${route ? "#" + route : ""}`;
  await win.loadURL(url);
};

const registerProtocol = () => {
  protocol.handle("app", (request) => {
    let filePath = request.url.slice("app://./".length);
    filePath = filePath.split("?")[0].split("#")[0];
    if (!filePath || !path.extname(filePath)) filePath = "index.html";
    return net.fetch(pathToFileURL(path.join(publicDir, filePath)).toString());
  });
};

const createWindow = async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "أرسلها",
    icon: path.join(__dirname, "../public/favicon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });
  await loadWindow(mainWindow);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.whenReady().then(async () => {
  registerProtocol();
  await createWindow();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
