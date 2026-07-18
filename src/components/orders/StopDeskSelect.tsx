import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, MapPin, Loader2 } from 'lucide-react';
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

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  commune: string;
  type: string;
}

interface StopDeskSelectProps {
  value: string;
  onChange: (value: string, point?: PickupPoint) => void;
  pickupPoints: PickupPoint[];
  isLoading: boolean;
  disabled?: boolean;
}

export function StopDeskSelect({ value, onChange, pickupPoints, isLoading, disabled = false }: StopDeskSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedPoint = useMemo(() => {
    return pickupPoints.find(p => p.id === value || p.name === value);
  }, [value, pickupPoints]);

  const filteredPoints = useMemo(() => {
    if (!searchQuery.trim()) return pickupPoints;
    const query = searchQuery.toLowerCase().trim();
    return pickupPoints.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.commune.toLowerCase().includes(query) ||
      p.address.toLowerCase().includes(query)
    );
  }, [searchQuery, pickupPoints]);

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="w-full justify-start font-normal">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des stop desks...
      </Button>
    );
  }

  if (pickupPoints.length === 0) {
    return (
      <Button variant="outline" disabled className="w-full justify-start font-normal text-muted-foreground">
        <MapPin className="mr-2 h-4 w-4" />
        Aucun stop desk disponible
      </Button>
    );
  }

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
          <span className="truncate flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            {selectedPoint ? selectedPoint.name : 'Sélectionner un stop desk...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 z-[9999]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher un stop desk..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList
            className="max-h-[250px] overflow-y-auto overscroll-contain"
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <CommandEmpty>Aucun stop desk trouvé.</CommandEmpty>
            <CommandGroup>
              {filteredPoints.map((point) => (
                <CommandItem
                  key={point.id}
                  value={point.id}
                  onSelect={() => {
                    onChange(point.id, point);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      selectedPoint?.id === point.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{point.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {point.commune}{point.address ? ` — ${point.address}` : ''}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
