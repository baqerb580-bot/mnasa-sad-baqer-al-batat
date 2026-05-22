'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api, fmt, fmtCurrency, safeArr, setArr } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { GPSMap } from '@/components/maps-barcode';
import {
  Search, Plus, Trash2 as Trash, Edit2 as Edit, X, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2,
  AlertTriangle, AlertCircle, Activity, Send, MapPin, FileText, Camera, Clock, RefreshCw, Receipt
} from 'lucide-react';

export function ColumnHeader({ colKey, label, sortBy, sortDir, toggleSort, colSearch, onColSearch, open, setOpen }) {
  const isSorted = sortBy === colKey;
  const hasFilter = !!colSearch;
  return (
    <th className="p-2 relative">
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={() => toggleSort(colKey)}
          className={`flex items-center gap-1 hover:text-gold transition-colors ${isSorted ? 'text-gold font-bold' : ''}`}
          title="انقر للترتيب"
        >
          <span>{label}</span>
          <span className="text-[10px]">
            {isSorted ? (sortDir === 'asc' ? '⬆️' : '⬇️') : '⇅'}
          </span>
        </button>
        <button
          onClick={() => setOpen(!open)}
          className={`p-0.5 rounded hover:bg-gold/20 transition-colors ${hasFilter ? 'text-gold bg-gold/10' : 'text-muted-foreground'}`}
          title="بحث في هذا العمود"
        >
          <Search className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-48 p-2 rounded-lg border border-gold/40 bg-background shadow-xl">
          <Input
            value={colSearch}
            onChange={e => onColSearch(e.target.value)}
            placeholder={`بحث في ${label}...`}
            className="bg-input/30 border-gold/20 h-8 text-xs"
            autoFocus
          />
          <div className="flex justify-between mt-2">
            <button onClick={() => { onColSearch(''); setOpen(false); }} className="text-[10px] text-red-400 hover:underline">مسح</button>
            <button onClick={() => setOpen(false)} className="text-[10px] text-cyan-400 hover:underline">إغلاق</button>
          </div>
        </div>
      )}
    </th>
  );
}
