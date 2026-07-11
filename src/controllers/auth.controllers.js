import {User} from "../models/user.models.js"
import {ApiResponse} from "../utils/api-response.js"
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {emailVerificationMailgenContent, forgotPasswordMailgenContent, sendEmail} from "../utils/mail.js"
import { signedCookie } from "cookie-parser";
import jwt, { decode } from "jsonwebtoken";

/**
 * Not imported
 */
const generateAccessAndRefreshToken = async (userId)=>{
    try{
        const user = await User.findById(userId);

        //short lived authentication token 15min, 30min, 1hr
        const accessToken = user.generateAccessToken();

        //long lived token
        /**
         * access token expired -> user logged out
         * bad experience!
         * refresh token generates new access token without asking user to login again
         * stored in db
         * 
         */
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;

        //no need to validate everything
        await user.save({validateBeforeSave: false})
        return {accessToken, refreshToken}
    }catch(err){
        throw new ApiError(500, "Something went wrong while generating access token");
    }   
}


/**
 * Registration pipeline
 * validate request -> check existing user -> create user -> generate email token -> save token -> send email -> return user
 */
const registerUser = asyncHandler(async (req, res) => {

    //destructuring some fields
    const {email, username, password}= req.body
    const existedUser = await User.findOne({
        //mongoDB operator-> means username matches or email matches
        $or: [{username}, {email}]
    })
    if(existedUser)
    {
        throw new ApiError(409, "User with email or username already exists", [])
    }

    /**
     * create user-> pre("save")-> password hash-> db
     */
    const user = await User.create({
        email,
        password,
        username,
        isEmailVerified: false
    })

    /**
     * unHashed -> sent to user
     * hasesh-> stored in database
     * 
     * When user clicks email:
     * Incoming token-> hash again-> compare
     */
    const {unHashedToken, hashedToken, tokenExpiry}= user.generateTemporaryToken();
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;
    await user.save({validateBeforeSave: false})

    /**
     * To deliver verification link
     */
    await sendEmail(
        {
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(

                //dynamic url generation used
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`
            )
        }
    )

    // exclude some sensitive field before sending response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
    )
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering a user")
    }

    return res
        .status(201)
        .json(
            new ApiResponse(200,
                {user: createdUser}, 
                "User registered successfully and verification email has been sent on your email"
            )
        )
})


/**
 * email, password-> find user-> compare password-> generate tokens-> store refresh token-> cookies-> response
 */
const login = asyncHandler(async (req, res) => {

    const {email, password, username} = req.body

    if(!email){
        throw new ApiError(400, "Email is required")
    }

    //check if user is registered or not
    const user = await User.findOne({email});
    if(!user){
        throw new ApiError(400, "User does not exists");
    }
    
    //password in db is equal to password passed here?
    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(400, "Invalid credentials");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)


    //removing sensitive information before sending response
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry")

    //SEND TOKENS AS COOKIES
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken, 
                    refreshToken
                },
                "User logged in successfully"
            )
        )
});

/**
 * Logged in user-> delete refresh token -> clear cookies -> done
 */
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: ""
            }
        },
        {
            new: true,
        },
    )
    const options = { 
        httpOnly: true,
        secure: true
    }
    return res 
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out")
        )
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user,
                "Current user fetched successfully"
            )
        )
})

/**
 * verfication link->extract token -> hash token -> find user -> mark verified
 */
const verifyEmail = asyncHandler(async (req, res) => {

    //this is the only new line...req.params = unhashed token
    const {verificationToken} = req. params
    if(!verificationToken){
        throw new ApiError(400, "Email verification token is missing")
    }

    let hashedToken = crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex")

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpiry: {$gt: Date.now()}
    })

    if(!user){
        throw new ApiError(400, "Token is invalid or expired");
    }

    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;

    user.isEmailVerified = true;
    await user.save({validateBeforeSave: false})


    return res
        .status(200)
        .json(
            new ApiResponse(
                200, {
                    isEmailVerified: true
                }
                ,
                "Email is verified"
            )
        )
})


/**
 * logged in user-> generate token-> save token-> send email again
 */
const resendEmailVerification = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id);

    if(!user){
        throw new ApiError(404, "User does not exists")

    }

    const {unHashedToken, hashedToken, tokenExpiry}= user.generateTemporaryToken();
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;
    await user.save({validateBeforeSave: false})

    await sendEmail(
        {
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`
            )
        }
    )

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Mail has been sent to your email Id"
            )
        )
});


/**
 * refresh token-> verify jwt-> find user-> compare db token-> generate new tokens-> return new tokens
 */
const refreshAccessToken = asyncHandler(async( req, res ) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized Access")
    }
    try{
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401, "Invalid refresh token");
        }
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired");
        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id)
        
        user.refreshToken = newRefreshToken;
        await user.save()

        return res
            .status(200)
            .cookie("accessToken", accessToken)
            .cookie("refreshToken", newRefreshToken)
            .json(
                new ApiResponse(
                    200,
                    {accessToken, refreshToken: newRefreshToken},
                    "Access token refreshed"
                )
            )
    }
    catch(err){
        throw new ApiError(401, "Invalid refresh token")
    }
})


/**
 * enter email -> find user-> generate temporary token-> store hash -> send email
 */
const forgotPasswordRequest = asyncHandler(async (req, res) => {
    const {email} = req.body;
    const user = await User.findOne({email})
    if(!user){
        throw new ApiError(404, "User does not exists", [])
    }
    const {unHashedToken, hashedToken, tokenExpiry} = user.generateTemporaryToken()

    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = tokenExpiry;

    await user.save({validateBeforeSave: false})

    await sendEmail({
        email: user?.email,
        subject: "Password reset request",
        mailgenContent: forgotPasswordMailgenContent(
            user.username,
            `${process.env.FORGOT_PASSWORD_URL}/${unHashedToken}`,
        )
    })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password reset mail has been sent to your mail id"
            )
        )
})


/**
 * user clicks email -> hash incoming token -> find user -> update password -> pre("save")
 * bcrypt.hash()
 */
const resetForgotPassword = asyncHandler(async (req, res) => {
    const {resetToken} = req.params;
    const {newPassword} = req.body;

    let hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex")

        const user = await User.findOne({
            forgotPasswordToken: hashedToken,
            forgotPasswordExpiry: {$gt: Date.now()}
        })

        if(!user){
            throw new ApiError(400, "The token is invalid or expired")
        }
        user.forgotPasswordExpiry=undefined;
        user.forgotPasswordToken=undefined;

        user.password = newPassword
        //pre("save") will hash the password
        await user.save({validateBeforeSave: false})

        return res 
            .status(200)
            .json(
                new ApiResponse(
                    200, 
                    {

                    },
                    "Password reset successfully"
                )
            )
})

/**
 * authenticated user -> check old password -> set new password -> pre("save")-> hash password -> save
 * 
 */
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordValid){
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
        .status(200)
        .json(
            new ApiResponse(
                200, {

                },
                "Password changed successfully"
            )
        )
})

export {registerUser,
     login,
      logoutUser,
       getCurrentUser,
        verifyEmail,
         resendEmailVerification
         , refreshAccessToken,
            forgotPasswordRequest,resetForgotPassword,changeCurrentPassword
};