import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info, Copy } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

export default function InstagramPage() {
  const [, setLocation] = useLocation();
  const [showInfo, setShowInfo] = useState(true);
  const { toast } = useToast();

  const userScriptCode = `// ==UserScript==
// @name         Distraction Free Instagram
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hide Reels and Explore from Instagram to focus on DMs and Feed
// @author       Brainstorm Studio User
// @match        https://www.instagram.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = \`
        /* Hide Reels Tab */
        a[href*="/reels/"] { display: none !important; }

        /* Hide Explore Tab */
        a[href*="/explore/"] { display: none !important; }

        /* Hide Reels in Feed (approximate selectors) */
        article:has(a[href*="/reels/"]) { display: none !important; }

        /* Hide Suggested Posts */
        article:has(span:contains("Suggested for you")) { display: none !important; }

        /* Hide specific aria-labels used for Reels */
        [aria-label="Reels"] { display: none !important; }
    \`;
    document.head.appendChild(style);

    // Observer to catch dynamic content
    const observer = new MutationObserver(() => {
        // Remove Reels links if they appear dynamically
        document.querySelectorAll('a[href*="/reels/"]').forEach(el => el.style.display = 'none');
        document.querySelectorAll('a[href*="/explore/"]').forEach(el => el.style.display = 'none');
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(userScriptCode);
    toast({
      title: "Copied!",
      description: "Userscript code copied to clipboard.",
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-card z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Instagram (Embedded)</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowInfo(!showInfo)}>
          <Info className="h-4 w-4 mr-2" />
          {showInfo ? "Hide Instructions" : "Show Instructions"}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Instructions Sidebar */}
        {showInfo && (
          <aside className="w-96 border-r bg-card/50 backdrop-blur-sm flex flex-col absolute left-0 top-0 bottom-0 z-20 shadow-lg md:relative md:shadow-none">
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                <Alert variant="destructive">
                  <AlertTitle>Setup Required</AlertTitle>
                  <AlertDescription>
                    Because Instagram blocks embedding, you must install a browser extension to allow this view to work.
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Step 1: Allow Embedding</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Install an extension like <strong>"Ignore X-Frame-Options Header"</strong> for your browser.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Without this, the area to the right will be blank or show an error.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Step 2: Hide Distractions</CardTitle>
                    <CardDescription>
                      To hide Reels and random posts as requested.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      1. Install the <strong>Tampermonkey</strong> extension.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      2. Create a new script and paste the code below:
                    </p>

                    <div className="relative">
                      <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap h-40">
                        {userScriptCode}
                      </pre>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={copyToClipboard}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </aside>
        )}

        {/* Iframe Area */}
        <div className="flex-1 bg-muted/20 relative">
          <iframe
            src="https://www.instagram.com/"
            className="w-full h-full border-none"
            title="Instagram Embed"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-presentation"
            referrerPolicy="no-referrer"
          />

          {!showInfo && (
             <div className="absolute top-4 left-4">
                <Button variant="secondary" size="sm" onClick={() => setShowInfo(true)} className="opacity-50 hover:opacity-100">
                    <Info className="h-4 w-4 mr-2" /> Show Setup
                </Button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
