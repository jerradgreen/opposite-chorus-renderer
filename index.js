const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json({ limit: "50mb" }));

app.post("/render", upload.single("video"), (req, res) => {
  const chorus = req.body.opposite_chorus;
  const lines = chorus.split("\n");
  const spacing = 80;
  const fadeInDuration = 1;

  const inputPath = req.file.path;
  const outputPath = `rendered/${Date.now()}.mp4`;

  const drawtextFilters = lines.map((line, i) => {
    const yOffset = `(h/2 - ${spacing * (lines.length / 2)}) + ${i * spacing}`;
    return `drawtext=text='${line.replace(/:/g, '\\:').replace(/'/g, "\\'")}':fontcolor=white:fontsize=48:shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${yOffset}:enable='between(t,${i * fadeInDuration},999)':alpha='if(lt(t,${i * fadeInDuration}),0,if(lt(t,${i * fadeInDuration + 1}),t-${i * fadeInDuration},1))'`;
  }).join(",");

  ffmpeg(inputPath)
    .videoFilters(drawtextFilters)
    .outputOptions("-preset ultrafast")
    .size("1080x1920")
    .on("end", () => {
      res.sendFile(path.resolve(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    })
    .on("error", (err) => {
      console.error(err);
      res.status(500).send("Rendering failed.");
    })
    .save(outputPath);
});

app.get("/", (req, res) => {
  res.send("Opposite Chorus Renderer is live.");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
