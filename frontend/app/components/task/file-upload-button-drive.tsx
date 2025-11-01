import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import { Upload, Cloud } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FileUploadButtonDriveProps {
  taskId: string;
  onUploadSuccess: () => void;
  disabled?: boolean;
}

import { useUploadFileToDrive } from "@/hooks/use-google-drive";

export const FileUploadButtonDrive: React.FC<FileUploadButtonDriveProps> = ({
  taskId,
  onUploadSuccess,
  disabled,
}) => {
  const [needsAuth, setNeedsAuth] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { mutate: uploadFile, isPending: uploading } = useUploadFileToDrive();

  const checkDriveConnection = async () => {
    try {
      const response = await axios.get("/api/auth/google/status");
      return response.data.isConnected;
    } catch (error) {
      return false;
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size exceeds 50MB limit");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const isConnected = await checkDriveConnection();
    if (!isConnected) {
      setNeedsAuth(true);
      toast.error("Please connect Google Drive first");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    uploadFile(
      { taskId, file },
      {
        onSuccess: () => {
          toast.success("File uploaded to your Google Drive!");
          onUploadSuccess();
          if (inputRef.current) inputRef.current.value = "";
        },
        onError: (error: any) => {
          if (error.response?.data?.requiresAuth) {
            setNeedsAuth(true);
            toast.error("Please connect Google Drive first");
          } else {
            toast.error(error.response?.data?.message || "File upload failed");
          }
          if (inputRef.current) inputRef.current.value = "";
        },
      }
    );
  };

  const handleConnectDrive = async () => {
    try {
      const response = await axios.get("/api/auth/google/connect");
      window.location.href = response.data.authUrl;
    } catch (error) {
      toast.error("Failed to initiate Google Drive connection");
    }
  };

  if (needsAuth) {
    return (
      <Alert className="mt-4">
        <Cloud className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Connect Google Drive to upload files</span>
          <Button size="sm" onClick={handleConnectDrive}>
            Connect Drive
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <input
        type="file"
        ref={inputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
        accept="image/*,application/pdf,.doc,.docx,.txt,.xlsx,.xls,.csv"
        disabled={uploading || disabled}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || disabled}
        className="w-fit"
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? "Uploading..." : "Upload to Drive"}
      </Button>
    </>
  );
};
