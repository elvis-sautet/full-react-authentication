const express = require("express");
const router = express.Router();
const {
  registration,
  login,
  sendPasswordLinkRequest,
  passwordReset,
  token,
} = require("../controllers/authController");

router.post("/register", registration);
router.post("/login", login);
router.post("/emailresettoken", sendPasswordLinkRequest);
router.post("/resetpassword", passwordReset);
router.post("/refreshToken", token);

module.exports = router;
