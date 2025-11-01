import express from "express";
import { google } from "googleapis";
import { oauth2Client, getAuthUrl } from "../config/google-drive.js";
import User from "../models/user.js";
import authMiddleware from "../middleware/auth-middleware.js";

const router = express.Router();

// Initiate Google OAuth
router.get("/google/connect", authMiddleware, async (req, res) => {
  try {
    const authUrl = getAuthUrl(req.user._id.toString());
    res.json({ authUrl });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res
      .status(500)
      .json({ message: "Failed to initiate Google authentication" });
  }
});

// Handle OAuth callback
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard?drive_error=no_code`
      );
    }

    const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    await User.findByIdAndUpdate(userId, {
      googleDrive: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date),
        isConnected: true,
        email: userInfo.email,
      },
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?drive_connected=true`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?drive_error=true`);
  }
});

// Check connection status
router.get("/google/status", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("googleDrive");

    res.json({
      isConnected: user.googleDrive?.isConnected || false,
      email: user.googleDrive?.email || null,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to check connection status" });
  }
});

// Disconnect Google Drive
router.post("/google/disconnect", authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { googleDrive: 1 },
    });

    res.json({ message: "Google Drive disconnected successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to disconnect Google Drive" });
  }
});

export default router;
