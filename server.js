const express = require("express");
const ejs = require("ejs");
const path = require("path");
const http = require("http");
const dotenv = require("dotenv");
const session = require("express-session");
const { Server } = require("socket.io");
const { initializeApp } = require("firebase/app");
const { request } = require("undici");
const {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
} = require("firebase/database");

dotenv.config();

const port = process.env.PORT || 3000;

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    name: "flappy-crypto",
    secret: "fghy654$5tgRrr",
    resave: false,
    saveUninitialized: true,
  })
);

const errorHandler = (err, req, res, next) => {
  res.status(err.status || 500).json({ err: { message: err.message } });
};

app.use(errorHandler);

app.get("/", async (req, res) => {
  return res.render("index", {});
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const firebase = initializeApp({
  apiKey: "AIzaSyALswdE4EclGpsyA4FYVcL0RYe9HZd6vf4",
  authDomain: "article-bcccc.firebaseapp.com",
  databaseURL: "https://article-bcccc-default-rtdb.firebaseio.com",
  projectId: "article-bcccc",
  storageBucket: "article-bcccc.appspot.com",
  messagingSenderId: "558259234111",
  appId: "1:558259234111:web:8b89fa061e0f5a7e189f8a",
});

const db = getDatabase(firebase);

const getCodes = (score, codes = "[]") => {
  let unlocked = null;
  let newCodes = [];
  try {
    const _codes = JSON.parse(codes);
    if (Array.isArray(_codes)) {
      newCodes = _codes;
    }
  } catch (err) {
    console.log(err);
  }

  if (score >= 500) {
    const cd5h = newCodes.find((cd) => cd.points == "500");
    if (!cd5h) {
      const code = Math.floor(Math.random() * 900000) + 100000;
      unlocked = {
        points: "500",
        code: code,
      };
      newCodes.push(unlocked);
    }
  }

  if (score >= 1000) {
    const cd1k = newCodes.find((cd) => cd.points == "1000");
    if (!cd1k) {
      const code = Math.floor(Math.random() * 900000) + 100000;
      unlocked = {
        points: "1000",
        code: code,
      };
      newCodes.push(unlocked);
    }
  }

  if (score >= 5000) {
    const cd5k = newCodes.find((cd) => cd.points == "5000");
    if (!cd5k) {
      const code = Math.floor(Math.random() * 900000) + 100000;
      unlocked = {
        points: "5000",
        code: code,
      };
      newCodes.push(unlocked);
    }
  }

  return { codes: JSON.stringify(newCodes), unlocked };
};

const storeData = async (data, codes) => {
  try {
    await set(ref(db, `scores/${data.username}`), {
      username: data.username,
      name: data.name,
      score: data.score,
      codes: codes,
    }).then(() => {
      get(ref(db, "scores")).then((scoreValue) => {
        const dataValue = scoreValue.val();

        if (Object.keys(dataValue).length > 100) {
          const scores = Object.entries(dataValue)
            .map((score) => {
              return score[1];
            })
            .sort((a, b) => b.score - a.score);

          scores.splice(-1, 1);

          const scoreData = {};

          scores.forEach((score) => {
            scoreData[score.username] = score;
          });

          set(ref(db, "scores"), scores);
        }
      });
    });
  } catch (err) {
    console.log(err);
  }
};

const deleteData = async (username) => {
  try {
    remove(ref(db, `scores/${username}`)).then((value) => {});
  } catch (err) {
    console.log(err);
  }
};

const sendUserData = async (socket, username) => {
  try {
    get(ref(db, `scores/${username}`)).then((value) => {
      if (value.exists()) {
        const user = value.val();
        socket.emit("userData", user);
      }
    });
  } catch (err) {
    console.log(err);
  }
};

io.on("connection", (socket) => {
  console.log("Connected...");

  socket.on("getUser", (data) => {
    // Delete user data
    // deleteData(data.username);
    sendUserData(socket, data.username);
  });

  socket.on("updateScore", async (data, callback) => {
    try {
      const value = await get(ref(db, `scores/${data.username}`));
      if (value.exists()) {
        const dataValue = value.val();
        const score =
          dataValue.score < data.score ? data.score : dataValue.score;
        const codeData = getCodes(data.score, dataValue.codes);
        await update(ref(db, `scores/${data.username}`), {
          score: score,
          codes: codeData.codes,
        });
        sendUserData(socket, data.username);
        callback({ ...data, unlocked: codeData.unlocked });
      } else {
        const codeData = getCodes(data.score);
        await storeData(data, codeData.codes);
        await sendUserData(socket, data.username);
        callback({ ...data, unlocked: codeData.unlocked });
      }
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("leaderboard", () => {
    get(ref(db, "scores")).then((value) => {
      const scores = value.toJSON();
      socket.emit("leaderboard", scores || []);
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected...");
  });
});

server.listen(port, () => {
  console.log(`Listening to port ${port}...`);
});
