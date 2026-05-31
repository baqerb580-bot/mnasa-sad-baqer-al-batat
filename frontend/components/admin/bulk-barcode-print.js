'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { api, fmt, fmtCurrency, safeArr } from '@/lib/page-shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Tag, Search, CheckSquare, Square, Plus, Minus, Package, Eye } from 'lucide-react';

const SIZE_PRESETS = {
  small:  { name: 'صغير (40×20mm)', w: 151, h: 76,  barcodeH: 30, fontSize: 9,  perRow: 5, gap: 4  },
  medium: { name: 'متوسط (50×30mm)', w: 189, h: 113, barcodeH: 40, fontSize: 11, perRow: 4, gap: 6  },
  large:  { name: 'كبير (70×40mm)',  w: 264, h: 151, barcodeH: 50, fontSize: 13, perRow: 3, gap: 8  },
};

export default function BulkBarcodePrintPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selections, setSelections] = useState({}); // {productId: copies}
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [labelSize, setLabelSize] = useState('medium');
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showCompany, setShowCompany] = useState(true);

  const previewRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api('products');
      setProducts(safeArr(d));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filtered products
  const filtered = useMemo(() => {
    let arr = products.filter(p => p.barcode); // only products with barcodes
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(p => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').includes(q) || (p.sku || '').toLowerCase().includes(q));
    }
    if (category !== 'all') arr = arr.filter(p => p.category === category);
    return arr;
  }, [products, search, category]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(set);
  }, [products]);

  const totalLabels = Object.values(selections).reduce((s, n) => s + (Number(n) || 0), 0);
  const selectedCount = Object.values(selections).filter(n => Number(n) > 0).length;

  const toggleProduct = (id, defaultCopies = 1) => {
    setSelections(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = defaultCopies;
      return next;
    });
  };

  const setCopies = (id, n) => {
    const v = Math.max(0, Math.min(100, Number(n) || 0));
    setSelections(prev => v === 0 ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)) : { ...prev, [id]: v });
  };

  const selectAll = () => {
    const next = { ...selections };
    filtered.forEach(p => { if (!next[p.id]) next[p.id] = 1; });
    setSelections(next);
  };

  const clearAll = () => setSelections({});

  // Render labels for print
  const labelsToRender = useMemo(() => {
    const list = [];
    products.forEach(p => {
      const copies = selections[p.id];
      if (copies > 0) {
        for (let i = 0; i < copies; i++) list.push(p);
      }
    });
    return list;
  }, [products, selections]);

  // Render barcodes after mount using JsBarcode (loaded lazily)
  useEffect(() => {
    if (labelsToRender.length === 0) return;
    let cancelled = false;
    const renderBarcodes = async () => {
      try {
        const mod = await import('jsbarcode');
        const JsBarcode = mod.default || mod;
        if (cancelled) return;
        // Wait one tick for DOM
        await new Promise(r => setTimeout(r, 100));
        document.querySelectorAll('[data-barcode-svg]').forEach(svg => {
          const code = svg.getAttribute('data-barcode-svg');
          if (!code) return;
          try {
            JsBarcode(svg, code, {
              format: 'CODE128',
              displayValue: true,
              fontSize: SIZE_PRESETS[labelSize].fontSize,
              height: SIZE_PRESETS[labelSize].barcodeH,
              margin: 0,
              background: '#ffffff',
              lineColor: '#000000',
            });
          } catch {}
        });
      } catch (e) {
        console.error('JsBarcode load error:', e);
      }
    };
    renderBarcodes();
    return () => { cancelled = true; };
  }, [labelsToRender, labelSize, showPrice, showName, showCompany]);

  const handlePrint = () => {
    if (labelsToRender.length === 0) {
      toast.error('اختر على الأقل منتجاً واحداً');
      return;
    }
    window.print();
  };

  const size = SIZE_PRESETS[labelSize];

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <Card className="glass-strong border-gold/30 no-print">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="gold-text flex items-center gap-2 text-2xl">
                <Tag className="w-6 h-6" /> طباعة باركودات مجمَّعة
              </CardTitle>
              <CardDescription className="mt-1">
                اختر المنتجات وعدد النسخ، ثم اطبع الملصقات على ورق A4 — يدعم Code128
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40">
                <Package className="w-3 h-3 ml-1" /> {selectedCount} منتج / {totalLabels} ملصق
              </Badge>
              <Button onClick={handlePrint} disabled={totalLabels === 0} className="btn-gold">
                <Printer className="w-4 h-4 ml-1" /> طباعة ({totalLabels})
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* CONTROLS */}
      <Card className="glass-card border-gold-soft no-print">
        <CardContent className="pt-4 space-y-3">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="بحث (اسم/باركود/SKU)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10 bg-input/30 border-gold/20"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفئات</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={labelSize} onValueChange={setLabelSize}>
              <SelectTrigger className="bg-input/30 border-gold/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SIZE_PRESETS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Display options */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={showName ? 'default' : 'outline'} onClick={() => setShowName(v => !v)} className={showName ? 'btn-gold' : 'border-gold/30'}>
              {showName ? '✓ ' : ''}اسم المنتج
            </Button>
            <Button size="sm" variant={showPrice ? 'default' : 'outline'} onClick={() => setShowPrice(v => !v)} className={showPrice ? 'btn-gold' : 'border-gold/30'}>
              {showPrice ? '✓ ' : ''}السعر
            </Button>
            <Button size="sm" variant={showCompany ? 'default' : 'outline'} onClick={() => setShowCompany(v => !v)} className={showCompany ? 'btn-gold' : 'border-gold/30'}>
              {showCompany ? '✓ ' : ''}اسم الشركة
            </Button>
            <div className="flex-1"></div>
            <Button size="sm" variant="outline" onClick={selectAll} className="border-cyan-500/30 text-cyan-400">
              <CheckSquare className="w-3 h-3 ml-1" /> اختيار الكل
            </Button>
            <Button size="sm" variant="outline" onClick={clearAll} className="border-red-500/30 text-red-400">
              <Square className="w-3 h-3 ml-1" /> إلغاء الكل
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PRODUCTS LIST */}
      <Card className="glass-card border-gold-soft no-print">
        <CardHeader>
          <CardTitle className="text-base">المنتجات ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {products.filter(p => !p.barcode).length > 0 
                ? `⚠️ ${products.filter(p => !p.barcode).length} منتج بدون باركود — أضف باركود لها أولاً`
                : 'لا توجد منتجات'}
            </p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto space-y-1">
              {filtered.map(p => {
                const copies = selections[p.id] || 0;
                const isSelected = copies > 0;
                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded border flex items-center gap-3 transition-all ${isSelected ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-input/20 border-gold-soft hover:bg-input/40'}`}
                  >
                    <button onClick={() => toggleProduct(p.id)} className="shrink-0">
                      {isSelected ? <CheckSquare className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                    </button>
                    <span className="text-xl">{p.image || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.sku} · {p.barcode}</p>
                    </div>
                    <p className="text-xs gold-text font-bold shrink-0">{fmtCurrency(p.price)}</p>
                    {isSelected && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCopies(p.id, copies - 1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={copies}
                          onChange={e => setCopies(p.id, e.target.value)}
                          className="w-14 h-7 text-center text-xs bg-input/30 border-gold/20"
                          min="1"
                          max="100"
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCopies(p.id, copies + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PREVIEW */}
      {labelsToRender.length > 0 && (
        <Card className="glass-card border-emerald-500/30 no-print">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" /> معاينة الطباعة ({labelsToRender.length} ملصق)
            </CardTitle>
            <CardDescription>عدد الملصقات بالصف: {size.perRow} · الحجم: {size.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto bg-white p-4 rounded">
              <BarcodeGrid labels={labelsToRender} size={size} showName={showName} showPrice={showPrice} showCompany={showCompany} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRINT-ONLY AREA */}
      <div ref={previewRef} className="print-only print-area">
        <BarcodeGrid labels={labelsToRender} size={size} showName={showName} showPrice={showPrice} showCompany={showCompany} />
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print, .no-print * { display: none !important; visibility: hidden !important; }
          .print-only { display: block !important; visibility: visible !important; }
          .print-area { position: absolute; top: 0; left: 0; right: 0; padding: 8mm; }
          @page { size: A4; margin: 0; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
}

function BarcodeGrid({ labels, size, showName, showPrice, showCompany }) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${size.perRow}, 1fr)`,
        gap: `${size.gap}px`,
      }}
    >
      {labels.map((p, idx) => (
        <div
          key={`${p.id}-${idx}`}
          style={{
            width: `${size.w}px`,
            height: `${size.h}px`,
            border: '1px dashed #ccc',
            padding: '4px',
            background: 'white',
            color: 'black',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            overflow: 'hidden',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {showCompany && (
            <p style={{ fontSize: '8px', fontWeight: 'bold', margin: 0, color: '#b8860b' }}>مركز الغزلان</p>
          )}
          {showName && (
            <p style={{
              fontSize: `${size.fontSize}px`,
              fontWeight: 'bold',
              margin: 0,
              textAlign: 'center',
              lineHeight: 1.1,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              direction: 'rtl',
            }}>{p.name}</p>
          )}
          <svg data-barcode-svg={p.barcode} style={{ width: '100%', maxHeight: `${size.barcodeH + 16}px` }} />
          {showPrice && (
            <p style={{
              fontSize: `${size.fontSize + 2}px`,
              fontWeight: 'bold',
              margin: 0,
              color: '#000',
            }}>{Number(p.price || 0).toLocaleString('en-US')} د.ع</p>
          )}
        </div>
      ))}
    </div>
  );
}
