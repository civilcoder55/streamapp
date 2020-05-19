// imports
const express = require("express");
const router = express.Router();
const kue = require("kue");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const Genre = require("../models/genre");
const Movies = require("../models/movies");
const Users = require("../models/users");
const multer = require("multer");
const sharp = require("sharp");
const WebTorrent = require("webtorrent");
const client = new WebTorrent();
const srt2vtt = require("srt-to-vtt");
const streamifier = require("streamifier");
const util = require("util");
const rename = util.promisify(fs.rename);
//-------------------------------------------------------------------------------------------------------------------------------------------//
//configrations
const jobs = kue.createQueue();
const upload = multer({
  storage: multer.memoryStorage({}),
  limits: { fieldSize: 5000000 },
});
//-------------------------------------------------------------------------------------------------------------------------------------------//
// get additem page
router.get(
  "/admin/add",
  function (req, res, next) {
    if (req.isAuthenticated()) {
      if (req.user.isAdmin) {
        return next();
      }
    }
    return res.redirect("/");
  },
  async function (req, res) {
    genres = await Genre.findAll({ raw: true });
    return res.render("addItem", { genres });
  }
);
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle new movie tasks
router.post(
  "/admin/add",
  function (req, res, next) {
    if (req.isAuthenticated()) {
      if (req.user.isAdmin) {
        return next();
      }
    }
    return res.redirect("/");
  },
  upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "sub", maxCount: 1 },
    { name: "poster", maxCount: 1 },
  ]),
  async function (req, res) {
    const { title, desc, year, genre, country, time, torrent, rate, type } = req.body;
    movie = await Movies.create({ title, desc, year, country, time, rate, type }); // create the movie in the database
    await fs.mkdir(`./data/${movie.id}`, { recursive: true }, (err) => {
      console.log(err);
    }); //create folder for the movie in data folder
    sharp(req.files.cover[0].buffer)
      .resize(270, 400)
      .png()
      .toFile(`./public/img/covers/${movie.id}.png`, (err, info) => {}); // resize the cover and save it in static files
    sharp(req.files.poster[0].buffer)
      .resize(540, 308)
      .png()
      .toFile(`./public/img/posters/${movie.id}.png`, (err, info) => {}); // resize the poster and save it in static files
    streamifier
      .createReadStream(req.files.sub[0].buffer)
      .pipe(srt2vtt())
      .pipe(fs.createWriteStream(`./data/${movie.id}/${movie.id}.vtt`)); // convert subtitle file and save it in folder movie

    // add genres to the movie
    if (Array.isArray(genre)) {
      genre.forEach(async (item) => {
        genre_ = await Genre.findOne({ where: { title: item } });
        await movie.addGenre(genre_);
      });
    } else {
      genre_ = await Genre.findOne({ where: { title: genre } });
      await movie.addGenre(genre_);
    }
    //create the background task to download movie torrent
    jobs.create("downloading", { title: movie.title, id: movie.id, torrent }).save();
    //redirect me to the background tasks panel
    return res.redirect("/kue-api");
  }
);
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle torrent download
jobs.process("downloading", async function (job, ctx, done) {
  client.add(job.data.torrent, { path: "./data/" }, async function (torrent) {
    torrent.on("download", function (bytes) {
      //console.log("download speed: " + torrent.downloadSpeed / 1000 +"KB");
      //console.log("progress: " + torrent.progress * 100);
      job.progress(torrent.progress * 100, 100);
    });
    var file = torrent.files.find(function (file) {
      return file.name.endsWith(".mp4");
    });
    torrent.on("error", function (err) {
      console.log(err);
    });
    torrent.on("done", async function (err) {
      await rename(`./data/${file.path}`, `./data/${job.data.id}/${job.data.id}.mp4`); // move movie.mp4 file to its folder to being transcoded and processed
      jobs.create("master", { name: job.data.id }).save(); // job to create master playlist of hls
      jobs.create("transcoding_240p", { name: job.data.id }).save(); // job to transcode movie to sd quality
      done();
    });
  });
  client.on("error", function (err) {
    console.log(err);
  });
});
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle 240p transcoding
jobs.process("transcoding_240p", function (job, done) {
  const name = job.data.name;
  ffmpeg(`./data/${name}/${name}.mp4`, { timeout: 432000 })
    .addOptions([
      "-profile:v main",
      "-s 426x240",
      '-vf drawtext=text="240":fontsize=100',
      "-preset ultrafast",
      "-hls_time 5",
      "-hls_flags single_file",
      "-hls_list_size 0",
      "-hls_playlist_type vod",
      "-hls_base_url https://stream.backenddev.co/stream/",
    ])
    .output(`./data/${name}/${name}_lq.m3u8`)
    .on("progress", function (progress) {
      job.progress(progress.percent, 100);
    })
    .on("end", async function () {
      jobs.create("transcoding_sd", { name }).save();
      done();
    })
    .run();
});
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle sd transcoding
jobs.process("transcoding_sd", function (job, done) {
  const name = job.data.name;
  ffmpeg(`./data/${name}/${name}.mp4`, { timeout: 432000 })
    .addOptions([
      "-profile:v main",
      "-s 640x360",
      '-vf drawtext=text="360":fontsize=100',
      "-preset ultrafast",
      "-hls_time 5",
      "-hls_flags single_file",
      "-hls_list_size 0",
      "-hls_playlist_type vod",
      "-hls_base_url https://stream.backenddev.co/stream/",
    ])
    .output(`./data/${name}/${name}_sd.m3u8`)
    .on("progress", function (progress) {
      job.progress(progress.percent, 100);
    })
    .on("end", async function () {
      jobs.create("transcoding_hd", { name }).save();
      done();
    })
    .run();
});
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle hd transcoding
jobs.process("transcoding_hd", function (job, done) {
  const name = job.data.name;
  ffmpeg(`./data/${name}/${name}.mp4`, { timeout: 432000 })
    .addOptions([
      "-profile:v main",
      "-s 1280x720",
      '-vf drawtext=text="720":fontsize=100',
      "-preset ultrafast",
      "-hls_time 5",
      "-hls_flags single_file",
      "-hls_list_size 0",
      "-hls_playlist_type vod",
      "-hls_base_url https://stream.backenddev.co/stream/",
    ])
    .output(`./data/${name}/${name}_hd.m3u8`)
    .on("progress", function (progress) {
      job.progress(progress.percent, 100);
    })
    .on("end", async function () {
      jobs.create("transcoding_fhd", { name }).save();
      done();
    })
    .run();
});
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle fhd transcoding
jobs.process("transcoding_fhd", function (job, done) {
  const name = job.data.name;
  ffmpeg(`./data/${name}/${name}.mp4`, { timeout: 432000 })
    .addOptions([
      "-profile:v main",
      "-s 1920x1080",
      '-vf drawtext=text="1080":fontsize=100',
      "-preset ultrafast",
      "-hls_time 5",
      "-hls_flags single_file",
      "-hls_list_size 0",
      "-hls_playlist_type vod",
      "-hls_base_url https://stream.backenddev.co/stream/",
    ])
    .output(`./data/${name}/${name}_fhd.m3u8`)
    .on("progress", function (progress) {
      job.progress(progress.percent, 100);
    })
    .on("end", async function () {
      jobs.create("screenshot", { name }).save();
      done();
    })
    .run();
});
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle extracting screenshot of the movie every 15 min
jobs.process("screenshot", async function (job, done) {
  const name = job.data.name;
  ffmpeg(`./data/${name}/${name}.mp4`, { timeout: 432000 })
    .addOptions(["-r 0.00111111111111111111111111111111"])
    .output(`./data/${name}/${name}%03d.png`)
    .on("progress", function (progress) {
      job.progress(progress.percent, 100);
    })
    .on("end", async function () {
      jobs.create("cleaning", { name }).save();
      done();
    })
    .run();
});
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle deleteing main mp4 file to save space
jobs.process("cleaning", async function (job, done) {
  const name = job.data.name;
  try {
    fs.unlink(`./data/${name}/${name}.mp4`, (err) => {
      console.log(err);
    });
    done();
  } catch (err) {
    console.error(err);
  }
});
//-------------------------------------------------------------------------------------------------------------------------------------------//
// handle making master hls playlist
jobs.process("master", function (job, done) {
  const name = job.data.name;
  const content = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-STREAM-INF:PROGRAM-ID=0,BANDWIDTH=398200,RESOLUTION=426x240,CLOSED-CAPTIONS=NONE
https://stream.backenddev.co/m3u/${name}_lq
#EXT-X-STREAM-INF:PROGRAM-ID=0,BANDWIDTH=687500,RESOLUTION=640x360,CLOSED-CAPTIONS=NONE
https://stream.backenddev.co/m3u/${name}_sd
#EXT-X-STREAM-INF:PROGRAM-ID=0,BANDWIDTH=1454200,RESOLUTION=1280x720,CLOSED-CAPTIONS=NONE
https://stream.backenddev.co/m3u/${name}_hd
#EXT-X-STREAM-INF:PROGRAM-ID=0,BANDWIDTH=2332000,RESOLUTION=1920x1080,CLOSED-CAPTIONS=NONE
https://stream.backenddev.co/m3u/${name}_fhd`;
  fs.writeFile(`./data/${name}/${name}_master.m3u8`, content, function (err) {
    if (err) console.error(err);
    done();
  });
});

