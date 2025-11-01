import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, CheckCircle, XCircle, Loader2 } from "lucide-react";

import { toast } from "sonner";

import {
  useGoogleDriveStatus,
  useConnectGoogleDrive,
  useDisconnectGoogleDrive,
} from "@/hooks/use-google-drive";

export const GoogleDriveConnect: React.FC = () => {
  const { data: status, isLoading: loading } = useGoogleDriveStatus();
  const { mutate: connectDrive } = useConnectGoogleDrive();
  const { mutate: disconnectDrive } = useDisconnectGoogleDrive();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("drive_connected") === "true") {
      toast.success("Google Drive connected successfully!");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("drive_error")) {
      toast.error("Failed to connect Google Drive");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleConnect = () => {
    connectDrive();
  };

  const handleDisconnect = () => {
    if (!confirm("Are you sure you want to disconnect Google Drive?")) {
      return;
    }
    disconnectDrive(undefined, {
      onSuccess: () => {
        toast.success("Google Drive disconnected successfully");
      },
      onError: () => {
        toast.error("Failed to disconnect Google Drive");
      },
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.isConnected || false;
  const driveEmail = status?.email || null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          Google Drive Storage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                isConnected ? "bg-green-100" : "bg-gray-100"
              }`}
            >
              {isConnected ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {isConnected ? "Connected" : "Not Connected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConnected ? driveEmail : "Connect to upload files"}
              </p>
            </div>
          </div>

          {isConnected ? (
            <Button variant="outline" onClick={handleDisconnect} size="sm">
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} size="sm">
              Connect Drive
            </Button>
          )}
        </div>

        {!isConnected && (
          <Alert>
            <Cloud className="h-4 w-4" />
            <AlertDescription>
              Files will be stored in your personal Google Drive under{" "}
              <strong>CLS/Task-ID/</strong> folders. You need to authorize once
              to enable file uploads.
            </AlertDescription>
          </Alert>
        )}

        {isConnected && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Your files are organized in Google Drive at:{" "}
              <strong>CLS/Task-ID/filename</strong>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
