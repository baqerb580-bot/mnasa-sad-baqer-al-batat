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

export const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);