//-------------------------------------------------------------------------------------------------------------------------------------------//

//admin movies panel
async function getMovies(offset) {
  movies = await Movies.findAll({
    limit: 10,
    offset: offset,
    order: [["id", "DESC"]],
  });

  const moviesList = [];
  for (let i = 0; i < movies.length; i++) {
    movie = movies[i].get({ plain: true });
    moviesList.push(movie);
  }
  return moviesList;
}
async function Paginator(page) {
  const count = await Movies.count();

  pages = Math.ceil(count / 10);

  hasOther = pages > 1 ? true : false;
  hasNext = page < pages && hasOther ? true : false;
  hasPerv = page > 1 && hasOther ? true : false;
  return {
    pages: pages,
    hasOther: hasOther,
    hasNext: hasNext,
    hasPerv: hasPerv,
    page: parseInt(page),
  };
}
//-------------------------------------------------------------------------------------------------------------------------------------------//
router.get(
  "/admin/movies",
  function (req, res, next) {
    if (req.isAuthenticated()) {
      if (req.user.isAdmin) {
        return next();
      }
    }
    return res.redirect("/");
  },
  async function (req, res) {
    const page = req.query.page;
    const count = await Movies.count();
    if (!parseInt(page) || page == 1) {
      paginator = await Paginator(1);
      movies = await getMovies(null);
    } else {
      movies = await getMovies((page - 1) * 10);
      paginator = await Paginator(page);
      if (movies.length == 0) {
        movies = await getMovies((paginator.pages - 1) * 10);
        paginator.page = paginator.pages;
      }
    }

    return res.render("adminMovies", { movies, paginator, count });
  }
);
//-------------------------------------------------------------------------------------------------------------------------------------------//
router.post(
  "/admin/movies/delete/:id",
  function (req, res, next) {
    if (req.isAuthenticated()) {
      if (req.user.isAdmin) {
        return next();
      }
    }
    return res.redirect("/");
  },
  async function (req, res) {
    const id = req.params.id;
    if (id) {
      await Movies.destroy({ where: { id } });
    }

    return res.redirect("/admin/movies");
  }
);
//-------------------------------------------------------------------------------------------------------------------------------------------//
router.get(
  "/admin/edit/:id",
  function (req, res, next) {
    if (req.isAuthenticated()) {
      if (req.user.isAdmin) {
        return next();
      }
    }
    return res.redirect("/");
  },
  async function (req, res) {
    const id = req.params.id;
    movie = await Movies.findOne({ where: { id } });
    genres = await Genre.findAll({ raw: true });
    genres_ = await movie.getGenres({ raw: true });
    return res.render("edititem", { movie, genres, genres_ });
  }
);
//-------------------------------------------------------------------------------------------------------------------------------------------//
router.post(
  "/admin/edit/:id",
  function (req, res, next) {
    if (req.isAuthenticated()) {
      if (req.user.isAdmin) {
        return next();
      }
    }
    return res.redirect("/");
  },
  upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "sub", maxCount: 1 },
    { name: "poster", maxCount: 1 },
  ]),
  async function (req, res) {
    const id = req.params.id;
    const { title, desc, year, genre, country, time, rate, type } = req.body;
    movie = await Movies.findOne({ where: { id } });
    await movie.update({ title, desc, year, country, time, rate, type });
    genres = await movie.getGenres();
    await movie.removeGenres(genres);
    if (Array.isArray(genre)) {
      genre.forEach(async (item) => {
        genre_ = await Genre.findOne({ where: { title: item } });
        await movie.addGenre(genre_);
      });
    } else {
      genre_ = await Genre.findOne({ where: { title: genre } });
      await movie.addGenre(genre_);
    }

    if (req.files.cover) {
      sharp(req.files.cover[0].buffer)
        .resize(270, 400)
        .png()
        .toFile(`./public/img/covers/${id}.png`, (err, info) => {});
    } else if (req.files.poster) {
      sharp(req.files.poster[0].buffer)
        .resize(540, 308)
        .png()
        .toFile(`./public/img/posters/${movie.id}.png`, (err, info) => {});
    } else if (req.files.sub) {
      streamifier
        .createReadStream(req.files.sub[0].buffer)
        .pipe(srt2vtt())
        .pipe(fs.createWriteStream(`./data/${movie.id}/${movie.id}.vtt`));
    }
    return res.redirect("/admin/edit/" + id);
  }
);

//-------------------------------------------------------------------------------------------------------------------------------------------//

module.exports = router;
