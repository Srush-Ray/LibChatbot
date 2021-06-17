require("dotenv").config();
const cors = require("cors");
const request = require("request");
// var bodyParser = require("body-parser");
const express = require("express");
const path = require("path");
var app = require("express")();
app.use(cors());
app.use(express.urlencoded());
app.use(express.json());

// app.use(express.static(__dirname + "/public"));
// app.use(express.static("public"));
app.use("/static", express.static("public"));

var http = require("http").createServer(app);
var io = require("socket.io")(http, {
  cors: {
    origin: "*",
    credentials: true,
  },
});
// const { spawn } = require("child_process");
const Pool = require("pg").Pool;
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// const pool = new Pool({
//   user: "dyhgctjqbmdgzi",
//   host: "ec2-23-22-191-232.compute-1.amazonaws.com",
//   database: "d8vvied9p5rnob",
//   password: "f42f02ba1dec14620f2ee83428f08c834f39edf81ed018d48669ebbfdbc4bb44",
//   port: 5432,
//   ssl: true,
// });

const pool = new Pool({
  user: "laexdbkuunnaor",
  host: "ec2-34-193-113-223.compute-1.amazonaws.com",
  database: "d13p2frpf0gf2h",
  password: "7899c1f0a7d2c51e62637ab2a8ccaa3656520f236d7e296dec3ecd76096c6f5c",
  port: 5432,
  ssl: true,
});

const port = process.env.PORT || 3000;
console.log(__dirname);
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/templates/index.html");
});
app.post("/satisfycount", async function (req, res) {
  let requestData = req.body;
  console.log(requestData);
  // console.log(req.body.qid, requestData.qid);
  await pool.query(
    `SELECT * FROM "query_table" where id=${requestData.qid}`,
    async (error, results) => {
      if (error) {
        console.log(error);
        // throw error;
        res.status(200).json({ message: error });
      }
      if (requestData.flag === "unsatisfied") {
        let unsatCount = results.rows[0].unsatisfied;
        unsatCount = unsatCount + 1;
        await pool.query(
          `UPDATE query_table SET unsatisfied = ${unsatCount} WHERE id = ${requestData.qid}`,
          (err, updates) => {
            if (err) {
              // console.log(err);
              res.status(200).json({ message: err });
            } else if (updates) {
              console.log(updates.rowCount);
              pool.query(
                `INSERT INTO list_unsat VALUES(DEFAULT,'${requestData.userQ}','${requestData.qid}')`,
                (err, updates) => {
                  if (err) {
                    // console.log(err);
                    res.status(200).json({ message: err });
                  } else if (updates) {
                    console.log(updates.rowCount);
                    res.status(200).json({ message: "Done" });
                  }
                }
              );
              // res.status(200).json({ message: "Done" });
            }
          }
        );
      } else {
        let satCount = results.rows[0].satisfied;
        satCount = satCount + 1;
        await pool.query(
          `UPDATE query_table SET satisfied = ${satCount} WHERE id = ${requestData.qid}`,
          (err, updates) => {
            if (err) {
              // console.log(err);
              res.status(200).json({ message: err });
            } else if (updates) {
              // console.log(updates.rowCount);
              res.status(200).json({ message: "Done" });
            }
          }
        );
      }

      // res.status(200).json({ message: "Noted" });
    }
  );
});

let users = {};

io.on("connection", function (socket) {
  // console.log("a user connected");
  users[socket.id] = socket.id;
  socket.join(socket.id);
  // console.log(socket.rooms);
  socket.on("chat message", function (userRequest) {
    // console.log(userRequest);
    // const python = spawn("python", ["script.py", userRequest]);
    // var dataToSend;
    // python.stdout.on("data", function (data) {
    //   dataToSend = data.toString();
    // });
    request.post(
      {
        url: "https://salty-citadel-80959.herokuapp.com/flask",
        form: { message: userRequest.userMsg, flag: "1" },
      },
      async function (error, response, body) {
        if (error) {
          // console.log(error);
          io.in(socket.id).emit("chat message", "from bot " + error);
        } else {
          // console.log("statusCode:", response && response.statusCode); // Print the response status code if a response was received
          // console.log("body:", body); // Print the data received
          responseData = JSON.parse(body);
          await pool.query(
            `SELECT * FROM "query_table" where id=${responseData.qid}`,
            (error, results) => {
              if (error) {
                // console.log(error);
                // throw error;
                io.in(socket.id).emit(
                  "chat message",
                  "Please try again later or contact us."
                );
              }

              let botData = {
                answer: results.rows[0].answer,
                id: results.rows[0].id,
                userQ: userRequest.userMsg,
              };
              let viewCount = results.rows[0].viewed;
              viewCount = viewCount + 1;
              pool.query(
                `UPDATE query_table SET viewed = ${viewCount} WHERE id = ${responseData.qid}`,
                (err, updates) => {
                  if (err) {
                    // console.log(err);
                  } else if (updates) {
                    // console.log(updates.rowCount);
                  }
                }
              );
              // console.log("row", botData);
              io.in(socket.id).emit("chat message", botData);
            }
          );
        }
        // res.send(body); //Display the response on the website
      }
    );
    // in close event we are sure that stream from child process is closed
    // python.on("close", (code) => {
    //   // send data to browser
    //   // res.send(dataToSend);
    //   console.log(dataToSend);
    //   io.in(socket.id).emit("chat message", "from bot " + dataToSend);
    // });

    // io.in(socket.id).emit("chat message", "from bot " + msg);
    // console.log("message: " + msg);
  });
  socket.on("disconnect", function () {
    // console.info("disconnected user (id=" + socket.id + ").");
    delete users[socket.id];
    // console.log(users);
    // console.log(socket.rooms);
  });
});
app.get("/allquestions", function (req, res) {
  // const id = parseInt(request.params.id);

  pool.query('SELECT * FROM "query_table"', (error, results) => {
    if (error) {
      res.status(200).json({ message: "Error. Please check connection!!" });
      // throw error;
    }

    res.status(200).json(results.rows);
  });
  // res.sendFile(__dirname + "/index.html");
});

http.listen(process.env.PORT || 3000, function () {
  console.log("listening on *:" + port);
});
//////////////////////////////////////////////////////////////

// heroku ps:scale web=1 other-web=1

// web: python main.py
// app: npm start
// web: gunicorn model:app
//
// webpy: python server.py
// webjs: node server.js
