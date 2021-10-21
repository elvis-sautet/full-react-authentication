const bcrypt = require("bcrypt");
const connection = require("../config/db_config");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cookie = require("cookie");
const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");

const token = async (req, res) => {
  try {
    const tokenWithCookie = req.headers.cookie;
    if (!tokenWithCookie) {
      return res.status(401).json({
        success: false,
        msg: "Please login to continue",
      });
    }
    const token = tokenWithCookie.split("=")[1];
    const decoded = await jwt.verify(token, process.env.SECRET_KEY);
    res.status(200).json({
      message: "Token verified",
      decoded: decoded?.email,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      msg: "Token verification failed,try again later.",
    });
  }
};

// TODO: add login logic
const registration = async (req, res) => {
  const { firstName, lastName, email, idNumber, password } = req.body;
  const db = await connection();
  try {
    const [emailsfound] = await db.query(
      "SELECT * from registration WHERE email=? ",
      [email]
    );
    if (emailsfound.length !== 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Email already taken!" });
    }
    const [idnumbersFound] = await db.query(
      "SELECT * from registration WHERE id_number=? ",
      [idNumber]
    );
    if (idnumbersFound.length !== 0) {
      return res
        .status(400)
        .json({ success: false, msg: "ID number already taken!" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO registration(first_name,last_name,email,id_number,password)  VALUES(?, ?,?,?,?)",
      [firstName, lastName, email, idNumber, hashedPassword]
    );
    res.status(200).json({ success: true, msg: "Registration Successful" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, msg: "Registration Failed,try again later." });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const db = await connection();

  try {
    const [fields] = await db.query(
      "SELECT * from registration WHERE email=? ",
      [email]
    );
    if (fields.length === 0) {
      return res.status(400).json({ msg: "User does not exist" });
    }
    const isMatch = await bcrypt.compare(password, fields[0].password);

    if (!isMatch) {
      return res.status(400).json({ msg: "Incorrect password" });
    }
    const token = jwt.sign({ email }, process.env.SECRET_KEY, {
      expiresIn: "4h",
    });

    res.setHeader(
      "Set-Cookie",
      cookie.serialize("wizzyTkn", token, {
        httpOnly: true,
        maxAge: 3600,
        path: "/",
        sameSite: "strict",
        secure: process.env.NODE_ENV !== "development",
      })
    );

    res.status(200).json({
      success: true,
      user: {
        email: fields[0].email,
        fullName: fields[0].first_name + " " + fields[0].last_name,
        idNumber: fields[0].id_number,
      },
      token: token,
      msg: "Login Successful",
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, msg: "Login Failed,try again later." });
  }
};

// send email reset
const sendPasswordLinkRequest = async (req, res) => {
  const { email } = req.body;

  const db = await connection();

  try {
    const [fields] = await db.query(
      "SELECT * from registration WHERE email=? ",
      [email]
    );
    console.log(email);
    if (fields.length === 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Check Email and try again" });
    }
    const tokenWithEmail = await jwt.sign({ email }, process.env.SECRET_KEY, {
      expiresIn: "10m",
    });
    const linkWithToken = `http://localhost:3000/reset/${tokenWithEmail}`;
    //   sending the email address to the user
    const transport = {
      host: "smtp.gmail.com",
      auth: {
        user: process.env.MAIL_EMAIL,
        pass: process.env.MAIL_PASSWORD,
      },
    };

    const transporter = nodemailer.createTransport(transport);

    transporter.verify((error, success) => {
      if (error) {
        console.log(error);
      } else {
        console.log(linkWithToken);
        console.log("Server is ready to take messages");
      }
    });
    ejs.renderFile(
      path.join(__dirname, "../views", "mailTemplate.ejs"),
      { name: fields[0].first_name, link: linkWithToken },
      function (err, data) {
        if (err) {
          ``;
          console.log(err);
        } else {
          var mainOptions = {
            from: process.env.MAIL_EMAIL,
            to: email,
            subject: "Password Reset Request",
            html: data,
          };
          //console.log("html data ======================>", mainOptions.html);

          transporter.sendMail(mainOptions, function (err, info) {
            if (err) {
              if (err.code === "EDNS") {
                return res.status(500).json({
                  success: false,
                  msg: "Failed ,Check your internet connection",
                  tokenWithEmail,
                });
              }
              res.status(400).json({
                success: false,
                msg: "Failed, try again later",
              });
            } else {
              res.json({
                success: true,
                token: tokenWithEmail,
                msg: "Reset Link Send, Check your Email",
              });
            }
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, msg: "Failed,try again later." });
  }
};

// const verifyPasswordResetToken = async (req, res, next) => {
//   const { token } = req.body;
// };

// restting the password now
const passwordReset = async (req, res) => {
  const { token, currentPassword, password } = req.body;
  const db = await connection();
  try {
    const user = jwt.verify(token, process.env.SECRET_KEY);
    if (!user)
      return res.status(401).json({
        success: false,
        msg: "Your Link has expired,Please try again",
      });

    const [values] = await db.query(
      "SELECT * FROM registration WHERE email=?",
      [user.email]
    );
    if (values.length === 0) {
      res.status(401).json({
        success: false,
        msg: "Not authorized, please try again",
      });
    }
    //   compare the current password with password hash from db
    const isMatch = await bcrypt.compare(currentPassword, values[0].password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        msg: "Incorrect credentials, please try again",
      });
    }
    const hashedNewPassword = await bcrypt.hash(password, 10);
    console.log(hashedNewPassword, user.email);
    await db.query("UPDATE registration SET password=? WHERE email = ?", [
      hashedNewPassword,
      user.email,
    ]);
    res.status(200).json({
      success: true,
      msg: "Password Reset Successfully",
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid Token",
    });
  }
};

module.exports = {
  registration,
  login,
  passwordReset,
  sendPasswordLinkRequest,
  token,
};
