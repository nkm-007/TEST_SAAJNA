// ============================================
// frontend/app/hooks/use-google-drive.ts
// ============================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData, deleteData } from "@/lib/fetch-util";

// ✅ Get BASE_URL from your fetch-util for FormData uploads
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api-v1";

// Check Google Drive connection status
export const useGoogleDriveStatus = () => {
  return useQuery({
    queryKey: ["google-drive-status"],
    queryFn: () =>
      fetchData<{ isConnected: boolean; email: string | null }>(
        "/auth/google/status"
      ),
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

// Get auth URL to connect Drive
export const useConnectGoogleDrive = () => {
  return useMutation({
    mutationFn: () => fetchData<{ authUrl: string }>("/auth/google/connect"),
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
  });
};

// Disconnect Google Drive
export const useDisconnectGoogleDrive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      postData<{ message: string }>("/auth/google/disconnect", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
    },
  });
};

// Upload file to Google Drive
export const useUploadFileToDrive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { taskId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", data.file);

      // ✅ Use fetch API with proper error handling
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${BASE_URL}/tasks/${data.taskId}/upload-file`,
        {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            // ✅ Don't set Content-Type - browser sets it automatically with boundary
          },
          body: formData,
        }
      );

      // ✅ Better error handling
      if (!response.ok) {
        let errorMessage = "Upload failed";
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (e) {
          // If response isn't JSON, use status text
          errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      queryClient.invalidateQueries({
        queryKey: ["task-files", variables.taskId],
      });
    },
  });
};

// Get files for a task
export const useTaskFiles = (taskId: string) => {
  return useQuery({
    queryKey: ["task-files", taskId],
    queryFn: async () => {
      const response = await fetchData<{ success: boolean; files: any[] }>(
        `/tasks/${taskId}/files`
      );
      return response.files || [];
    },
    enabled: !!taskId,
  });
};

// Delete file from Google Drive
export const useDeleteFileFromDrive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { taskId: string; fileKey: string }) =>
      deleteData<{ success: boolean; message: string }>(
        `/tasks/${data.taskId}/files/${encodeURIComponent(data.fileKey)}`
      ),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      queryClient.invalidateQueries({
        queryKey: ["task-files", variables.taskId],
      });
    },
  });
};
