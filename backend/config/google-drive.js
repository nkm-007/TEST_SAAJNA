import { google } from "googleapis";

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const getAuthUrl = (userId) => {
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: state,
  });
};

export const getDriveInstance = (accessToken, refreshToken) => {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
};

export const refreshTokenIfNeeded = async (user, User) => {
  const now = new Date();

  if (!user.googleDrive?.tokenExpiry || user.googleDrive.tokenExpiry < now) {
    oauth2Client.setCredentials({
      refresh_token: user.googleDrive.refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    await User.findByIdAndUpdate(user._id, {
      "googleDrive.accessToken": credentials.access_token,
      "googleDrive.tokenExpiry": new Date(credentials.expiry_date),
    });

    return credentials.access_token;
  }

  return user.googleDrive.accessToken;
};
