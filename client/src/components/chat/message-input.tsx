import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  onSend: (message: string) => void;
  cooldownSeconds: number;
  disabled: boolean;
}

export function MessageInput({ onSend, cooldownSeconds, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedMessage = message.trim();
  const isCommand = trimmedMessage === "/mode" || trimmedMessage === "/summarize";
  const wordCount = message.trim().split(/\s+/).filter(w => w.length > 0).length;
  const isValid = isCommand || wordCount >= 10;

  const handleSend = () => {
    if (!isValid || disabled) return;

    onSend(message);
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  return (
    <div className="p-4 bg-card border-t border-border">
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message (min 10 words) or /mode, /summarize..."
            className="min-h-[44px] max-h-[120px] resize-none pr-16"
            disabled={disabled}
            data-testid="input-message"
          />
          {!isCommand && (
            <div
              className={`absolute bottom-3 right-3 text-xs ${
                isValid ? "text-status-online" : "text-muted-foreground"
              }`}
              data-testid="text-word-count"
            >
              {wordCount}/10
            </div>
          )}
        </div>

        <Button
          onClick={handleSend}
          disabled={!isValid || disabled}
          size="default"
          data-testid="button-send"
        >
          <Send className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>

      {cooldownSeconds > 0 && (
        <div
          className="mt-2 text-xs text-amber-600 dark:text-amber-400 text-center"
          data-testid="text-cooldown"
        >
          Please wait {cooldownSeconds}s before sending next message
        </div>
      )}

      {!isValid && message.length > 0 && wordCount < 10 && !isCommand && (
        <div
          className="mt-2 text-xs text-muted-foreground text-center"
          data-testid="text-validation"
        >
          Message needs at least {10 - wordCount} more {10 - wordCount === 1 ? 'word' : 'words'}
        </div>
      )}
    </div>
  );
}