import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
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
import { algeriaWilayas } from '@/data/algeriaLocations';

interface WilayaSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function WilayaSelect({ value, onChange, placeholder = "Sélectionner une wilaya", disabled = false }: WilayaSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedWilaya = useMemo(() => {
    return algeriaWilayas.find(
      w => w.name === value || w.code === value || `${w.code} - ${w.name}` === value
    );
  }, [value]);

  const filteredWilayas = useMemo(() => {
    if (!searchQuery.trim()) return algeriaWilayas;
    
    const query = searchQuery.toLowerCase().trim();
    return algeriaWilayas.filter(wilaya => 
      wilaya.name.toLowerCase().includes(query) ||
      wilaya.code.includes(query) ||
      `${wilaya.code} - ${wilaya.name}`.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedWilaya ? `${selectedWilaya.code} - ${selectedWilaya.name}` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 z-[9999]" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher par nom ou numéro..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList
            className="max-h-[300px] overflow-y-auto overscroll-contain"
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <CommandEmpty>Aucune wilaya trouvée.</CommandEmpty>
            <CommandGroup>
              {filteredWilayas.map((wilaya) => (
                <CommandItem
                  key={wilaya.code}
                  value={wilaya.code}
                  onSelect={() => {
                    onChange(`${wilaya.code} - ${wilaya.name}`);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedWilaya?.code === wilaya.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-medium mr-2">{wilaya.code}</span>
                  <span>{wilaya.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
