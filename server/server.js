const express = require("express");
const app = express();
const initiateDatabase = require("./config/db_config");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const authRoute = require("./routes/auth");
const dotenv = require("dotenv").config({
  path: "./.env",
});

(async () => {
  await initiateDatabase();
})();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("mailTemplate");
});

app.use("/api/auth", authRoute);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Listening on port ${port}`));
