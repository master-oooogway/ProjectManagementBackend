/**
 * Only authenticated user can access protected routes
 * 
 * request -> verifyJWT -> find user -> req.user = user -> next() -> controller
 */


/**
 * Query db
 * after token verification
 * because token only proves: This token was signed correctly but does not prove User still exists
 */
import {User} from "../models/user.models.js"

//Custom error class
import { ApiError } from "../utils/api-error.js"

//to decrease the use of try-catch everywhere
import {asyncHandler} from "../utils/async-handler.js"

//for jwt.verify()
/**
 * During login: jwt.sign()->token created
 * Now: jwt.verify()->checks token 
 */
import jwt from "jsonwebtoken"

/**
 * req = incoming request -> headers, cookies, body, params
 * res = response object
 * next = move to next middleware or controller
 */
export const verifyJWT = asyncHandler(async(req, res, next)=>{

    /**
     * ? -> because if req.cookies does not exists it can crash...use of ? returns undefined
     * Browser: Cookies, Postman: Authorization Header, Mobile Apps: Authorization Header
     */
    const token = req.cookies?.accessToken || req.header("Authorization")?. replace("Bearer ","")

    //debug logs
    //removed while on production
    console.log("Cookies:", req.cookies);
    console.log("Auth Header:", req.header("Authorization"));


    if(!token){
        /**user not logged in or token expired or frontend forgot to send cookie */
        throw new ApiError(401, "Unauthorized request");
    }
    try{
        //for token verification
        /**
         * verify(): was token signed with correct secret?...Has token expired?...Did anyone modify payload?
         */
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        //to prove user still exists
        /**
         * negative selection is used to prevent forwarding sensitive data
         */
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry");
        if(!user){
            throw new ApiError(401, "Invalid access token");
        }
        req.user = user
        next()
    }catch(err){
        throw new ApiError(401, "Invalid access token")
        
    }
})