import {validationResult} from "express-validator";
import {ApiError} from "../utils/api-error.js"

//most of the middleware expects req , response and next

//next is a flag which make sure that our task is taken up
export const validate = (req, res, next) =>{
    //validationResult is a part of express-validator

    //when we pass req body into the validationResult method it gives a array of errors if any
    const errors = validationResult(req)

    if(errors.isEmpty()){
        //just move next task and do nothing here
        return next()
    }

    const extractedErrors = [];
    errors.array().map((err) => extractedErrors.push(
        {
            [err.path]: err.msg

        }
    ));
    throw new ApiError(422, "Received data is not valid")
}