import { FileText, X, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { personaDisplayNames, type PersonaMode } from "@shared/schema";
import { useLocation } from "wouter";

interface ChatHeaderProps {
  mode: PersonaMode;
  userLabel: string; // Added userLabel prop to display name
  onSummarize: () => void;
  onDisconnect: () => void;
}

export function ChatHeader({ mode, userLabel, onSummarize, onDisconnect }: ChatHeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <header 
      className="flex items-center justify-between p-4 bg-card border-b border-border"
      data-testid="header-chat"
    >
      <div className="flex flex-col">
        <h2 
          className="text-lg font-semibold text-foreground"
          data-testid="text-header-title"
        >
          {/* Displaying user label (e.g. You (John)) */}
          Chatting as {userLabel}
        </h2>
        <p className="text-xs text-status-online" data-testid="text-connection-status">
          Connected
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <Badge 
          variant="secondary" 
          className="text-xs px-3 py-1"
          data-testid={`badge-mode-${mode}`}
        >
          {personaDisplayNames[mode]}
        </Badge>
        
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/instagram")}
          title="Open Instagram"
          data-testid="button-instagram"
        >
          <Instagram className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={onSummarize}
          title="Summarize Conversation"
          data-testid="button-summarize"
        >
          <FileText className="h-4 w-4" />
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          onClick={onDisconnect}
          title="Disconnect"
          data-testid="button-disconnect"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
