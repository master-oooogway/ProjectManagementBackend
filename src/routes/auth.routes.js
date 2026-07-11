/**
 * Acts as a traffic controller of our backend 
 */



import {Router} from "express";
import {registerUser, login, logoutUser, verifyEmail, refreshAccessToken, forgotPasswordRequest, resetForgotPassword, getCurrentUser, changeCurrentPassword, resendEmailVerification} from "../controllers/auth.controllers.js"

/**
 * collect validation errors for validators
 * return error response
 * or 
 * call next() if no error
 */
import {validate} from "../middlewares/validator.middleware.js"

/**
 * These are the validation rules like email req?
 * pass length?
 * username exists?
 */
import {userRegisterValidator, userLoginValidator, userForgotPasswordValidator, userChangeCurrentPasswordValidator, userResetForgotPasswordValidator} from "../validators/index.js"

/**
 * JWT middleware
 * check user authentication
 * valid token? yes->next() no->401
 */
import {verifyJWT} from "../middlewares/auth.middleware.js"

//creates a fresh router instance
const router = Router();
/*
    we collect all errors using userRegisterValidator() in array form, passed to validate middleware
    through req body
    which is processed and if everything is correct next flag is set -> registerUser function
    finally starts its task
*/

//Route registration

//unsecured routes -routes which can work directly
router.route("/register"). post(userRegisterValidator(), validate, registerUser);

//cookie set at the end
router.route("/login"). post(userLoginValidator(), validate, login);

//colon ke badd wala variable name hota hai joki destructure hota hai(parameter in req.params)
//the token probably came from email link
//after this function account is verified
router.route("/verify-email/:verificationToken"). get(verifyEmail);

/**
 * Access token expired -> use refresh token -> generate new access token
 * Common jwt architecture
 */
router.route("/refresh-token").post(refreshAccessToken);

/**
 * user forgot pass
 * enter email
 * validator
 * controller
 * generate reset token
 * send email
 */
router.route("/forgot-password").post(userForgotPasswordValidator(), validate, forgotPasswordRequest)

/**
 * email link clicked 
 * token extracted
 * validate token
 * update password
 */
router.route("/reset-password/:resetToken").post(userResetForgotPasswordValidator(), validate, resetForgotPassword);

//secure routes - requires tokens

/**
 * Request
 * verifyJWT
 * Valid User?
 * logoutuser
 */
router.route("/logout"). post(verifyJWT, logoutUser);

/**
 * Token
 * verify jwt
 * user found?
 * getCurrentUser
 */
router.route("/current-user"). post(verifyJWT, getCurrentUser);

/**
 * Has four layers
 * request
 * verifyJWT- only logged in user should change password
 * validator- errors[]
 * validate - old? new? length?
 * controller
 */
router.route("/change-password"). post(verifyJWT, userChangeCurrentPasswordValidator(), validate, changeCurrentPassword)

/**
 * logged in user
 * req new verification email
 * token generated
 * email sent again
 */
router.route("/resend-email-verification").post(verifyJWT, resendEmailVerification)

export default router;