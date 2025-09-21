// index.js
const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json({ limit: "50mb" }));
app.use('/rendered', express.static('rendered'));

app.post("/render", upload.single("video"), (req, res) => {
  const inputPath = req.file?.path;
  const outputPath = `rendered/${Date.now()}.mp4`;
  const videoFilename = path.basename(outputPath);

  if (!inputPath) {
    return res.status(400).send("No video file provided.");
  }

  if (!fs.existsSync("rendered")) {
    fs.mkdirSync("rendered");
  }

  const sanitize = (text) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "")
      .replace(/"/g, "")
      .replace(/:/g, "\\:")
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")
      .replace(/%/g, "\\%");

  let drawtextFilters = [];

  if (req.body.captions) {
    let captions = [];
    try {
      captions = JSON.parse(req.body.captions);
    } catch (e) {
      return res.status(400).send("Invalid captions JSON.");
    }

    drawtextFilters = captions.map((line, i) => {
      const yOffset = `h-(150+${i * 65})`;
      return `drawtext=text='${sanitize(line.text)}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontcolor=white:fontsize=36:shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${yOffset}:enable='between(t,${line.start},${line.start + line.duration})'`;
    });
  }

  else if (req.body.opposite_chorus) {
    const spacing = 70;
    const wrapLength = 22;
    const rawLines = req.body.opposite_chorus.split(/\r?\n/).filter(Boolean);

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

    const wrappedLines = rawLines.flatMap((line) => wrapLine(line, wrapLength));

    // Title header
    drawtextFilters.push(
      `drawtext=text='Opposite Chorus Challenge':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf:fontcolor=white:fontsize=44:shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=100:enable='between(t,0,999)'`
    );

    // Subtitle
    drawtextFilters.push(
      `drawtext=text='Guess the original song from this opposite chorus!':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontcolor=white:fontsize=26:shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=160:enable='between(t,0,999)'`
    );

    wrappedLines.forEach((line, i) => {
      const yOffset = `(h/2 - ${spacing} * (${wrappedLines.length} / 2)) + ${i * spacing}`;
      const durationStart = i * 1;
      const durationEnd = durationStart + 1;
      const safeText = sanitize(line);
      drawtextFilters.push(
        `drawtext=text='${safeText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontcolor=white:fontsize=38:shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${yOffset}:enable='between(t,${durationStart},999)':alpha='if(lt(t,${durationStart}),0,if(lt(t,${durationEnd}),t-${durationStart},1))'`
      );
    });
  }

  else {
    return res.status(400).send("Missing required text: either captions[] or opposite_chorus.");
  }

  ffmpeg(inputPath)
  .videoFilters(drawtextFilters)
  .outputOptions("-preset ultrafast")
  .duration(15)
  .size("1080x1920")
  .on("end", () => {
    const videoFilename = path.basename(outputPath);

    res.send({
      video_filename: videoFilename
    });

    fs.unlinkSync(inputPath);
    // fs.unlinkSync(outputPath); // keep this commented
  })
  .on("stderr", (line) => console.log("FFmpeg stderr:", line))
  .on("error", (err) => {
    console.error("Rendering error:", err);
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
