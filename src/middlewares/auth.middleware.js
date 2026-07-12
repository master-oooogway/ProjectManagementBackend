import mongoose from "mongoose"
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
import { ProjectMember } from "../models/projectmember.models.js"
import mongoose from "mongoose";
import { assertObjectId } from "../utils/objectid.js";


//Custom error class
import { ApiError } from "../utils/api-error.js"
import { ApiResponse } from "../utils/api-response.js"

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
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

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
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken -forgotPasswordToken -forgotPasswordExpiry -emailVerificationToken -emailVerificationExpiry -emailVerificationOTP -emailVerificationOTPExpiry -emailVerificationOTPAttempts -emailVerificationOTPLastSentAt");
        if(!user){
            throw new ApiError(401, "Invalid access token");
        }
        req.user = user
        next()
    }catch(err){
        throw new ApiError(401, "Invalid access token")
        
    }
})


//authorization code
export const validateProjectPermission = (roles = []) => {
  return asyncHandler(async (req, res, next) => {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ApiError(400, "project id is missing");
    }

    // Prevent Mongoose ObjectId cast errors
    const projectObjectId = assertObjectId(projectId, "projectId");
    const userObjectId = assertObjectId(req.user?._id, "userId");

    const project = await ProjectMember.findOne({
      project: projectObjectId,
      user: userObjectId,
    });


    if (!project) {
      throw new ApiError(400, "project not found");
    }

    const givenRole = project?.role;

    req.projectRole = givenRole

    if (!roles.includes(givenRole)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action",
      );
    }

    next();
  });
};
