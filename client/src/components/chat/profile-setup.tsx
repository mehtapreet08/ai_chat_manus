import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ProfileSetupProps {
  onComplete: (gender: 'male' | 'female' | 'other', age: number, name: string) => void;
}

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [age, setAge] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = () => {
    const ageNum = parseInt(age);
    if (!name.trim()) {
        setError('Please enter your name');
        return;
    }
    if (!age || ageNum < 13 || ageNum > 100) {
      setError('Please enter a valid age (13-100)');
      return;
    }
    onComplete(gender, ageNum, name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl p-6 max-w-sm w-full border border-border">
        <h2 className="text-xl font-semibold mb-4">Setup Your Profile</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="mb-2 block">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div>
            <Label className="mb-2 block">Gender</Label>
            <RadioGroup value={gender} onValueChange={(v) => setGender(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" />
                <Label htmlFor="male">Male</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female">Female</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other">Other</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="age" className="mb-2 block">Age</Label>
            <Input
              id="age"
              type="number"
              min="13"
              max="100"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Enter your age"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleSubmit} className="w-full">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
