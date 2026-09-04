import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { personaModes, personaDisplayNames, personaDescriptions, type PersonaMode } from "@shared/schema";

interface ModeSelectorProps {
  currentMode: PersonaMode;
  onSelect: (mode: PersonaMode) => void;
  onClose: () => void;
}

export function ModeSelector({ currentMode, onSelect, onClose }: ModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<PersonaMode>(currentMode);

  const handleSubmit = () => {
    onSelect(selectedMode);
  };

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
      data-testid="modal-mode-selector"
    >
      <div 
        className="bg-card border border-card-border rounded-xl p-6 w-full max-w-md shadow-lg animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground" data-testid="text-mode-selector-title">
            Select AI Persona Mode
          </h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            data-testid="button-close-mode-selector"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <RadioGroup 
          value={selectedMode} 
          onValueChange={(value) => setSelectedMode(value as PersonaMode)}
          className="space-y-3"
        >
          {personaModes.map((mode) => (
            <div 
              key={mode}
              className="flex items-start space-x-3 p-3 rounded-lg hover-elevate cursor-pointer"
              onClick={() => setSelectedMode(mode)}
              data-testid={`option-mode-${mode}`}
            >
              <RadioGroupItem value={mode} id={mode} className="mt-1" />
              <div className="flex-1">
                <Label 
                  htmlFor={mode} 
                  className="font-medium text-foreground cursor-pointer"
                >
                  {personaDisplayNames[mode]}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {personaDescriptions[mode]}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <Button
          onClick={handleSubmit}
          className="w-full mt-6"
          data-testid="button-submit-mode"
        >
          Switch Mode
        </Button>
      </div>
    </div>
  );
}
