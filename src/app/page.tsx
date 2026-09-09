"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronRight, Copy, Download, Plus, X, Eye, RefreshCw, Loader2 } from "lucide-react";
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { GeneratedLink, getConfigItems } from "@/lib/db";
import { db } from "@/lib/firebase";
import GeneratorModal from "@/components/GeneratorModal";

import { format, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";

import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Helper to get formatted month
const getMonthLabel = (date: Date) => {
  const lbl = format(date, "MMM yyyy", { locale: es });
  return lbl.charAt(0).toUpperCase() + lbl.slice(1);
};

const MultiSelect = ({ title, options, selected, onChange }: { title: string, options: string[], selected: string[], onChange: (val: string[]) => void }) => {
  const [open, setOpen] = useState(false);
  const isAllSelected = selected.length === 0;

  return (
    <div className="relative flex-1 min-w-[140px]">
      <div onClick={() => setOpen(!open)} className="px-3 py-2 border border-fava-lightgray rounded-lg text-sm font-public text-fava-darkgray bg-white cursor-pointer flex justify-between items-center hover:border-fava-red transition-colors">
        <span className="truncate">{isAllSelected ? `${title} (Todos)` : `${title} (${selected.length})`}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`}/>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-fava-lightgray rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto py-1">
          {options.length === 0 ? (
             <div className="px-3 py-2 text-xs text-fava-mediumgray">Sin opciones</div>
          ) : (
            <>
              <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-fava-lightgray/20 cursor-pointer text-sm font-public text-fava-darkgray font-bold border-b border-fava-lightgray/50 pb-2 mb-1">
                <input 
                  type="checkbox" 
                  checked={isAllSelected} 
                  onChange={() => onChange([])} 
                  className="accent-fava-red cursor-pointer"
                />
                <span className="truncate">Todos</span>
              </label>
              {options.map(opt => (
                <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-fava-lightgray/20 cursor-pointer text-sm font-public text-fava-darkgray">
                  <input 
                    type="checkbox" 
                    checked={selected.includes(opt)} 
                    onChange={() => {
                      if (selected.includes(opt)) onChange(selected.filter(x => x !== opt));
                      else onChange([...selected, opt]);
                    }} 
                    className="accent-fava-red cursor-pointer"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>}
    </div>
  );
};

// Componente para el botón de copiado individual
const InlineCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className={`p-1.5 transition-colors ml-2 ${copied ? 'text-green-600' : 'text-fava-mediumgray hover:text-fava-darkgray'}`}>
      {copied ? <span className="text-xs font-bold font-public">✓</span> : <Copy size={16}/>}
    </button>
  );
};

export default function Dashboard() {
  const [linksData, setLinksData] = useState<GeneratedLink[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const months = [
    subMonths(currentDate, 2),
    subMonths(currentDate, 1),
    currentDate,
    addMonths(currentDate, 1),
    addMonths(currentDate, 2)
  ];
  
  const selectedMonthLabel = getMonthLabel(currentDate);

  useEffect(() => {
    const q = query(collection(db, "generated_links"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneratedLink));
      setLinksData(data);
    });
    return () => unsubscribe();
  }, []);

  const [dbTags, setDbTags] = useState<{name: string, color?: string}[]>([]);
  useEffect(() => {
    getConfigItems("tags").then(setDbTags);
  }, [isModalOpen]); // reload after modal might have created tags

  const [expandedCampaigns, setExpandedCampaigns] = useState<string[]>([]);
  const [expandedLinks, setExpandedLinks] = useState<string[]>([]);
  const [expandedSources, setExpandedSources] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Filter States
  const [filterCampaign, setFilterCampaign] = useState<string[]>([]);
  const [filterLinkName, setFilterLinkName] = useState<string[]>([]);
  const [filterSource, setFilterSource] = useState<string[]>([]);
  const [filterMedium, setFilterMedium] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  
  // Sort States
  const [sortBy, setSortBy] = useState<"name"|"date">("date");
  const [sortDir, setSortDir] = useState<"desc"|"asc">("desc");

  const { availableCampaigns, availableLinkNames, availableSources, availableMediums, availableTags } = useMemo(() => {
    const monthLinks = linksData.filter(link => link.monthYear === selectedMonthLabel);
    const tags = new Set<string>();
    monthLinks.forEach(l => l.tags?.forEach(t => tags.add(t)));
    
    return {
      availableCampaigns: Array.from(new Set(monthLinks.map(l => l.campaign.name))).sort(),
      availableLinkNames: Array.from(new Set(monthLinks.map(l => l.linkName.name))).sort(),
      availableSources: Array.from(new Set(monthLinks.map(l => l.source.name))).sort(),
      availableMediums: Array.from(new Set(monthLinks.map(l => l.medium.name))).sort(),
      availableTags: Array.from(tags).sort()
    };
  }, [linksData, selectedMonthLabel]);

  const hierarchicalData = React.useMemo(() => {
    let filtered = linksData.filter(link => link.monthYear === selectedMonthLabel);

    // Apply Filters
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(l => 
        l.campaign.name.toLowerCase().includes(q) ||
        l.linkName.name.toLowerCase().includes(q) ||
        l.source.name.toLowerCase().includes(q) ||
        l.medium.name.toLowerCase().includes(q) ||
        l.tags?.some(t => t.toLowerCase().includes(q)) ||
        l.utmUrl.toLowerCase().includes(q)
      );
    }
    if (filterCampaign.length > 0) filtered = filtered.filter(l => filterCampaign.includes(l.campaign.name));
    if (filterLinkName.length > 0) filtered = filtered.filter(l => filterLinkName.includes(l.linkName.name));
    if (filterSource.length > 0) filtered = filtered.filter(l => filterSource.includes(l.source.name));
    if (filterMedium.length > 0) filtered = filtered.filter(l => filterMedium.includes(l.medium.name));
    if (filterTag.length > 0) filtered = filtered.filter(l => l.tags && l.tags.some(t => filterTag.includes(t)));

    const campaignsMap = new Map();

    filtered.forEach(link => {
      // Campaign Level
      let camp = campaignsMap.get(link.campaign.id);
      if (!camp) {
        camp = { id: link.campaign.id, name: link.campaign.name, createdAt: link.createdAt, links: new Map() };
        campaignsMap.set(link.campaign.id, camp);
      }
      if (link.createdAt && (!camp.createdAt || link.createdAt > camp.createdAt)) camp.createdAt = link.createdAt;

      // Link Name Level
      let lName = camp.links.get(link.linkName.name);
      if (!lName) {
        const lid = `${link.campaign.id}-${link.linkName.name}`; 
        lName = { id: lid, name: link.linkName.name, createdAt: link.createdAt, sources: new Map() };
        camp.links.set(link.linkName.name, lName);
      }
      if (link.createdAt && (!lName.createdAt || link.createdAt > lName.createdAt)) lName.createdAt = link.createdAt;

      // Source Level
      let source = lName.sources.get(link.source.id);
      if (!source) {
        const sid = `${lName.id}-${link.source.id}`;
        source = { id: sid, name: link.source.name, createdAt: link.createdAt, mediums: new Map() };
        lName.sources.set(link.source.id, source);
      }
      if (link.createdAt && (!source.createdAt || link.createdAt > source.createdAt)) source.createdAt = link.createdAt;

      // Medium Level
      const mid = link.id!;
      source.mediums.set(mid, {
        id: mid,
        name: link.medium.name,
        tags: link.tags,
        utm: link.utmUrl,
        bitly: link.bitlyUrl,
        hasQR: link.hasQR,
        qrSource: link.qrSource,
        createdAt: link.createdAt
      });
    });

    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (sortBy === "name") {
          return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        } else {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return sortDir === "asc" ? tA - tB : tB - tA;
        }
      });
    };

    const camps = Array.from(campaignsMap.values());
    sortNodes(camps);
    
    return camps.map(c => {
      const linksArr = Array.from(c.links.values());
      sortNodes(linksArr);
      
      return {
        ...c,
        links: linksArr.map((l: any) => {
          const sourcesArr = Array.from(l.sources.values());
          sortNodes(sourcesArr);
          
          return {
            ...l,
            sources: sourcesArr.map((s: any) => {
              const mediumsArr = Array.from(s.mediums.values());
              sortNodes(mediumsArr);
              return { ...s, mediums: mediumsArr };
            })
          };
        })
      };
    });
  }, [linksData, selectedMonthLabel, searchTerm, filterCampaign, filterLinkName, filterSource, filterMedium, filterTag, filterType, sortBy, sortDir]);

  const [copiedLinks, setCopiedLinks] = useState(false);
  const [copiedNames, setCopiedNames] = useState(false);

  const handleCopyLinks = () => {
    const urls: string[] = [];
    linksData.forEach(l => {
       const wantsUTM = selectedItems.includes(l.id!);
       const wantsBitly = selectedItems.includes(`${l.id!}-bitly`) && l.bitlyUrl;
       if (wantsUTM) urls.push(l.utmUrl);
       if (wantsBitly) urls.push(l.bitlyUrl as string);
    });
    if (urls.length === 0) return;
    
    navigator.clipboard.writeText(urls.join("\n"));
    setCopiedLinks(true);
    setTimeout(() => setCopiedLinks(false), 2000);
  };

  const handleCopyNamesAndLinks = () => {
    const selectedData = linksData.filter(l => 
      selectedItems.includes(l.id!) || (selectedItems.includes(`${l.id!}-bitly`) && l.bitlyUrl)
    );
    if (selectedData.length === 0) return;

    // Agrupar por Campaign - Source - Medium
    const grouped: Record<string, typeof selectedData> = {};
    for (const link of selectedData) {
      const header = `${link.campaign.name} - ${link.source.name} - ${link.medium.name}`;
      if (!grouped[header]) grouped[header] = [];
      grouped[header].push(link);
    }

    // Armar el texto de salida
    let textOut = Object.keys(grouped).sort().map(header => {
      const linksText = grouped[header].map(l => {
        const wantsUTM = selectedItems.includes(l.id!);
        const wantsBitly = selectedItems.includes(`${l.id!}-bitly`) && l.bitlyUrl;
        
        let urlStr = "";
        if (wantsUTM && wantsBitly) {
           urlStr = `${l.utmUrl} | Bitly: ${l.bitlyUrl}`;
        } else if (wantsUTM) {
           urlStr = l.utmUrl;
        } else if (wantsBitly) {
           urlStr = l.bitlyUrl as string;
        }
        return `${l.linkName.name}: ${urlStr}`;
      }).join("\n");
      return `${header}\n${linksText}`;
    }).join("\n\n");

    navigator.clipboard.writeText(textOut.trim());
    setCopiedNames(true);
    setTimeout(() => setCopiedNames(false), 2000);
  };

  const handleGenerateBitly = async (medium: any, campaignName: string, linkName: string, sourceName: string) => {
    try {
      const title = `${campaignName} - ${linkName} - ${sourceName} - ${medium.name}`;
      const res = await fetch("/api/bitly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ long_url: medium.utm, title })
      });
      const data = await res.json();
      if (res.ok && data.link) {
        await updateDoc(doc(db, "generated_links", medium.id), { bitlyUrl: data.link });
      } else {
        alert("Error de Bitly: " + (data.error || "Desconocido"));
      }
    } catch(e) {
      alert("Error al generar Bitly");
    }
  };

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [pendingQrTargets, setPendingQrTargets] = useState<any[]>([]);

  // Single QR State
  const [singleQrModal, setSingleQrModal] = useState<{
    isOpen: boolean;
    step: 'choice' | 'generating' | 'preview';
    medium: any | null;
    qrDataUrl: string | null;
  }>({ isOpen: false, step: 'choice', medium: null, qrDataUrl: null });

  const openSingleQrChoice = (medium: any) => {
    if (!medium.bitly) {
      executeSingleQr(medium, 'utm');
    } else {
      setSingleQrModal({ isOpen: true, step: 'choice', medium, qrDataUrl: null });
    }
  };

  const openSingleQrPreview = async (medium: any) => {
    setSingleQrModal({ isOpen: true, step: 'generating', medium, qrDataUrl: null });
    const url = medium.qrSource === 'bitly' && medium.bitly ? medium.bitly : medium.utm;
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    setSingleQrModal({ isOpen: true, step: 'preview', medium, qrDataUrl: dataUrl });
  };

  const executeSingleQr = async (medium: any, choice: 'bitly' | 'utm') => {
    setSingleQrModal(prev => ({ ...prev, isOpen: true, step: 'generating', medium }));
    const url = choice === 'bitly' && medium.bitly ? medium.bitly : medium.utm;
    
    // Simulate generation time to show the progress bar (optional, but requested by user to feel natural)
    await new Promise(r => setTimeout(r, 600)); 
    
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    
    const docRef = doc(db, "generated_links", medium.id);
    await updateDoc(docRef, { hasQR: true, qrSource: choice });
    
    setSingleQrModal(prev => ({ ...prev, step: 'preview', qrDataUrl: dataUrl }));
  };

  const handleDownloadQRs = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) return;
    
    // gather data
    const rawTargets: any[] = [];
    hierarchicalData.forEach(campaign => {
      campaign.links.forEach((link: any) => {
        link.sources.forEach((source: any) => {
          source.mediums.forEach((medium: any) => {
            if (selectedIds.includes(medium.id) || selectedIds.includes(`${medium.id}-qr`)) {
              rawTargets.push({
                campaign: campaign.name,
                link: link.name,
                source: source.name,
                medium: medium.name,
                utm: medium.utm,
                bitly: medium.bitly,
                id: medium.id
              });
            }
          });
        });
      });
    });

    const hasAnyBitly = rawTargets.some(t => t.bitly);
    
    if (hasAnyBitly) {
      setPendingQrTargets(rawTargets);
      setQrModalOpen(true);
      return;
    }

    await executeQrDownload(rawTargets, false);
  };

  const executeQrDownload = async (rawTargets: any[], preferBitly: boolean) => {
    setQrModalOpen(false);
    
    if (rawTargets.length === 1) {
      const url = preferBitly && rawTargets[0].bitly ? rawTargets[0].bitly : rawTargets[0].utm;
      const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2 });
      
      const fileName = `${rawTargets[0].campaign} - ${rawTargets[0].link} - ${rawTargets[0].source} - ${rawTargets[0].medium}`;
      saveAs(dataUrl, `${fileName}.png`);
      
      const docRef = doc(db, "generated_links", rawTargets[0].id);
      await updateDoc(docRef, { hasQR: true, qrSource: preferBitly && rawTargets[0].bitly ? 'bitly' : 'utm' });
    } else {
      const zip = new JSZip();
      for (const item of rawTargets) {
        const url = preferBitly && item.bitly ? item.bitly : item.utm;
        const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2 });
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        
        const fileName = `${item.campaign} - ${item.link} - ${item.source} - ${item.medium}`;
        zip.file(`${fileName}.png`, base64Data, { base64: true });
        
        const docRef = doc(db, "generated_links", item.id);
        await updateDoc(docRef, { hasQR: true, qrSource: preferBitly && item.bitly ? 'bitly' : 'utm' });
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "Codigos_QR.zip");
    }
  };

  const toggleExpand = (setter: any, id: string) => {
    setter((prev: string[]) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getLeafIds = (nodeType: string, nodeData: any) => {
    let ids: string[] = [];
    
    const addMediumIds = (m: any) => {
       if (filterType.length === 0 || filterType.includes("UTM")) {
         ids.push(m.id);
       }
       if (filterType.length === 0 || filterType.includes("Bitly")) {
         if (m.bitly) ids.push(`${m.id}-bitly`);
       }
       if (filterType.length === 0 || filterType.includes("QR")) {
         ids.push(`${m.id}-qr`);
       }
    };

    if (nodeType === 'campaign') {
      nodeData.links.forEach((l: any) => l.sources.forEach((s: any) => s.mediums.forEach((m: any) => addMediumIds(m))));
    } else if (nodeType === 'link') {
      nodeData.sources.forEach((s: any) => s.mediums.forEach((m: any) => addMediumIds(m)));
    } else if (nodeType === 'source') {
      nodeData.mediums.forEach((m: any) => addMediumIds(m));
    }
    return ids;
  };

  const handleGroupSelect = (nodeType: string, nodeData: any) => {
    const ids = getLeafIds(nodeType, nodeData);
    const allSelected = ids.length > 0 && ids.every(id => selectedItems.includes(id));
    if (allSelected) {
      setSelectedItems(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedItems(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const isGroupSelected = (nodeType: string, nodeData: any) => {
    const ids = getLeafIds(nodeType, nodeData);
    return ids.length > 0 && ids.every(id => selectedItems.includes(id));
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* 1. Selector de Tiempo */}
      <div className="flex items-center justify-center gap-6 pb-6 mt-4">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 text-fava-mediumgray hover:text-fava-red"><ChevronDown className="rotate-90" size={16}/></button>
        {months.map(date => {
          const lbl = getMonthLabel(date);
          const isSelected = date.getTime() === currentDate.getTime();
          return (
            <div 
              key={lbl} 
              onClick={() => setCurrentDate(date)}
              className={`px-6 py-2 font-satoshi font-bold cursor-pointer rounded-full transition-colors ${isSelected ? 'text-fava-white bg-fava-red shadow-[0_0_15px_rgba(229,41,41,0.5)]' : 'text-fava-mediumgray hover:text-fava-darkgray'}`}
            >
              {lbl}
            </div>
          );
        })}
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 text-fava-mediumgray hover:text-fava-red"><ChevronDown className="-rotate-90" size={16}/></button>
      </div>

      {/* 2. Panel de Filtros y Botón */}
      <div className="bg-fava-white p-6 rounded-xl border border-fava-lightgray flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto relative">
          <div className="relative flex-1 w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fava-mediumgray" size={18} />
            <input 
              type="text" 
              placeholder="Buscar links..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-fava-white border border-fava-lightgray rounded-xl focus:outline-none focus:border-fava-red font-public text-sm transition-colors"
            />
          </div>
          <button onClick={() => setFilterOpen(!filterOpen)} className={`px-4 py-2 border rounded-xl text-sm font-public font-bold flex items-center gap-2 transition-colors ${filterOpen || filterCampaign.length > 0 || filterLinkName.length > 0 || filterSource.length > 0 || filterMedium.length > 0 || filterTag.length > 0 || filterType.length > 0 ? 'bg-fava-red text-fava-white border-fava-red hover:bg-fava-darkred' : 'bg-fava-white border-fava-lightgray text-fava-darkgray hover:bg-fava-lightgray/20'}`}>
            Filtros <ChevronDown size={16} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`}/>
          </button>
        </div>

        {filterOpen && (
          <div className="bg-fava-white border border-fava-lightgray rounded-xl p-4 shadow-sm flex flex-col gap-4 animate-in slide-in-from-top-2">
            <div className="flex flex-wrap items-center gap-3 w-full">
              <MultiSelect title="Tipo de link" options={["UTM", "Bitly", "QR"]} selected={filterType} onChange={setFilterType} />
              <MultiSelect title="Campaigns" options={availableCampaigns} selected={filterCampaign} onChange={setFilterCampaign} />
              <MultiSelect title="Links" options={availableLinkNames} selected={filterLinkName} onChange={setFilterLinkName} />
              <MultiSelect title="Sources" options={availableSources} selected={filterSource} onChange={setFilterSource} />
              <MultiSelect title="Mediums" options={availableMediums} selected={filterMedium} onChange={setFilterMedium} />
              <MultiSelect title="Etiquetas" options={availableTags} selected={filterTag} onChange={setFilterTag} />
            </div>

            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-fava-lightgray mt-2 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-public font-bold text-fava-darkgray shrink-0">Ordenar por:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-1.5 border border-fava-lightgray rounded text-sm outline-none bg-transparent font-public text-fava-darkgray focus:border-fava-red">
                  <option value="date">Fecha de Creación</option>
                  <option value="name">Alfabético</option>
                </select>
                <select value={sortDir} onChange={e => setSortDir(e.target.value as any)} className="px-3 py-1.5 border border-fava-lightgray rounded text-sm outline-none bg-transparent font-public text-fava-darkgray focus:border-fava-red">
                  <option value="desc">{sortBy === 'date' ? 'Más recientes primero' : 'Z a A'}</option>
                  <option value="asc">{sortBy === 'date' ? 'Más antiguos primero' : 'A a Z'}</option>
                </select>
              </div>
              
              {(searchTerm || filterCampaign.length > 0 || filterLinkName.length > 0 || filterSource.length > 0 || filterMedium.length > 0 || filterTag.length > 0 || filterType.length > 0) && (
                <button onClick={() => { setSearchTerm(""); setFilterCampaign([]); setFilterLinkName([]); setFilterSource([]); setFilterMedium([]); setFilterTag([]); setFilterType([]); }} className="text-sm font-public font-bold text-fava-red hover:text-fava-darkred hover:underline px-2 transition-all">
                  Limpiar Filtros
                </button>
              )}
            </div>
          </div>
        )}

        <button onClick={() => setIsModalOpen(true)} className="w-full mt-2 bg-fava-red hover:bg-fava-darkred text-fava-white font-satoshi font-bold py-3 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(229,41,41,0.3)] transition-all flex items-center justify-center gap-2 text-lg">
          <Plus size={20} /> Generar Enlaces
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {hierarchicalData.length === 0 ? (
          <div className="text-center py-12 text-fava-mediumgray font-public">
            No hay enlaces generados para este mes. Hacé clic en "Generar Enlaces" para empezar.
          </div>
        ) : (
          hierarchicalData.map(campaign => (
          <div key={campaign.id} className="flex flex-col gap-1">
            {/* Nivel 1: Campaign */}
            <div className="bg-fava-white border border-fava-lightgray rounded-lg p-4 flex items-center gap-4 shadow-sm hover:border-fava-mediumgray transition-colors">
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-fava-red cursor-pointer"
                checked={isGroupSelected('campaign', campaign)}
                onChange={() => handleGroupSelect('campaign', campaign)}
              />
              <div className="flex-1 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(setExpandedCampaigns, campaign.id)}>
                <div className="flex flex-col">
                  <span className="text-xs font-public font-bold text-fava-mediumgray uppercase tracking-wider">Campaign</span>
                  <span className="text-lg font-satoshi font-bold text-fava-darkgray">{campaign.name}</span>
                </div>
                <ChevronRight className={`text-fava-mediumgray transition-transform ${expandedCampaigns.includes(campaign.id) ? 'rotate-90' : ''}`} size={20} />
              </div>
            </div>

            {/* Subniveles Campaign */}
            {expandedCampaigns.includes(campaign.id) && (
              <div className="ml-8 pl-4 border-l-2 border-fava-lightgray flex flex-col gap-2 mt-2">
                {campaign.links.map((link: any) => (
                  <div key={link.id} className="flex flex-col gap-1">
                    {/* Nivel 2: Link */}
                    <div className="bg-fava-white/60 border border-fava-lightgray/50 rounded-lg p-3 flex items-center gap-4 hover:border-fava-mediumgray transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-fava-red cursor-pointer"
                        checked={isGroupSelected('link', link)}
                        onChange={() => handleGroupSelect('link', link)}
                      />
                      <div className="flex-1 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(setExpandedLinks, link.id)}>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-public font-bold text-fava-mediumgray uppercase tracking-wider">Link</span>
                          <span className="font-satoshi font-bold text-fava-darkgray">{link.name}</span>
                        </div>
                        <ChevronRight className={`text-fava-mediumgray transition-transform ${expandedLinks.includes(link.id) ? 'rotate-90' : ''}`} size={18} />
                      </div>
                    </div>

                    {/* Subniveles Link */}
                    {expandedLinks.includes(link.id) && (
                      <div className="ml-8 pl-4 border-l-2 border-fava-lightgray flex flex-col gap-2 mt-1">
                        {link.sources.map((source: any) => (
                          <div key={source.id} className="flex flex-col gap-1">
                            {/* Nivel 3: Source */}
                            <div className="bg-fava-white/40 border border-fava-lightgray/30 rounded-lg p-2.5 flex items-center gap-4 hover:border-fava-mediumgray transition-colors">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-fava-red cursor-pointer"
                                checked={isGroupSelected('source', source)}
                                onChange={() => handleGroupSelect('source', source)}
                              />
                              <div className="flex-1 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(setExpandedSources, source.id)}>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-public font-bold text-fava-mediumgray uppercase tracking-wider">Source</span>
                                  <span className="text-sm font-satoshi font-bold text-fava-darkgray">{source.name}</span>
                                </div>
                                <ChevronRight className={`text-fava-mediumgray transition-transform ${expandedSources.includes(source.id) ? 'rotate-90' : ''}`} size={16} />
                              </div>
                            </div>

                            {/* Subniveles Source -> Mediums */}
                            {expandedSources.includes(source.id) && (
                              <div className="ml-8 pl-4 border-l-2 border-fava-lightgray flex flex-col gap-2 mt-1">
                                {source.mediums.map((medium: any) => (
                                  <div key={medium.id} className="bg-fava-white border border-fava-lightgray rounded-lg p-3 flex flex-col gap-2 shadow-sm hover:border-fava-mediumgray transition-colors">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-satoshi font-bold text-fava-darkgray">{medium.name}</span>
                                      {medium.tags?.map((t: string) => {
                                        const tagObj = dbTags.find(x => x.name === t);
                                        const bgColor = tagObj?.color || "#382d2d";
                                        return (
                                          <span key={t} className="px-2 py-0.5 rounded-full text-white text-[10px] font-public font-bold" style={{ backgroundColor: bgColor }}>{t}</span>
                                        );
                                      })}
                                    </div>

                                    {/* UTM */}
                                    {(filterType.length === 0 || filterType.includes("UTM")) && (
                                      <div className="flex items-center gap-3 bg-fava-lightgray/5 p-2 rounded-lg group">
                                        <input 
                                          type="checkbox" 
                                          className="w-4 h-4 accent-fava-red cursor-pointer"
                                          checked={selectedItems.includes(medium.id)}
                                          onChange={() => toggleSelect(medium.id)}
                                        />
                                        <span className="text-[10px] font-public font-bold text-fava-darkgray w-10 uppercase">UTM</span>
                                        <span className="text-xs font-public text-fava-mediumgray truncate group-hover:text-fava-darkgray transition-colors flex-1" title={medium.utm}>
                                          {medium.utm}
                                        </span>
                                        <InlineCopyButton text={medium.utm} />
                                      </div>
                                    )}

                                    {/* BITLY */}
                                    {(filterType.length === 0 || filterType.includes("Bitly")) && (
                                      <div className="flex items-center gap-3 bg-fava-lightgray/5 p-2 rounded-lg group">
                                        <input 
                                          type="checkbox" 
                                          className="w-4 h-4 accent-fava-red cursor-pointer"
                                          checked={selectedItems.includes(`${medium.id}-bitly`)}
                                          onChange={() => toggleSelect(`${medium.id}-bitly`)}
                                          disabled={!medium.bitly}
                                        />
                                        <span className="text-[10px] font-public font-bold text-fava-darkgray w-10 uppercase">Bitly</span>
                                        {medium.bitly ? (
                                          <>
                                            <span className="text-xs font-public text-fava-mediumgray truncate group-hover:text-fava-darkgray transition-colors flex-1" title={medium.bitly}>
                                              {medium.bitly}
                                            </span>
                                            <InlineCopyButton text={medium.bitly} />
                                          </>
                                        ) : (
                                          <div className="flex-1">
                                            <button onClick={() => handleGenerateBitly(medium, campaign.name, link.name, source.name)} className="px-3 py-1 border border-dashed border-fava-lightgray rounded font-public font-semibold text-[10px] text-fava-darkgray hover:bg-fava-lightgray/20 transition-colors flex items-center gap-1">
                                              <Plus size={12}/> Generar Bitly
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* QR */}
                                    {(filterType.length === 0 || filterType.includes("QR")) && (
                                      <div className="flex items-center gap-3 bg-fava-lightgray/5 p-2 rounded-lg group">
                                        <input 
                                          type="checkbox" 
                                          className="w-4 h-4 accent-fava-red cursor-pointer"
                                          checked={selectedItems.includes(`${medium.id}-qr`)}
                                          onChange={() => toggleSelect(`${medium.id}-qr`)}
                                        />
                                        <span className="text-[10px] font-public font-bold text-fava-darkgray w-10 uppercase">QR</span>
                                        {medium.hasQR ? (
                                          <>
                                            <span className="text-xs font-public text-fava-mediumgray flex-1">
                                              QR generado sobre {medium.qrSource === 'bitly' ? 'Bitly' : 'UTM'}
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <button onClick={() => openSingleQrPreview(medium)} className="p-1.5 text-fava-darkgray hover:bg-fava-lightgray/30 rounded transition-colors" title="Ver QR">
                                                <Eye size={14}/>
                                              </button>
                                              <button onClick={() => openSingleQrChoice(medium)} className="p-1.5 text-fava-darkgray hover:bg-fava-lightgray/30 rounded transition-colors" title="Rehacer QR">
                                                <RefreshCw size={14}/>
                                              </button>
                                              <button onClick={() => handleDownloadQRs([medium.id])} className="px-3 py-1 border border-fava-lightgray rounded font-public font-semibold text-[10px] transition-colors flex items-center gap-1 text-fava-red bg-fava-lightred/10 border-fava-red/20 hover:bg-fava-lightred/20 whitespace-nowrap">
                                                <Download size={12}/> Descargar
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex-1">
                                            <button onClick={() => openSingleQrChoice(medium)} className="px-3 py-1 border border-dashed border-fava-lightgray rounded font-public font-semibold text-[10px] text-fava-darkgray hover:bg-fava-lightgray/20 transition-colors flex items-center gap-1 w-max">
                                              <Plus size={12}/> Generar QR
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )))}
      </div>

      {/* 4. Bottom Action Bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-fava-darkgray rounded-xl shadow-fava-elevation px-6 py-4 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-5">
          <span className="font-public font-medium text-fava-white">
            {selectedItems.filter(id => !hierarchicalData.some(c => c.id === id) && !hierarchicalData.some(c => c.links.some((l:any) => l.id === id)) && !hierarchicalData.some(c => c.links.some((l:any) => l.sources.some((s:any) => s.id === id)))).length} elementos seleccionados
          </span>
          <div className="flex items-center gap-3 border-l border-fava-mediumgray/30 pl-6">
            <button onClick={handleCopyLinks} className="px-4 py-2 border border-fava-mediumgray/50 rounded text-fava-white font-public font-semibold text-sm flex items-center gap-2 hover:bg-fava-red transition-colors min-w-[150px] justify-center whitespace-nowrap">
              {copiedLinks ? "✓ Copiado" : "Copiar solo links"}
            </button>
            <button onClick={handleCopyNamesAndLinks} className="px-4 py-2 border border-fava-mediumgray/50 rounded text-fava-white font-public font-semibold text-sm flex items-center gap-2 hover:bg-fava-red transition-colors min-w-[200px] justify-center whitespace-nowrap">
              {copiedNames ? "✓ Copiado" : "Copiar Nombres + Links"}
            </button>
            {selectedItems.some(id => id.endsWith('-qr')) && (
              <button onClick={() => handleDownloadQRs(selectedItems)} className="px-4 py-2 bg-fava-red rounded text-fava-white font-satoshi font-bold text-sm flex items-center gap-2 hover:bg-fava-darkred transition-colors shadow-md whitespace-nowrap">
                <Download size={16}/> Descargar QRs
              </button>
            )}
            
            <div className="w-px h-8 bg-fava-mediumgray/30 mx-2"></div>
            
            <button onClick={() => setSelectedItems([])} className="p-2 text-fava-mediumgray hover:text-fava-white transition-colors" title="Deseleccionar todo">
              <X size={20}/>
            </button>
          </div>
        </div>
      )}

      {qrModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-fava-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-6 animate-in zoom-in-95">
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-satoshi font-bold text-fava-darkgray">¿Sobre qué enlace querés hacer el QR?</h3>
              <p className="font-public text-sm text-fava-mediumgray">
                Algunos de los elementos seleccionados tienen una versión corta de Bitly. ¿Preferís que los códigos QR apunten a esos enlaces cortos o a las UTM largas originales?
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setQrModalOpen(false); executeQrDownload(pendingQrTargets, true); }}
                className="w-full py-3 px-4 bg-fava-red hover:bg-fava-darkred text-fava-white font-satoshi font-bold rounded-xl transition-colors flex items-center justify-between group"
              >
                <span>Bitly</span>
                <ChevronRight size={18} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
              <button 
                onClick={() => { setQrModalOpen(false); executeQrDownload(pendingQrTargets, false); }}
                className="w-full py-3 px-4 bg-fava-lightgray/30 hover:bg-fava-lightgray border border-fava-lightgray text-fava-darkgray font-satoshi font-bold rounded-xl transition-colors flex items-center justify-between group"
              >
                <span>UTM</span>
                <ChevronRight size={18} className="text-fava-mediumgray group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <button 
              onClick={() => setQrModalOpen(false)}
              className="mt-2 text-center text-sm font-public font-bold text-fava-mediumgray hover:text-fava-darkgray"
            >
              Cancelar descarga
            </button>
          </div>
        </div>
      )}

      {singleQrModal.isOpen && singleQrModal.medium && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-fava-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-6 animate-in zoom-in-95">
            
            {singleQrModal.step === 'choice' && (
              <>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-satoshi font-bold text-fava-darkgray">¿Sobre qué enlace querés hacer el QR?</h3>
                  <p className="font-public text-sm text-fava-mediumgray">
                    Este link tiene una versión corta de Bitly. ¿Preferís que el código QR apunte al Bitly o a la UTM original?
                  </p>
                </div>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => executeSingleQr(singleQrModal.medium, 'bitly')}
                    className="w-full py-3 px-4 bg-fava-red hover:bg-fava-darkred text-fava-white font-satoshi font-bold rounded-xl transition-colors flex items-center justify-between group"
                  >
                    <span>Bitly</span>
                    <ChevronRight size={18} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                  <button 
                    onClick={() => executeSingleQr(singleQrModal.medium, 'utm')}
                    className="w-full py-3 px-4 bg-fava-lightgray/30 hover:bg-fava-lightgray border border-fava-lightgray text-fava-darkgray font-satoshi font-bold rounded-xl transition-colors flex items-center justify-between group"
                  >
                    <span>UTM</span>
                    <ChevronRight size={18} className="text-fava-mediumgray group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
                <button 
                  onClick={() => setSingleQrModal({ isOpen: false, step: 'choice', medium: null, qrDataUrl: null })}
                  className="mt-2 text-center text-sm font-public font-bold text-fava-mediumgray hover:text-fava-darkgray"
                >
                  Cancelar
                </button>
              </>
            )}

            {singleQrModal.step === 'generating' && (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <Loader2 className="animate-spin text-fava-red" size={40} />
                <p className="font-satoshi font-bold text-fava-darkgray">Generando código QR...</p>
              </div>
            )}

            {singleQrModal.step === 'preview' && (
              <div className="flex flex-col gap-4 items-center">
                <h3 className="text-lg font-satoshi font-bold text-fava-darkgray w-full text-left">Vista previa del QR</h3>
                
                {singleQrModal.qrDataUrl && (
                  <div className="p-4 bg-fava-lightgray/10 border border-fava-lightgray rounded-xl">
                    <img src={singleQrModal.qrDataUrl} alt="QR Preview" className="w-48 h-48" />
                  </div>
                )}
                
                <p className="text-xs font-public text-fava-mediumgray text-center px-4">
                  QR generado sobre la versión {singleQrModal.medium.qrSource === 'bitly' ? 'corta (Bitly)' : 'larga (UTM)'}
                </p>

                <div className="flex w-full gap-3 mt-2">
                  <button 
                    onClick={() => openSingleQrChoice(singleQrModal.medium)} 
                    className="flex-1 py-2.5 bg-fava-lightgray/30 hover:bg-fava-lightgray border border-fava-lightgray text-fava-darkgray font-satoshi font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
                  >
                    <RefreshCw size={16} /> Rehacer
                  </button>
                  <button 
                    onClick={() => saveAs(singleQrModal.qrDataUrl!, `${singleQrModal.medium.name}_QR.png`)} 
                    className="flex-1 py-2.5 bg-fava-red hover:bg-fava-darkred text-fava-white font-satoshi font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
                  >
                    <Download size={16} /> Descargar
                  </button>
                </div>
                <button 
                  onClick={() => setSingleQrModal({ isOpen: false, step: 'choice', medium: null, qrDataUrl: null })}
                  className="mt-1 text-center text-sm font-public font-bold text-fava-mediumgray hover:text-fava-darkgray"
                >
                  Cerrar
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      <GeneratorModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => setIsModalOpen(false)} 
        defaultMonth={selectedMonthLabel}
      />
    </div>
  );
}
