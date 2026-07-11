/**
 * without custom classes:
 * no status code, no error details, no api-specific information
 * 
 * but in backend we usually want:{"success": false, "message": "Invalid password", "statusCode": 401}
 */


class ApiError extends Error{
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ){
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.message = message;
        this.success = false;
        this.errors = errors;

        if(stack){
            this.stack = stack;
        }else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export {ApiError};