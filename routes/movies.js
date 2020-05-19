const express = require("express");
const router = express.Router();
const Movies = require("../models/movies");
const Genre = require("../models/genre");
const Op = require("sequelize").Op;
const sequelize = require("../utilis/db.js");
const fs = require("fs");
const util = require("util");
const readdir = util.promisify(fs.readdir);

async function getMovies(limit, offset, filter) {
  movies = await Movies.findAll({
    subQuery: false,
    include: [
      {
        model: Genre,
      },
    ],
    where: filter,
    limit: limit,
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

async function Paginator(limit, page, filter) {
  const count = await Movies.count({
    include: [
      {
        model: Genre,
      },
    ],
    where: filter,
  });

  pages = Math.ceil(count / limit);

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

async function Filter(query) {
  const { genre, quality, year, rate } = query;
  filter = {};
  templateFilter = {
    genre: "Genre",
    year: "Year",
    quality: "Quality",
    rate: "Rate",
  };
  if (genre) {
    genreCheck = await Genre.findOne({ where: { title: genre }, raw: true });
    if (genreCheck) {
      filter["$genres.title$"] = genre;
      templateFilter.genre = genre;
    }
  }
  if (quality) {
  }
  if (parseInt(year) >= 2000 && parseInt(year) <= 2020) {
    filter.year = parseInt(year);
    templateFilter.year = year;
  }
  if (rate) {
    if (rate.split("+")[1] >= 4 && rate.split("+")[1] < 10) {
      filter.rate = { [Op.gte]: rate.split("+")[1] };
      templateFilter.rate = rate;
    }
  }

  return [filter, templateFilter];
}

router.get("/", async function (req, res) {
  movies = await getMovies();
  res.render("index", { movies, title: "home" });
});

router.get("/movies", async function (req, res) {
  const page = req.query.page;
  filters = await Filter(req.query);
  filter = filters[0];
  templateFilter = filters[1];

  if (!parseInt(page) || page == 1) {
    paginator = await Paginator(6, 1, filter);
    movies = await getMovies(6, null, filter);
  } else {
    movies = await getMovies(6, (page - 1) * 6, filter);
    paginator = await Paginator(6, page, filter);
    if (movies.length == 0) {
      movies = await getMovies(6, (paginator.pages - 1) * 6, filter);
      paginator.page = paginator.pages;
    }
  }

  genres = await Genre.findAll({ raw: true });

  res.render("movies", {
    genres,
    movies,
    paginator,
    filter: templateFilter,
    title: "Browse Movies",
  });
});

router.get("/search", async function (req, res) {
  const page = req.query.page;
  filter = {
    title: {
      [Op.like]: "%" + req.query.movie + "%",
    },
  };
  if (!parseInt(page) || page == 1) {
    paginator = await Paginator(6, 1, filter);
    movies = await getMovies(6, null, filter);
  } else {
    movies = await getMovies(6, (page - 1) * 6, filter);
    paginator = await Paginator(6, page, filter);
    if (movies.length == 0) {
      movies = await getMovies(6, (paginator.pages - 1) * 6, filter);
      paginator.page = paginator.pages;
    }
  }

  genres = await Genre.findAll({ raw: true });

  res.render("movies", { genres, movies, paginator, title: "Search Results" });
});

router.get("/movie/:id", async function (req, res) {
  render = "movie";
  const id = req.params.id;
  movie = await Movies.findOne({
    include: [{ model: Genre }],
    where: { id: id },
  });
  relates = await Movies.findAll({
    raw: true,
    subQuery: false,
    include: [
      {
        model: Genre,
      },
    ],
    where: {
      "$genres.title$": { [Op.in]: movie.genres.map((genre) => genre.title) },
      id: { [Op.ne]: id },
    },
    limit: 3,
    order: sequelize.random(),
  });
  movie = movie.get({ plain: true });
  files = await readdir(`./data/${id}`);
  const screenshots = files.filter((file) => file.endsWith(".png"));
  if (!req.isAuthenticated() && movie.type != "Basic") {
    return res.render("onlyPremium", {
      type: movie.type,
      movie,
      title: movie.title,
      screenshots,
      relates,
    });
  }
  switch (movie.type) {
    case "Cinematic":
      if (req.user.subscription.plan.type == "Cinematic") {
        return res.render("movie", {
          movie,
          title: movie.title,
          screenshots,
          relates,
        });
      }
      break;
    case "Premium":
      if (req.user.subscription.plan.type == "Cinematic" || req.user.subscription.plan.type == "Premium") {
        return res.render("movie", {
          movie,
          title: movie.title,
          screenshots,
          relates,
        });
      }
      break;
    case "Basic":
      return res.render("movie", {
        movie,
        title: movie.title,
        screenshots,
        relates,
      });
      break;
  }

  return res.render("onlyPremium", {
    type: movie.type,
    movie,
    title: movie.title,
    screenshots,
    relates,
  });
});

module.exports = router;
