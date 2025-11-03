// frontend/app/components/task/file-upload-button-drive.tsx

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Cloud } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useUploadFileToDrive,
  useGoogleDriveStatus,
} from "@/hooks/use-google-drive";
import { fetchData } from "@/lib/fetch-util"; // ✅ ADD THIS

interface FileUploadButtonDriveProps {
  taskId: string;
  onUploadSuccess: () => void;
  disabled?: boolean;
}

export const FileUploadButtonDrive: React.FC<FileUploadButtonDriveProps> = ({
  taskId,
  onUploadSuccess,
  disabled,
}) => {
  const [needsAuth, setNeedsAuth] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { mutate: uploadFile, isPending: uploading } = useUploadFileToDrive();
  const { data: driveStatus } = useGoogleDriveStatus();

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size exceeds 50MB limit");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // ✅ Check if Drive is connected (from cached query data)
    const isConnected = driveStatus?.isConnected || false;
    if (!isConnected) {
      setNeedsAuth(true);
      toast.error("Please connect Google Drive first from the header");
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
          console.error("Upload error:", error);
          console.error("Error message:", error.message);
          console.error("Error response:", error.response);

          if (
            error.message?.includes("not connected") ||
            error.response?.data?.requiresAuth
          ) {
            setNeedsAuth(true);
            toast.error("Please connect Google Drive first from the header");
          } else {
            toast.error(
              error.message ||
                error.response?.data?.message ||
                "File upload failed"
            );
          }
          if (inputRef.current) inputRef.current.value = "";
        },
      }
    );
  };

  // ✅ Don't show connect button - redirect to header instead
  if (needsAuth) {
    return (
      <Alert className="mt-4">
        <Cloud className="h-4 w-4" />
        <AlertDescription>
          <span>
            Please connect Google Drive using the button in the header (top
            right)
          </span>
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
