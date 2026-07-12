import { Router } from "express";
import {
  changeCurrentPassword,
  forgotPasswordRequest,
  getCurrentUser,
  login,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resendEmailVerification,
  resetForgotPassword,
  verifyEmailOtp,
} from "../controllers/auth.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
  userChangeCurrentPasswordValidator,
  userForgotPasswordValidator,
  userLoginValidator,
  userRegisterValidator,
  userResetForgotPasswordValidator,
  userLoginOtpValidator,
} from "../validators/index.js";

const router = Router();

router.post("/register", userRegisterValidator(), validate, registerUser);
router.post("/verify-email-otp", userLoginOtpValidator(), validate, verifyEmailOtp);
router.post("/resend-email-verification", userForgotPasswordValidator(), validate, resendEmailVerification);
router.post("/login", userLoginValidator(), validate, login);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", userForgotPasswordValidator(), validate, forgotPasswordRequest);
router.post("/reset-password/:resetToken", userResetForgotPasswordValidator(), validate, resetForgotPassword);
router.post("/logout", verifyJWT, logoutUser);
router.get("/current-user", verifyJWT, getCurrentUser);
router.post("/change-password", verifyJWT, userChangeCurrentPasswordValidator(), validate, changeCurrentPassword);

export default router;
