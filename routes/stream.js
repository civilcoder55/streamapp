// imports
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const Movies = require("../models/movies");

//---------------------------------------------------------------------------//

//---------------------------------------------------------------------------//
router.get("/m3u/:name", async function (req, res) {
  name = req.params.name;
  return res.sendFile(path.join(__dirname, "../data/" + name.split("_")[0] + "/" + name + ".m3u8"));
});

router.get(
  "/stream/:name",
  async function (req, res, next) {
    try {
      movie = await Movies.findOne({ where: { id: name.split("_")[0] } });
      if (!req.isAuthenticated() && movie.type == "Basic") {
        return next();
      }
      switch (movie.type) {
        case "Cinematic":
          if (req.user.subscription.plan.type == "Cinematic") {
            return next();
          }
          break;
        case "Premium":
          if (req.user.subscription.plan.type == "Cinematic" || req.user.subscription.plan.type == "Premium") {
            return next();
          }
          break;
        case "Basic":
          return next();
          break;
      }
      return res.sendStatus(403);
    } catch (error) {
      return res.sendStatus(403);
    }
  },
  async function (req, res) {
    console.log(req.cookies);
    name = req.params.name;
    range = req.headers.range;
    try {
      if (!req.isAuthenticated()) {
        quality = name.endsWith("_lq.ts") ? name.split("_")[0] + "_lq.ts" : name.split("_")[0] + "_sd.ts";
      } else {
        switch (req.user.subscription.plan.type) {
          case "Cinematic":
            quality = name;
            break;
          case "Premium":
            quality = name.split("_")[1] != "fhd" ? name : name.split("_")[0] + "_hd.ts";
            break;
          case "Basic":
            quality = name.endsWith("_lq.ts") ? name.split("_")[0] + "_lq.ts" : name.split("_")[0] + "_sd.ts";
            break;
        }
      }
      file = path.join(__dirname, "../data/" + name.split("_")[0] + "/" + quality);
      fs.stat(file, (err, data) => {
        stats = data;
        file_size = stats.size;
        positions = range.replace(/bytes=/, "").split("-");
        start = parseInt(positions[0], 10);
        end = positions[1] ? parseInt(positions[1], 10) : file_size - 1;
        chunksize = end - start + 1;
        head = {
          "Content-Range": "bytes " + start + "-" + end + "/" + file_size,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "application/octet-stream",
        };
        res.writeHead(206, head);
        stream_position = {
          start: start,
          end: end,
        };
        stream = fs.createReadStream(file, stream_position);
        stream.on("open", function () {
          stream.pipe(res);
        });
      });
    } catch (error) {
      res.sendStatus(403);
    }
  }
);

router.get("/sub/:name", async function (req, res) {
  name = req.params.name;
  res.sendFile(path.join(__dirname, `../data/${name}/` + name + ".vtt"));
});
router.get("/screen/:id/:file", async function (req, res) {
  file = req.params.file;
  id = req.params.id;
  res.sendFile(path.join(__dirname, `../data/${id}/` + file));
});
module.exports = router;
