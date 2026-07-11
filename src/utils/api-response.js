/**
 * Custom success response
 * we make object of this class and return json format of it as res's body
 */

class ApiResponse{
    constructor(statusCode, data, message="Success"){
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode< 400;
    }
}
export {ApiResponse};