import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  sendEmail,
} from "../utils/mail.js";

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const privateUserFields =
  "-password -refreshToken -forgotPasswordToken -forgotPasswordExpiry -emailVerificationToken -emailVerificationExpiry -emailVerificationOTP -emailVerificationOTPExpiry -emailVerificationOTPAttempts -emailVerificationOTPLastSentAt";

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const isProduction = () => process.env.NODE_ENV === "production";
const assertAllowedEmailDomain = (email) => {
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
  if (!allowedDomain) return;
  const emailDomain = email.split("@")[1];
  if (emailDomain !== allowedDomain) {
    throw new ApiError(400, `Use your @${allowedDomain} email address to create an account.`);
  }
};
const cookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: process.env.COOKIE_SAME_SITE || (isProduction() ? "none" : "lax"),
  path: "/api/v1/auth",
});

const publicUser = (userId) => User.findById(userId).select(privateUserFields);

const createSession = async (user) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

const sendVerificationOtp = async (user, { ignoreCooldown = false } = {}) => {
  if (
    !ignoreCooldown &&
    user.emailVerificationOTPLastSentAt &&
    Date.now() - user.emailVerificationOTPLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    throw new ApiError(429, "Please wait one minute before requesting another code.");
  }

  const { otp, hashedOtp, otpExpiry } = user.generateEmailVerificationOTP();
  user.emailVerificationOTP = hashedOtp;
  user.emailVerificationOTPExpiry = otpExpiry;
  user.emailVerificationOTPAttempts = 0;
  user.emailVerificationOTPLastSentAt = new Date();
  await user.save({ validateBeforeSave: false });

  let emailWasDelivered = true;
  try {
    await sendEmail({
      email: user.email,
      subject: "Your ProjectCamp verification code",
      mailgenContent: emailVerificationMailgenContent(user.username, otp),
    });
  } catch (error) {
    user.emailVerificationOTPLastSentAt = undefined;
    await user.save({ validateBeforeSave: false });
    if (isProduction()) throw error;
    emailWasDelivered = false;
    console.warn("Email delivery failed; using the local development OTP fallback.", error.message);
  }

  // Never expose the code in a deployed application. This opt-in is useful only
  // when developing locally without an SMTP provider.
  return !isProduction() && (process.env.SHOW_EMAIL_OTP === "true" || !emailWasDelivered)
    ? otp
    : undefined;
};

const registerUser = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const username = req.body.username.trim().toLowerCase();
  const { password } = req.body;
  assertAllowedEmailDomain(email);

  const [emailOwner, usernameOwner] = await Promise.all([
    User.findOne({ email }),
    User.findOne({ username }),
  ]);

  if (usernameOwner && usernameOwner.email !== email) {
    throw new ApiError(409, "That username is already in use.");
  }
  if (emailOwner?.isEmailVerified) {
    throw new ApiError(409, "An account with that email already exists. Sign in instead.");
  }

  // An unfinished registration is safely restartable. This prevents an SMTP
  // outage or a closed browser tab from permanently blocking the email address.
  if (emailOwner) {
    emailOwner.username = username;
    emailOwner.password = password;
    const developmentOtp = await sendVerificationOtp(emailOwner, { ignoreCooldown: true });
    const data = { user: await publicUser(emailOwner._id), registrationPending: true };
    if (developmentOtp) data.developmentOtp = developmentOtp;
    return res.status(200).json(
      new ApiResponse(200, data, "Your registration was restarted. Enter the new verification code.")
    );
  }

  let user;
  try {
    user = await User.create({ email, username, password, isEmailVerified: false });
    const developmentOtp = await sendVerificationOtp(user, { ignoreCooldown: true });

    const data = { user: await publicUser(user._id) };
    if (developmentOtp) data.developmentOtp = developmentOtp;
    return res.status(201).json(
      new ApiResponse(201, data, "Account created. Check your email for the verification code.")
    );
  } catch (error) {
    // In production an email failure must not leave a dead account behind.
    if (user && isProduction()) {
      await User.deleteOne({ _id: user._id, isEmailVerified: false });
    }
    throw error;
  }
});

