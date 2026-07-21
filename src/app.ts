import express from "express";
import cors from "cors";
import helmet from "./lib/helmet.js";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";

const corsOptions = {
  origin: ["http://localhost:3000", "https://eye-center-web.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // for cookies
};

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", routes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
