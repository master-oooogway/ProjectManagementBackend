import {ApiResponse} from "../utils/api-response.js";

/*
const healthCheck = (req, res, next) => {
    try {
        res
            .status(200)
            .json(new ApiResponse(200, {message: "Server is running"}));
    } catch (error) {
        next(error);
    }
}
    */

import { asyncHandler } from "../utils/async-handler.js";

const healthCheck = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, {message: "Server is running"}));
})

export {healthCheck};