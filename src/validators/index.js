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

            .isLowercase()
                .withMessage("Username is required")

            .isLength({min: 3})
                .withMessage("Username must be at least 3 characters long"),

        body("password")
            .trim()

            .notEmpty()
                .withMessage("Password is required"),
        
        body("fullname")
            .optional()

            .trim()
    ]   

}


const userLoginValidator = () => {
    return [
        body("email")
            .optional()
            .isEmail()
                .withMessage("Email is invalid"),
        body("password")
            .notEmpty()
                .withMessage("Password is requried")
    ]
}

const userChangeCurrentPasswordValidator = () => {
    return [
        body("oldPassword")
            .notEmpty().withMessage("Old password is required"),
        
        body("newPassword")
            .notEmpty().withMessage("New password cannot be empty")
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
            .notEmpty(). withMessage("Password is required")
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
    userRegisterValidator, userLoginValidator, userChangeCurrentPasswordValidator, userForgotPasswordValidator,userResetForgotPasswordValidator
    ,createProjectValidator, addMembertoProjectValidator
}