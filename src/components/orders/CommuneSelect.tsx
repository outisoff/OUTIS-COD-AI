import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface CommuneSelectProps {
  value: string;
  onChange: (value: string) => void;
  communes: string[];
  placeholder?: string;
  disabled?: boolean;
}

export function CommuneSelect({ value, onChange, communes, placeholder = "Sélectionner une commune", disabled = false }: CommuneSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCommunes = useMemo(() => {
    if (!searchQuery.trim()) return communes;
    
    const query = searchQuery.toLowerCase().trim();
    return communes.filter(commune => 
      commune.toLowerCase().includes(query)
    );
  }, [searchQuery, communes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || communes.length === 0}
          className="w-full justify-between font-normal"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 z-[9999]" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher une commune..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList
            className="max-h-[300px] overflow-y-auto overscroll-contain"
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <CommandEmpty>Aucune commune trouvée.</CommandEmpty>
            <CommandGroup>
              {filteredCommunes.map((commune) => (
                <CommandItem
                  key={commune}
                  value={commune}
                  onSelect={() => {
                    onChange(commune);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === commune ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {commune}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
