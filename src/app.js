/** 
 * Heart of Express application
*/

/* 
 * Express is a framework built on top of node.js
 * It provides app.get(), put, post, delete, use
 * use- middleware
 * req - request object which contains body, params, query, headers, cookies, user
 * res - response object used for res.join(), send(), status()
*/
import express from "express";

/* 
 * Cross origin resource sharing
 * Helps connect frontend and backend with different origin (different port)
*/
import cors from "cors";

/*
 * suppose cookie: accessToken = abc123
* without cookie-parser: req.cookies is undefined
* with : req.cookies.accessToken works
* Very important for JWT authentication.
*/
import cookieParser from "cookie-parser";
import { ApiError } from "./utils/api-error.js";

/*
 * For creating express app
 * app represents "Entire Backend Application"
 * Inside app: routes, middlewares, request handlers, configurations
*/
const app = express();
app.set("trust proxy", 1);

//basic configurations
/** 
 * These are the middlewares
 * If this is not used:
 * Suppose there is json body, without below line 
 * req.body is undefined
 * but with express.json(), req.body.email works
 * 16kb is the maximum JSON payload size (flow control)
*/
app.use(express.json({limit: "16kb"}));

/** 
 * urlendcoded is used for html <form> submissions
 * suppose there is some form data, it converts the raw form data into req.body
 * extended = true: suppose user[name] = Ketan becomes {user:{name:"Ketan"}}
*/
app.use(express.urlencoded({extended: true, limit: "16kb"}));

/** 
 * .static() method defines the files that won't change
*/
app.use(express.static("public"));

/** 
 * Incoming request has cookie: accessToken, refreshToken
 * It converts req.cookies into js objects {at:..., rt:...}
*/
app.use(cookieParser())

//cors configurations
/** 
 * without first line: if env missing no crash
*/
app.use(cors({
    origin(origin, callback) {
      const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new ApiError(403, "Origin is not allowed by CORS"));
    },
    
    //allows: cookies, authorization headers, session data
    credentials: true,

    //allowed http methods
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    //Bearer etc.
    allowedHeaders: ["Content-Type", "Authorization"]
})); 
console.log(process.env.CORS_ORIGIN);


//import the routes

//health check route- checks whether the backend is alive
import healthCheckRouter from "./routes/healthcheck.routes.js";
import authRouter from "./routes/auth.routes.js";
import projectRouter from "./routes/project.routes.js"
import taskRouter from "./routes/task.routes.js"
import noteRouter from "./routes/note.routes.js";
//route registration


app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);

/** 
 * GET: Used to fetch data
 */
app.get("/", (req, res) => res.json({ success: true, message: "ProjectCamp API is running" }));

app.use((req, res, next) => {
  next(new ApiError(404, "Resource not found"));
});

app.use((err, req, res, next) => {
  if (!(err instanceof ApiError)) {
    err = new ApiError(err.statusCode || 500, err.message || "Internal server error");
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    statusCode: err.statusCode,
    errors: err.errors || [],
  });
});

export default app;
