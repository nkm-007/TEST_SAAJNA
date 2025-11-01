import React from "react";
import { Button } from "@/components/ui/button";
import { Cloud, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGoogleDriveStatus,
  useConnectGoogleDrive,
  useDisconnectGoogleDrive,
} from "@/hooks/use-google-drive";

export const GoogleDriveButton: React.FC = () => {
  const { data: status, isLoading } = useGoogleDriveStatus();
  const { mutate: connectDrive, isPending: isConnecting } =
    useConnectGoogleDrive();
  const { mutate: disconnectDrive, isPending: isDisconnecting } =
    useDisconnectGoogleDrive();

  const isConnected = status?.isConnected || false;
  const driveEmail = status?.email || null;

  const handleConnect = () => {
    connectDrive();
  };

  const handleDisconnect = () => {
    if (!confirm("Are you sure you want to disconnect Google Drive?")) {
      return;
    }
    disconnectDrive(undefined, {
      onSuccess: () => {
        toast.success("Google Drive disconnected");
      },
      onError: () => {
        toast.error("Failed to disconnect");
      },
    });
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isConnected ? "outline" : "default"}
          size="sm"
          className={isConnected ? "gap-2" : "gap-2"}
        >
          {isConnected ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="hidden md:inline">Drive Connected</span>
              <Cloud className="h-4 w-4 md:hidden" />
            </>
          ) : (
            <>
              <Cloud className="h-4 w-4" />
              <span className="hidden md:inline">Connect Drive</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Google Drive</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isConnected ? (
          <>
            <div className="px-2 py-2 text-sm">
              <p className="text-muted-foreground">Connected as:</p>
              <p className="font-medium truncate">{driveEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Files stored in: <span className="font-mono">CLS/Task-ID/</span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-red-600 focus:text-red-600"
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect Drive"}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <div className="px-2 py-2 text-sm text-muted-foreground">
              Connect your Google Drive to upload and store files
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleConnect} disabled={isConnecting}>
              <Cloud className="mr-2 h-4 w-4" />
              {isConnecting ? "Connecting..." : "Connect Google Drive"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
