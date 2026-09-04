export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 self-start max-w-[85%]" data-testid="indicator-typing">
      <div className="text-xs text-muted-foreground mb-1 px-1 font-medium">
        AI Middleman
      </div>
      <div className="flex items-center gap-1 bg-secondary px-4 py-3 rounded-tl-xl rounded-tr-xl rounded-bl-md rounded-br-xl">
        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
