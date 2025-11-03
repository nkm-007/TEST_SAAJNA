import {
  getDriveInstance,
  refreshTokenIfNeeded,
} from "../config/google-drive.js";
import User from "../models/user.js";
import Task from "../models/task.js";
import Project from "../models/project.js";
import { Readable } from "stream";
import { recordActivity } from "../libs/index.js";

// Helper: Create or get CLS folder
const getOrCreateCLSFolder = async (drive) => {
  try {
    const response = await drive.files.list({
      q: "name='CLS' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    const folderMetadata = {
      name: "CLS",
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    return folder.data.id;
  } catch (error) {
    console.error("Error creating CLS folder:", error);
    throw error;
  }
};

// Helper: Create or get Task folder inside CLS
const getOrCreateTaskFolder = async (drive, clsFolderId, taskId) => {
  try {
    const folderName = `Task-${taskId}`;

    const response = await drive.files.list({
      q: `name='${folderName}' and '${clsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [clsFolderId],
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    return folder.data.id;
  } catch (error) {
    console.error("Error creating task folder:", error);
    throw error;
  }
};

// Upload file to Google Drive
export const uploadFileToDrive = async (req, res) => {
  try {
    const { taskId } = req.params;
    const file = req.file;

    console.log("📤 Upload attempt:", { taskId, fileName: file?.originalname }); // ✅ ADD

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const user = await User.findById(req.user._id);
    console.log("👤 User found:", {
      userId: user._id,
      hasGoogleDrive: !!user.googleDrive,
    }); // ✅ ADD

    if (!user.googleDrive?.isConnected) {
      console.log("❌ Drive not connected"); // ✅ ADD
      return res.status(403).json({
        message: "Google Drive not connected",
        requiresAuth: true,
      });
    }

    console.log("✅ Drive connected, checking tokens..."); // ✅ ADD

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check permissions
    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isMember = project.members.some(
      (member) => member.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: "Not authorized" });
    }

    console.log("🔑 Refreshing access token..."); // ✅ ADD
    const accessToken = await refreshTokenIfNeeded(user, User);
    console.log("✅ Access token refreshed"); // ✅ ADD

    const drive = getDriveInstance(accessToken, user.googleDrive.refreshToken);

    console.log("📁 Creating folder structure..."); // ✅ ADD
    // Create folder structure: CLS/Task-{id}/
    const clsFolderId = await getOrCreateCLSFolder(drive);
    const taskFolderId = await getOrCreateTaskFolder(
      drive,
      clsFolderId,
      taskId
    );
    console.log("✅ Folders created:", { clsFolderId, taskFolderId }); // ✅ ADD

    console.log("📤 Uploading file to Drive..."); // ✅ ADD
    // Upload file
    const fileMetadata = {
      name: file.originalname,
      parents: [taskFolderId],
    };

    const media = {
      mimeType: file.mimetype,
      body: Readable.from(file.buffer),
    };

    const driveFile = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, name, mimeType, size",
    });
    console.log("✅ File uploaded to Drive:", driveFile.data.id); // ✅ ADD

    // Make file viewable by anyone with link
    await drive.permissions.create({
      fileId: driveFile.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
    console.log("✅ Permissions set"); // ✅ ADD

    // Get shareable links
    const fileDetails = await drive.files.get({
      fileId: driveFile.data.id,
      fields: "webViewLink, webContentLink",
    });

    // Save to database
    const attachment = {
      fileName: driveFile.data.name,
      driveFileId: driveFile.data.id,
      driveViewLink: fileDetails.data.webViewLink,
      driveDownloadLink: fileDetails.data.webContentLink,
      fileType: driveFile.data.mimeType,
      fileSize: parseInt(driveFile.data.size || "0"),
      uploadedBy: req.user._id,
      taskId: taskId,
      uploadedAt: new Date(),
    };

    task.attachments.push(attachment);
    await task.save();
    console.log("✅ File saved to database"); // ✅ ADD

    // Record activity
    await recordActivity(req.user._id, "added_attachment", "Task", taskId, {
      description: `uploaded file ${driveFile.data.name}`,
    });

    console.log("✅✅✅ Upload complete!"); // ✅ ADD

    res.json({
      success: true,
      message: "File uploaded to Google Drive successfully",
      file: attachment,
    });
  } catch (error) {
    console.error("❌ Drive upload error:", error); // ✅ IMPROVED
    console.error("❌ Error stack:", error.stack); // ✅ ADD
    res.status(500).json({
      message: "Failed to upload file",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete file from Google Drive
export const deleteFileFromDrive = async (req, res) => {
  try {
    const { taskId, fileKey } = req.params;
    const userId = req.user._id;

    const decodedFileKey = decodeURIComponent(fileKey);

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check permissions
    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const userMember = project.members.find(
      (member) => member.user.toString() === userId.toString()
    );

    if (!userMember) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (userMember.role === "viewer") {
      return res.status(403).json({ message: "Clients cannot delete files" });
    }

    // Find attachment
    const attachmentIndex = task.attachments.findIndex(
      (att) =>
        att.driveFileId === decodedFileKey ||
        att._id.toString() === decodedFileKey
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({ message: "File not found" });
    }

    const attachment = task.attachments[attachmentIndex];

    // Get uploader's Drive credentials
    const uploader = await User.findById(attachment.uploadedBy);

    if (uploader && uploader.googleDrive?.isConnected) {
      try {
        const accessToken = await refreshTokenIfNeeded(uploader, User);
        const drive = getDriveInstance(
          accessToken,
          uploader.googleDrive.refreshToken
        );

        await drive.files.delete({
          fileId: attachment.driveFileId,
        });
      } catch (driveError) {
        console.error("Drive deletion failed:", driveError);
      }
    }

    // Remove from database
    const deletedAttachment = task.attachments[attachmentIndex];
    task.attachments.splice(attachmentIndex, 1);
    await task.save();

    // Record activity
    await recordActivity(userId, "removed_attachment", "Task", taskId, {
      description: `removed file ${deletedAttachment.fileName}`,
    });

    res.json({
      success: true,
      message: "File deleted successfully",
      deletedFile: {
        fileName: deletedAttachment.fileName,
        fileSize: deletedAttachment.fileSize,
      },
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      message: "Failed to delete file",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// List files for a task
export const listTaskFiles = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .select("attachments")
      .populate("attachments.uploadedBy", "name email");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({
      success: true,
      files: task.attachments || [],
    });
  } catch (error) {
    console.error("List files error:", error);
    res.status(500).json({ message: "Failed to list files" });
  }
};
