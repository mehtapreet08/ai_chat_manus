import { Loader2 } from "lucide-react";

interface WaitingScreenProps {
  status: "connecting" | "waiting";
}

export function WaitingScreen({ status }: WaitingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background px-6">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <Loader2 
          className="w-12 h-12 text-primary animate-spin" 
          data-testid="spinner-loading"
        />
        
        <div className="space-y-3">
          <h1 
            className="text-2xl font-semibold text-foreground"
            data-testid="text-waiting-title"
          >
            {status === "connecting" ? "Connecting..." : "Finding Your Chat Partner..."}
          </h1>
          
          <p 
            className="text-base text-muted-foreground"
            data-testid="text-waiting-subtitle"
          >
            {status === "connecting" 
              ? "Establishing connection to the server" 
              : "Waiting for another user to connect"
            }
          </p>
        </div>
        
        <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground italic">
            Your messages will be transformed by an AI middleman
          </p>
        </div>
      </div>
    </div>
  );
}
