import {Router} from "express";
import {registerUser, login, logoutUser} from "../controllers/auth.controllers.js"
import {validate} from "../middlewares/validator.middleware.js"
import {userRegisterValidator, userLoginValidator} from "../validators/index.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
const router = Router();
/*
    we collect all errors using userRegisterValidator() in array form, passed to validate middleware
    through req body
    which is processed and if everything is correct next flag is set -> registerUser function
    finally starts its task
*/
router.route("/register"). post(userRegisterValidator(), validate, registerUser);
router.route("/login"). post(userLoginValidator(), validate, login);

//secure routes
router.route("/logout"). post(verifyJWT, logoutUser);
export default router;