import { StoresManager } from '@/components/settings/StoresManager';

export default function Stores() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stores</h1>
        <p className="text-muted-foreground">Gérez vos boutiques pour taguer et filtrer les commandes.</p>
      </div>
      <StoresManager />
    </div>
  );
}
