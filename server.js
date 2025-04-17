import express from "express";
import upHandler from "./api/up.js";
import fetchHandler from "./api/fetch.js";
import screenshotHandler from "./api/screenshot.js";

const app = express();
const port = 3000;
app.use(express.json());

app.get("/api/up", upHandler);
app.post("/api/fetch", fetchHandler);
app.post("/api/screenshot", screenshotHandler);

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
