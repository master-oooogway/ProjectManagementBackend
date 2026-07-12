import { body } from "express-validator";
import { AvailableUserRole } from "../utils/constants.js";
const userRegisterValidator = () => {


    //pass error in array form so that it can be processed by middleware error collector
    return [

        //body belongs to express-validator used to validate a body's(user's) field
        body("email")
            .trim()

            .notEmpty()
                .withMessage("Email is required")
            
            .isEmail()
                .withMessage("Email is invalid"),
        
        
        body("username")
            .trim()
            
            .notEmpty()
                .withMessage("Username is required")

            .isLength({min: 3, max: 30})
                .withMessage("Username must be between 3 and 30 characters")
            .matches(/^[a-zA-Z0-9_]+$/)
                .withMessage("Username can use letters, numbers, and underscores only"),

        body("password")
            .trim()

            .isLength({min: 8, max: 72})
                .withMessage("Password must be between 8 and 72 characters")
            .matches(/[A-Za-z]/)
                .withMessage("Password must include a letter")
            .matches(/\d/)
                .withMessage("Password must include a number"),
        
        body("fullname")
            .optional()

            .trim()
    ]   

}


const userLoginValidator = () => {
    return [
        body("email")
            .notEmpty()
                .withMessage("Email is required")
            .isEmail()
                .withMessage("Email is invalid"),
        body("password")
            .notEmpty()
                .withMessage("Password is required")
    ]
}

const userLoginOtpValidator = () => {
    return [
        body("email")
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("otp")
            .notEmpty()
            .withMessage("OTP is required")
            .isLength({ min: 6, max: 6 })
            .withMessage("OTP must be 6 digits")
            .isNumeric()
            .withMessage("OTP must contain digits only")
    ];
}

const userChangeCurrentPasswordValidator = () => {
    return [
        body("oldPassword")
            .notEmpty().withMessage("Old password is required"),
        
        body("newPassword")
            .isLength({min: 8, max: 72})
            .withMessage("Password must be between 8 and 72 characters")
            .matches(/[A-Za-z]/)
            .withMessage("Password must include a letter")
            .matches(/\d/)
            .withMessage("Password must include a number")
    ]
}

const userForgotPasswordValidator = () => {
    return [
        body("email")
            .notEmpty(). withMessage("Email is required")
            .isEmail(). withMessage("Email is invalid")
    ]
}

const userResetForgotPasswordValidator = () => {
    return [
        body("newPassword")
            .isLength({min: 8, max: 72})
            .withMessage("Password must be between 8 and 72 characters")
            .matches(/[A-Za-z]/)
            .withMessage("Password must include a letter")
            .matches(/\d/)
            .withMessage("Password must include a number")
    ]
}

const createProjectValidator = () => {
    return [
        body("name")
            .notEmpty().withMessage("Name is required"),
        body("description").optional()
    ]
}

const addMembertoProjectValidator = () => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid"),
    body("role")
      .notEmpty()
      .withMessage("Role is required")
      .isIn(AvailableUserRole)
      .withMessage("Role is invalid"),
  ];
};

export{
    userRegisterValidator,
    userLoginValidator,
    userLoginOtpValidator,
    userChangeCurrentPasswordValidator,
    userForgotPasswordValidator,
    userResetForgotPasswordValidator,
    createProjectValidator,
    addMembertoProjectValidator
}
