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
  const rawLines = chorus.split(/\r?\n/).filter(Boolean);
  const spacing = 80;
  const fadeInDuration = 1;
  const wrapLength = 30;

  const sanitize = (text) =>
    text
      .replace(/[:\\]/g, "\\$&")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');

  // Wrap long lines
  const wrapLine = (line, length) => {
    const words = line.split(" ");
    const wrapped = [];
    let current = "";
    for (const word of words) {
      if ((current + word).length > length) {
        wrapped.push(current.trim());
        current = word + " ";
      } else {
        current += word + " ";
      }
    }
    if (current.trim()) wrapped.push(current.trim());
    return wrapped;
  };

  const wrappedLines = rawLines.flatMap(line => wrapLine(line, wrapLength));

  // Ensure 'rendered/' exists
  if (!fs.existsSync("rendered")) {
    fs.mkdirSync("rendered");
  }

  const inputPath = req.file.path;
  const outputPath = `rendered/${Date.now()}.mp4`;

  const drawtextFilters = wrappedLines.map((line, i) => {
    const yOffset = `(h/2 - ${spacing * (wrappedLines.length / 2)}) + ${i * spacing}`;
    const durationStart = i * fadeInDuration;
    const durationEnd = durationStart + fadeInDuration;

    return `drawtext=text='${sanitize(line)}':fontcolor=white:fontsize=38:shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${yOffset}:enable='between(t,${durationStart},999)':alpha='if(lt(t,${durationStart}),0,if(lt(t,${durationEnd}),t-${durationStart},1))'`;
  });

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
    .on("stderr", (line) => console.log("FFmpeg:", line))
    .on("error", (err) => {
      console.error("FFmpeg failed:", err);
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