const verifyEmailOtp = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const otp = req.body.otp.trim();
  const user = await User.findOne({ email });

  if (!user || user.isEmailVerified) {
    throw new ApiError(400, "This verification code is invalid or has expired.");
  }
  if ((user.emailVerificationOTPAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new verification code.");
  }
  if (!user.emailVerificationOTPExpiry || user.emailVerificationOTPExpiry <= new Date()) {
    throw new ApiError(400, "This verification code is invalid or has expired.");
  }
  if (user.emailVerificationOTP !== hash(otp)) {
    user.emailVerificationOTPAttempts = (user.emailVerificationOTPAttempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "This verification code is invalid or has expired.");
  }

  user.isEmailVerified = true;
  user.emailVerificationOTP = undefined;
  user.emailVerificationOTPExpiry = undefined;
  user.emailVerificationOTPAttempts = 0;
  user.emailVerificationOTPLastSentAt = undefined;
  await user.save({ validateBeforeSave: false });
  return res.status(200).json(new ApiResponse(200, {}, "Email verified. You can now sign in."));
});

const resendEmailVerification = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email });

  // This response deliberately does not reveal whether an account exists.
  if (!user || user.isEmailVerified) {
    return res.status(200).json(new ApiResponse(200, {}, "If that account needs verification, a code has been sent."));
  }
  const developmentOtp = await sendVerificationOtp(user);
  const data = developmentOtp ? { developmentOtp } : {};
  return res.status(200).json(new ApiResponse(200, data, "If that account needs verification, a code has been sent."));
});

const login = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const { password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Invalid email or password.");
  }
  if (!user.isEmailVerified) {
    throw new ApiError(403, "Verify your email before signing in.");
  }

  const { accessToken, refreshToken } = await createSession(user);
  return res
    .status(200)
    .cookie("refreshToken", refreshToken, cookieOptions())
    .json(new ApiResponse(200, { user: await publicUser(user._id), accessToken }, "Signed in successfully."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "Authentication required.");

  try {
    const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded._id);
    if (!user || user.refreshToken !== incomingRefreshToken) throw new Error("Invalid refresh token");

    const { accessToken, refreshToken } = await createSession(user);
    return res
      .status(200)
      .cookie("refreshToken", refreshToken, cookieOptions())
      .json(new ApiResponse(200, { accessToken }, "Session refreshed."));
  } catch {
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
  return res
    .status(200)
    .clearCookie("refreshToken", cookieOptions())
    .json(new ApiResponse(200, {}, "Signed out successfully."));
});

const getCurrentUser = asyncHandler(async (req, res) =>
  res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully."))
);

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const user = await User.findOne({ email });
  if (user) {
    const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();
    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false });
    await sendEmail({
      email: user.email,
      subject: "Reset your ProjectCamp password",
      mailgenContent: forgotPasswordMailgenContent(
        user.username,
        `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`
      ),
    });
  }
  return res.status(200).json(new ApiResponse(200, {}, "If an account exists, a password reset link has been sent."));
});

const resetForgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    forgotPasswordToken: hash(req.params.resetToken),
    forgotPasswordExpiry: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, "This password reset link is invalid or has expired.");

  user.password = req.body.newPassword;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  user.refreshToken = undefined;
  await user.save();
  return res.status(200).json(new ApiResponse(200, {}, "Password reset successfully."));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!(await user.isPasswordCorrect(req.body.oldPassword))) {
    throw new ApiError(400, "Current password is incorrect.");
  }
  user.password = req.body.newPassword;
  await user.save();
  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully."));
});

export {
  registerUser,
  verifyEmailOtp,
  resendEmailVerification,
  login,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  forgotPasswordRequest,
  resetForgotPassword,
  changeCurrentPassword,
};
