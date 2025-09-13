import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface StackExportProps {
  toolIds: string[];
}

export function StackExport({ toolIds }: StackExportProps) {
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch('/api/stack/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolIds, format }),
      });
      if (format === 'csv') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stack.csv';
        a.click();
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stack.json';
        a.click();
      }
    } catch (error) {
      console.error('Export failed', error);
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={() => handleExport('json')}>
        <Download className="mr-2 h-4 w-4" /> Export JSON
      </Button>
      <Button onClick={() => handleExport('csv')}>
        <Download className="mr-2 h-4 w-4" /> Export CSV
      </Button>
    </div>
  );
}


