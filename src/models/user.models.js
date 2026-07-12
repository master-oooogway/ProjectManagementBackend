/**
 * This file contains: db structure, password security, jwt authentication,
 * refresh token system
 * forgot password system
 * email verification system
 * 
 * in mongodb:
 * Each object is a document
 * collection of objects is called collection
 * Schema is a blueprint
 */


/**
 * needed later for mongoose.model(...)
 * new Schema(...)
 */
import mongoose, {Schema} from "mongoose";

/**
 * Hash password
 * Compare password
 * .hash(), .compare()
 */
import bcrypt from "bcrypt";

/**
 * Uses certain keys
 * .sign(), .verify()
 * Authentication
 */
import jwt from "jsonwebtoken";

/**
 * Built-in node package
 * for:
 * Random tokens
 * Hashing
 * Security utilities
 * randomBytes()
 * createHash()
 */
import crypto from "crypto";

/**
 * Schema Creation
 */
const userSchema = new Schema(
    {
        avatar: {
            type: {
                url: String,
                localPath: String,
            },
            default: {
                url: `https://placehold.co/200x200`,
                localPath: ""
            }
        },

        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            //mongodb creates lookup structure to search fast
            index: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        fullName: {
            type: String,
            trim: true
        },

        password: {
            type: String,
            required: [true, "Password is required"]
        },

        //used to prevent fake accounts
        isEmailVerified: {
            type: Boolean,
            //after clicking email verfication link turns true
            default: false
        },

        /**
         * Stores current refresh token
         * Because later user logout(timeout or manual)
         * used to generate accessToken
         * a type of token with some user data when decoded
         * tokens prove that the user is authenticated
         * it is generated using a secret key
         */
        refreshToken: {
            type: String
        },


        /**
         * user clicks 
         * we generate token and store the hashed version here
         * and unhashed version to url
         */
        forgotPasswordToken: {
            type: String
        },

        /**
         * we generate temp token with its expiry and store here
         */
        forgotPasswordExpiry: {
            type: Date
        },

        /**
         * We store hashed version of temp token here and unhashed to url
         */
        emailVerificationToken: {
            type: String
        },

        //store expiration above token
        emailVerificationExpiry: {
            type: Date
        },

        emailVerificationOTP: {
            type: String
        },

        emailVerificationOTPExpiry: {
            type: Date
        },

        emailVerificationOTPAttempts: {
            type: Number,
            default: 0
        },

        emailVerificationOTPLastSentAt: {
            type: Date
        }
    }, {
        /**
         * No need to write createdAt and updatedAt manually
         */
        timestamps: true
    }
)


/**
 * Pre save middleware
 * moongose middleware hook
 * runs before user.save() or user.create()
 * we are using function instead of arrow because of the use of 'this' keyword
 * 'this' represent the current obj
 * which this function:
 * already hashed password -> hash again
 * bcrypt.hash() is used to hash
 * 10 rounds of hashing (industry standard)
 */
userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});

/**
 * userSchema.methods = add method  to every user document
 * same concept to use 'this' => normal function
 * parameter = hashed password
 */
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password);
};

/**
 * Authentication core
 * creates JWT- header payload structure
 */
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        //payload- data inside token
        /**
         * later middleware can identify who is this user
         * without querying db everytime
         */
        {
            _id: this._id,
            email: this.email,
            username: this.username
        },
        //Secret- used to sign token (prevents hackers to create fake jwt)
        process.env.ACCESS_TOKEN_SECRET,
        //expiry time
        {expiresIn: process.env.ACCESS_TOKEN_EXPIRY}
    )
}


userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        //payload
        {
            _id: this._id
        },
        //Secret
        process.env.REFRESH_TOKEN_SECRET,
        //EXPIRY TIME
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        }
    )
}

/**
 * Advanced security
 * Purpose:
 * Email verification
 * forgot password
 */
userSchema.methods.generateTemporaryToken = function(){
    //20bytes = 160 bits
    //hex -> converts bin to hex
    //unhasedToken is sent to the user
    const unHashedToken = crypto.randomBytes(20).toString("hex")

    //hashed token is for email verfication token
    const hashedToken = crypto.createHash("sha256").update(unHashedToken).digest("hex")

    //for forgot password expiry
    const tokenExpiry = Date.now() + (20*60*1000) //20 mins

    //unHashed token for url to check after link is clicked
    return {unHashedToken, hashedToken, tokenExpiry}
};

userSchema.methods.generateEmailVerificationOTP = function(){
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex")
    const otpExpiry = Date.now() + (20 * 60 * 1000) //20 mins
    return {otp, hashedOtp, otpExpiry}
};

/**
 * now mongoose will create a model with name: User
 * Using it:
 * User. create(), .find(), .findById(), .findOne()
 */
export const User = mongoose.model("User", userSchema);
