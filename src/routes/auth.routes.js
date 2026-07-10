import {Router} from "express";
import {registerUser, login, logoutUser, verifyEmail, refreshAccessToken, forgotPasswordRequest, resetForgotPassword, getCurrentUser, changeCurrentPassword, resendEmailVerification} from "../controllers/auth.controllers.js"
import {validate} from "../middlewares/validator.middleware.js"
import {userRegisterValidator, userLoginValidator, userForgotPasswordValidator, userChangeCurrentPasswordValidator} from "../validators/index.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import { verify } from "crypto";
const router = Router();
/*
    we collect all errors using userRegisterValidator() in array form, passed to validate middleware
    through req body
    which is processed and if everything is correct next flag is set -> registerUser function
    finally starts its task
*/

//unsecured routes -routes which can work directly
router.route("/register"). post(userRegisterValidator(), validate, registerUser);
router.route("/login"). post(userLoginValidator(), validate, login);
//colon ke badd wala variable name hota hai joki destructure hota hai
router.route("/verify-email/:verificationToken"). get(verifyEmail);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/forgot-password").post(userForgotPasswordValidator(), validate, forgotPasswordRequest)
router.route("/reset-password/:resetToken").post(userForgotPasswordValidator(), validate, resetForgotPassword);

//secure routes
router.route("/logout"). post(verifyJWT, logoutUser);
router.route("/current-user"). post(verifyJWT, getCurrentUser);
router.route("/change-password"). post(verifyJWT, userChangeCurrentPasswordValidator(), validate, changeCurrentPassword)
router.route("/resend-email-verification").post(verifyJWT, resendEmailVerification)

export default router;