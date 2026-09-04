import { cn } from "@/lib/utils";
import { personaDisplayNames, type Message } from "@shared/schema";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Determine alignment and styling based on message type
  const getMessageStyles = () => {
    switch (message.type) {
      case "sent":
        return {
          container: "self-end max-w-[85%]",
          bubble: "bg-primary text-primary-foreground rounded-tl-xl rounded-tr-xl rounded-bl-xl rounded-br-md",
          time: "text-primary-foreground/70 text-right"
        };
      case "received":
        return {
          container: "self-start max-w-[85%]",
          bubble: "bg-secondary text-secondary-foreground rounded-tl-xl rounded-tr-xl rounded-bl-md rounded-br-xl",
          time: "text-muted-foreground text-left"
        };
      case "ai-interpreted":
        return {
          container: "self-start max-w-[90%]",
          bubble: "bg-secondary text-secondary-foreground rounded-tl-xl rounded-tr-xl rounded-bl-md rounded-br-xl",
          time: "text-muted-foreground text-left"
        };
      case "summary":
        return {
          container: "self-center max-w-[95%]",
          bubble: "bg-amber-500/10 text-foreground border-2 border-amber-500/50 rounded-xl text-center",
          time: "text-muted-foreground text-center"
        };
      case "system":
        return {
          container: "self-center w-full",
          bubble: "bg-muted/50 text-muted-foreground border border-border rounded-lg text-center text-sm py-2",
          time: ""
        };
      default:
        return {
          container: "self-start max-w-[85%]",
          bubble: "bg-secondary text-secondary-foreground rounded-xl",
          time: "text-muted-foreground"
        };
    }
  };

  const styles = getMessageStyles();

  if (message.type === "system") {
    return (
      <div className={styles.container} data-testid={`message-system-${message.id}`}>
        <div className={styles.bubble}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", styles.container)} data-testid={`message-${message.type}-${message.id}`}>
      {message.label && (
        <div className="text-xs text-muted-foreground mb-1 px-1 font-medium">
          {message.label}
        </div>
      )}
      
      <div className={cn("px-4 py-3", styles.bubble)}>
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
      
      <div className={cn("text-xs mt-1 px-1", styles.time)}>
        {formatTime(message.timestamp)}
      </div>
    </div>
  );
}
