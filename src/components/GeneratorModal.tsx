"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Plus, Check, Trash2, ChevronDown, Download, Copy, Link as LinkIcon, RefreshCw } from "lucide-react";
import { getConfigItems, ConfigItem, saveGeneratedLink, addConfigItem } from "@/lib/db";
import { auth } from "@/lib/firebase";
import { COMPLEMENTARY_COLORS } from "@/lib/colors";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type GeneratorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultMonth: string;
};

type LinkEntry = {
  id: string;
  url: string;
  name: string;
  isGeneric: boolean;
  genericId?: string;
  isRetrying?: boolean;
};

type SourceModule = {
  id: string;
  sourceId: string;
  newSourceName: string;
  saveNewSource: boolean;
  selectedMediums: string[];
  newMediums: string[];
  saveNewMediums: boolean;
  isAddingNewMedium: boolean;
  newMediumInput: string;
};

export default function GeneratorModal({ isOpen, onClose, onSuccess, defaultMonth }: GeneratorModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  
  // Base Data
  const [dbCampaigns, setDbCampaigns] = useState<ConfigItem[]>([]);
  const [dbSources, setDbSources] = useState<ConfigItem[]>([]);
  const [dbMediums, setDbMediums] = useState<ConfigItem[]>([]);
  const [dbTags, setDbTags] = useState<ConfigItem[]>([]);
  const [dbLinks, setDbLinks] = useState<ConfigItem[]>([]);

  // 1. Links
  const [linkEntries, setLinkEntries] = useState<LinkEntry[]>([]);
  const [customLinksText, setCustomLinksText] = useState("");
  const [isFetchingTitles, setIsFetchingTitles] = useState(false);
  const [selectedGenericLinkToAdd, setSelectedGenericLinkToAdd] = useState("");

  // 2. Campaigns
  const [selectedCampaigns, setSelectedCampaigns] = useState<{id: string, name: string, isNew: boolean}[]>([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);

  // 3. Sources & Mediums
  const [sourceModules, setSourceModules] = useState<SourceModule[]>([
    { id: "mod1", sourceId: "", newSourceName: "", saveNewSource: false, selectedMediums: [], newMediums: [], saveNewMediums: false, isAddingNewMedium: false, newMediumInput: "" }
  ]);

  // 4. Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [isAddingNewTag, setIsAddingNewTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [saveNewTags, setSaveNewTags] = useState(false);

  const [advancedTagsOpen, setAdvancedTagsOpen] = useState(false);
  const [activeAdvancedTag, setActiveAdvancedTag] = useState<string | null>(null);
  const [tagLinkSelections, setTagLinkSelections] = useState<Record<string, Record<string, boolean>>>({});

  // 5. Bitly y QR
  const [generateBitly, setGenerateBitly] = useState(false);
  const [bitlySelections, setBitlySelections] = useState<Record<string, boolean>>({});
  const [generateQR, setGenerateQR] = useState(false);
  const [qrTarget, setQrTarget] = useState<"bitly"|"utm">("bitly");
  const [qrSelections, setQrSelections] = useState<Record<string, boolean>>({});

  // Success Modal & Phases
  const [phase, setPhase] = useState<"form" | "generating" | "success">("form");
  const [progress, setProgress] = useState(0);
  const [totalGenerations, setTotalGenerations] = useState(0);
  const [successData, setSuccessData] = useState<{
    utms: any[];
    bitlys: number;
    qrs: number;
  } | null>(null);
  const [copiedLinks, setCopiedLinks] = useState(false);
  const [copiedNames, setCopiedNames] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
      // Reset states
      setSelectedMonth(defaultMonth);
      setLinkEntries([]);
      setSelectedCampaigns([]);
      setSourceModules([{ id: "mod1", sourceId: "", newSourceName: "", saveNewSource: false, selectedMediums: [], newMediums: [], saveNewMediums: false, isAddingNewMedium: false, newMediumInput: "" }]);
      setSelectedTags([]);
      setNewTags([]);
      setSaveNewTags(false);
      setCustomLinksText("");
      setAdvancedTagsOpen(false);
      setActiveAdvancedTag(null);
      setGenerateBitly(false);
      setGenerateQR(false);
      setSuccessData(null);
      setPhase("form");
      setProgress(0);
      setTotalGenerations(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setTagLinkSelections(prev => {
      const next = { ...prev };
      const allSelected = [...selectedTags, ...newTags];
      allSelected.forEach(tag => {
        if (!next[tag]) next[tag] = {};
        linkEntries.forEach(l => {
          if (next[tag][l.id] === undefined) next[tag][l.id] = true;
        });
      });
      return next;
    });
  }, [linkEntries, selectedTags, newTags]);

  useEffect(() => {
    const allSelected = [...selectedTags, ...newTags];
    if (allSelected.length > 0 && (!activeAdvancedTag || !allSelected.includes(activeAdvancedTag))) {
      setActiveAdvancedTag(allSelected[0]);
    } else if (allSelected.length === 0) {
      setActiveAdvancedTag(null);
    }
  }, [selectedTags, newTags, activeAdvancedTag]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaigns, sources, mediums, tags, links] = await Promise.all([
        getConfigItems("campaigns"),
        getConfigItems("sources"),
        getConfigItems("mediums"),
        getConfigItems("tags"),
        getConfigItems("links")
      ]);
      setDbCampaigns(campaigns);
      setDbSources(sources);
      setDbMediums(mediums);
      setDbTags(tags);
      setDbLinks(links);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const availableCombinations = useMemo(() => {
    const combos: { sourceName: string, mediumName: string, key: string }[] = [];
    sourceModules.forEach(mod => {
      const sourceName = mod.sourceId === "new" ? mod.newSourceName : dbSources.find(s => s.id === mod.sourceId)?.name || "Source Desconocido";
      if (!sourceName.trim()) return;

      const allMediums = [
        ...mod.selectedMediums.map(mid => dbMediums.find(m => m.id === mid)?.name || "Medium Desconocido"),
        ...mod.newMediums
      ];

      allMediums.forEach(mediumName => {
        if (mediumName.trim()) {
           combos.push({ sourceName, mediumName, key: `${sourceName}-${mediumName}` });
        }
      });
    });
    return combos;
  }, [sourceModules, dbSources, dbMediums]);

  useEffect(() => {
    setBitlySelections(prev => {
      const next = { ...prev };
      availableCombinations.forEach(c => {
        if (next[c.key] === undefined) next[c.key] = true;
      });
      return next;
    });
    setQrSelections(prev => {
      const next = { ...prev };
      availableCombinations.forEach(c => {
        if (next[c.key] === undefined) next[c.key] = true;
      });
      return next;
    });
  }, [availableCombinations]);

  if (!isOpen) return null;

  // --- LÓGICA DE LINKS ---
  const handleAddCustomLinks = async () => {
    if (!customLinksText.trim()) return;
    setIsFetchingTitles(true);
    const urls = customLinksText.split(/[\t,\n\s]+/).map(u => u.trim()).filter(u => u.startsWith("http"));
    
    const newEntries: LinkEntry[] = [];
    for (const url of urls) {
      let title = url;
      try {
        const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.title) title = data.title;
      } catch(e) {}

      newEntries.push({
        id: Math.random().toString(36).substr(2, 9),
        url,
        name: title,
        isGeneric: false
      });
    }

    setLinkEntries(prev => [...prev, ...newEntries]);
    setCustomLinksText("");
    setIsFetchingTitles(false);
  };

  const handleAddGenericLink = (id: string) => {
    if(!id) return;
    const linkObj = dbLinks.find(l => l.id === id);
    if (linkObj) {
      setLinkEntries(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        url: linkObj.url || linkObj.name, 
        name: linkObj.name, 
        isGeneric: true,
        genericId: linkObj.id
      }]);
    }
    setSelectedGenericLinkToAdd("");
  };

  const removeLink = (id: string) => {
    if (confirm("¿Seguro que querés quitar este link?")) {
      setLinkEntries(prev => prev.filter(l => l.id !== id));
    }
  };

  const retryFetchTitle = async (id: string, url: string) => {
    setLinkEntries(prev => prev.map(l => l.id === id ? { ...l, isRetrying: true } : l));
    try {
      const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.title && data.title !== url) {
        setLinkEntries(prev => prev.map(l => l.id === id ? { ...l, name: data.title, isRetrying: false } : l));
      } else {
        setLinkEntries(prev => prev.map(l => l.id === id ? { ...l, isRetrying: false } : l));
      }
    } catch(e) {
      setLinkEntries(prev => prev.map(l => l.id === id ? { ...l, isRetrying: false } : l));
    }
  };

  // --- LÓGICA DE CAMPAIGNS ---
  const filteredCampaigns = dbCampaigns.filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()));
  const exactMatch = dbCampaigns.find(c => c.name.toLowerCase() === campaignSearch.toLowerCase());

  const addCampaign = (camp: {id: string, name: string, isNew: boolean}) => {
    if (!selectedCampaigns.find(c => c.name.toLowerCase() === camp.name.toLowerCase())) {
      setSelectedCampaigns(prev => [...prev, camp]);
    }
    setCampaignSearch("");
    setShowCampaignDropdown(false);
  };

  const removeCampaign = (name: string) => {
    setSelectedCampaigns(prev => prev.filter(c => c.name !== name));
  };

  // --- LÓGICA DE SOURCES Y MEDIUMS ---
  const updateModule = (id: string, updates: Partial<SourceModule>) => {
    setSourceModules(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const getSourceMediums = (sourceId: string) => dbMediums.filter(m => m.parentId === sourceId);

  // --- GENERAR ---
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const finalMonthYear = selectedMonth;
      const finalTagNames: string[] = [];
      const savedTagsMap = new Map<string, string>(); // tagId/name -> final DB name

      // Existing tags
      for (const tid of selectedTags) {
        const dbTag = dbTags.find(t => t.id === tid);
        if (dbTag) {
           finalTagNames.push(dbTag.name);
           savedTagsMap.set(tid, dbTag.name);
        }
      }

      // New tags
      let idx = 0;
      for (const tagName of newTags) {
        finalTagNames.push(tagName);
        savedTagsMap.set(tagName, tagName);
        if (saveNewTags) {
           const colorIndex = (dbTags.length + idx) % COMPLEMENTARY_COLORS.length;
           const newTagId = await addConfigItem("tags", tagName, undefined, undefined, COMPLEMENTARY_COLORS[colorIndex]);
        }
        idx++;
      }
      
      const savedCampaigns = new Map<string, {id: string, name: string}>();
      for (const camp of selectedCampaigns) {
        if (camp.isNew) {
          const newId = await addConfigItem("campaigns", camp.name);
          savedCampaigns.set(camp.name, { id: newId, name: camp.name });
        } else {
          savedCampaigns.set(camp.name, camp);
        }
      }

      const processedModules = [];
      for (const mod of sourceModules) {
        let finalSourceId = mod.sourceId;
        let finalSourceName = "";
        
        if (mod.sourceId === "new") {
          finalSourceName = mod.newSourceName;
          if (mod.saveNewSource) {
            finalSourceId = await addConfigItem("sources", mod.newSourceName);
          } else {
            finalSourceId = "temp-" + Math.random();
          }
        } else {
          const dbSource = dbSources.find(s => s.id === mod.sourceId);
          finalSourceName = dbSource?.name || "";
        }

        const finalMediums = [];
        for (const mid of mod.selectedMediums) {
          const dbMed = dbMediums.find(m => m.id === mid);
          if (dbMed) finalMediums.push({ id: dbMed.id, name: dbMed.name });
        }
        for (const newMedName of mod.newMediums) {
          if (mod.saveNewMediums && finalSourceId && !finalSourceId.startsWith("temp-")) {
            const newId = await addConfigItem("mediums", newMedName, finalSourceId);
            finalMediums.push({ id: newId, name: newMedName });
          } else {
            finalMediums.push({ id: "temp-" + Math.random(), name: newMedName });
          }
        }

        processedModules.push({
          sourceId: finalSourceId,
          sourceName: finalSourceName,
          mediums: finalMediums
        });
      }

      // Calculate total generations for progress bar
      let total = 0;
      for (const link of linkEntries) {
        for (const camp of selectedCampaigns) {
          for (const mod of processedModules) {
            total += mod.mediums.length;
          }
        }
      }
      setTotalGenerations(total);
      setPhase("generating");
      setProgress(0);

      const createdUtms = [];
      let bitlyCount = 0;
      let qrCount = 0;

      for (const link of linkEntries) {
        // Build tags for this specific link
        const linkTags: string[] = [];
        const allSelected = [...selectedTags, ...newTags];
        for (const tagIdOrName of allSelected) {
          if (tagLinkSelections[tagIdOrName]?.[link.id] !== false) {
            linkTags.push(savedTagsMap.get(tagIdOrName)!);
          }
        }

        for (const camp of selectedCampaigns) {
          const finalCamp = savedCampaigns.get(camp.name)!;
          
          for (const mod of processedModules) {
            for (const med of mod.mediums) {
              const url = new URL(link.url);
              url.searchParams.set("utm_source", mod.sourceName);
              url.searchParams.set("utm_medium", med.name);
              url.searchParams.set("utm_campaign", finalCamp.name);
              
              const key = `${mod.sourceName}-${med.name}`;

              let bitlyUrl = null;
              if (generateBitly && bitlySelections[key]) {
                try {
                  const token = await auth.currentUser?.getIdToken();
                  const res = await fetch("/api/bitly", {
                    method: "POST",
                    headers: { 
                      "Content-Type": "application/json",
                      "Authorization": token ? `Bearer ${token}` : ""
                    },
                    body: JSON.stringify({
                      long_url: url.toString(),
                      title: `${finalCamp.name} - ${link.name} - ${mod.sourceName} - ${med.name}`
                    })
                  });
                  if (res.ok) {
                    const data = await res.json();
                    bitlyUrl = data.link;
                    bitlyCount++;
                  }
                } catch (e) {
                  console.error("Error generating bitly", e);
                }
              }

              const hasQR = generateQR && !!qrSelections[key];
              if (hasQR) qrCount++;

              const finalLink = {
                monthYear: finalMonthYear,
                campaign: finalCamp,
                linkName: { id: link.isGeneric ? link.genericId! : "custom", name: link.name },
                source: { id: mod.sourceId, name: mod.sourceName },
                medium: { id: med.id, name: med.name },
                tags: linkTags,
                utmUrl: url.toString(),
                bitlyUrl,
                hasQR,
                createdAt: Date.now()
              };
              
              await saveGeneratedLink(finalLink);
              createdUtms.push(finalLink);
              setProgress(prev => prev + 1);
            }
          }
        }
      }

      setSuccessData({ utms: createdUtms, bitlys: bitlyCount, qrs: qrCount });
      setPhase("success");
    } catch (error) {
      console.error(error);
      alert("Hubo un error al generar los enlaces.");
      setPhase("form");
    }
    setLoading(false);
  };

  const handleDownloadQRs = async () => {
    if (!successData) return;
    const pendingTargets = successData.utms.filter(u => u.hasQR).map(u => ({
      name: `${u.campaign.name} - ${u.linkName.name} - ${u.source.name} - ${u.medium.name}`,
      url: qrTarget === "bitly" && u.bitlyUrl ? u.bitlyUrl : u.utmUrl
    }));
    
    if (pendingTargets.length === 0) return;
    
    if (pendingTargets.length === 1) {
      const dataUrl = await QRCode.toDataURL(pendingTargets[0].url, { width: 1024, margin: 2 });
      saveAs(dataUrl, `${pendingTargets[0].name}.png`);
    } else {
      const zip = new JSZip();
      for (const item of pendingTargets) {
        const dataUrl = await QRCode.toDataURL(item.url, { width: 1024, margin: 2 });
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        zip.file(`${item.name}.png`, base64Data, { base64: true });
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "Codigos_QR.zip");
    }
  };

  const handleCopyLinks = (onlyLinks: boolean) => {
    if (!successData) return;
    let text = "";
    if (onlyLinks) {
      text = successData.utms.map(u => u.utmUrl).join("\n");
      setCopiedLinks(true);
      setTimeout(() => setCopiedLinks(false), 2000);
    } else {
      const grouped: Record<string, typeof successData.utms> = {};
      for (const u of successData.utms) {
        const header = `${u.campaign.name} - ${u.source.name} - ${u.medium.name}`;
        if (!grouped[header]) grouped[header] = [];
        grouped[header].push(u);
      }

      text = Object.keys(grouped).sort().map(header => {
        const linksText = grouped[header].map(l => {
          let urlStr = l.utmUrl;
          if (l.bitlyUrl) urlStr += ` | Bitly: ${l.bitlyUrl}`;
          return `${l.linkName.name}: ${urlStr}`;
        }).join("\n");
        return `${header}\n${linksText}`;
      }).join("\n\n");

      setCopiedNames(true);
      setTimeout(() => setCopiedNames(false), 2000);
    }
    navigator.clipboard.writeText(text);
  };

  const canGenerate = linkEntries.length > 0 && 
                      selectedCampaigns.length > 0 && 
                      sourceModules.length > 0 && sourceModules.every(m => m.sourceId && (m.sourceId !== "new" || m.newSourceName.trim() !== "") && (m.selectedMediums.length > 0 || m.newMediums.length > 0));
  const uniqueCombosMap = availableCombinations.reduce((acc, c) => {
    if (!acc[c.sourceName]) acc[c.sourceName] = [];
    acc[c.sourceName].push(c);
    return acc;
  }, {} as Record<string, typeof availableCombinations>);

    if (phase === "generating" || phase === "success") {
      return (
        <div className="fixed inset-0 bg-fava-darkgray/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          {phase === "generating" && (
            <div className="bg-fava-white w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col gap-6 items-center text-center relative animate-in zoom-in-95">
              <h2 className="text-2xl font-satoshi font-bold text-fava-darkgray mb-2">Generando UTMs...</h2>
              <div className="w-full bg-fava-lightgray rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-fava-red h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${totalGenerations > 0 ? (progress / totalGenerations) * 100 : 0}%` }}
                ></div>
              </div>
              <p className="text-sm font-public text-fava-mediumgray">
                Procesando {progress} de {totalGenerations} enlaces...
              </p>
            </div>
          )}
          
          {phase === "success" && successData && (
            <div className="bg-fava-white w-full max-w-lg rounded-2xl shadow-2xl p-8 flex flex-col gap-6 items-center text-center relative animate-in zoom-in-95">
              <button onClick={() => { setPhase("form"); setSuccessData(null); onSuccess(); onClose(); }} className="absolute top-4 right-4 p-2 text-fava-mediumgray hover:text-fava-darkgray hover:bg-fava-lightgray/50 rounded-full transition-colors">
                <X size={20} />
              </button>
              
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <Check size={32} className="text-green-600" />
              </div>
              
              <div>
                <h2 className="text-2xl font-satoshi font-bold text-fava-darkgray mb-2">¡Generación exitosa!</h2>
                <p className="text-fava-mediumgray font-public">
                  Se crearon <strong className="text-fava-darkgray">{successData.utms.length} UTMs</strong>
                  {successData.bitlys > 0 && <>, <strong className="text-fava-darkgray">{successData.bitlys} Bitlys</strong></>}
                  {successData.qrs > 0 && <> y <strong className="text-fava-darkgray">{successData.qrs} Códigos QR</strong></>}
                  .
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full mt-4">
                <button onClick={() => handleCopyLinks(true)} className={`w-full py-3 px-4 border rounded-xl font-satoshi font-bold transition-all flex items-center justify-center gap-2 ${copiedLinks ? 'bg-green-100 border-green-500 text-green-700' : 'bg-fava-lightgray/20 border-fava-lightgray hover:border-fava-mediumgray text-fava-darkgray'}`}>
                  {copiedLinks ? (
                    <><Check size={18} /> Copiado</>
                  ) : (
                    <><LinkIcon size={18} /> Copiar Links</>
                  )}
                </button>
                <button onClick={() => handleCopyLinks(false)} className={`w-full py-3 px-4 border rounded-xl font-satoshi font-bold transition-all flex items-center justify-center gap-2 ${copiedNames ? 'bg-green-100 border-green-500 text-green-700' : 'bg-fava-lightgray/20 border-fava-lightgray hover:border-fava-mediumgray text-fava-darkgray'}`}>
                  {copiedNames ? (
                    <><Check size={18} /> Copiado</>
                  ) : (
                    <><Copy size={18} /> Copiar Nombres + Links</>
                  )}
                </button>
                {successData.qrs > 0 && (
                  <button onClick={handleDownloadQRs} className="w-full py-3 px-4 bg-fava-red hover:bg-fava-darkred text-fava-white rounded-xl font-satoshi font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                    <Download size={18} /> Descargar QR
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

  return (
    <div className="fixed inset-0 bg-fava-darkgray/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-fava-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-fava-elevation flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-fava-lightgray flex items-center justify-between bg-fava-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-satoshi font-bold text-fava-darkgray">Agregar enlaces</h2>
            <p className="text-fava-mediumgray font-public text-sm">Seleccioná los parámetros para crear tus UTM</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-fava-lightgray/50 rounded-full text-fava-mediumgray hover:text-fava-darkgray transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-10 bg-fava-white relative">
          
          {/* 1. Mes y URL Base */}
          <div className="flex flex-col gap-4">
            <h3 className="font-satoshi font-bold text-lg text-fava-darkgray border-b border-fava-lightgray/50 pb-2">1. Mes y URLs de Destino</h3>
            
            <div className="flex flex-col gap-2 w-full md:w-1/3 mb-4">
              <label className="text-sm font-public font-bold text-fava-darkgray">Mes de la campaña:</label>
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)} 
                className="w-full px-4 py-3 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public text-fava-darkgray bg-fava-white"
              >
                {Array.from({ length: 25 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 12 + i);
                  const lbl = format(d, "MMM yyyy", { locale: es });
                  const finalLbl = lbl.charAt(0).toUpperCase() + lbl.slice(1);
                  return <option key={finalLbl} value={finalLbl}>{finalLbl}</option>;
                })}
              </select>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-sm font-public font-bold text-fava-darkgray">Agregar links personalizados (pegá varios separados por espacio/coma):</label>
                <textarea 
                  rows={3} 
                  placeholder="https://grupofava.com.ar/zapatillas, https://grupofava.com.ar/celulares"
                  value={customLinksText}
                  onChange={e => setCustomLinksText(e.target.value)}
                  className="w-full px-4 py-3 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public text-fava-darkgray resize-none"
                />
                <button 
                  onClick={handleAddCustomLinks}
                  disabled={!customLinksText.trim() || isFetchingTitles}
                  className="bg-fava-lightgray/30 hover:bg-fava-lightgray/50 text-fava-darkgray font-satoshi font-bold py-2 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 self-start border border-fava-lightgray"
                >
                  {isFetchingTitles ? "Procesando..." : "+ Agregar Links"}
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <label className="text-sm font-public font-bold text-fava-darkgray">O elegir de links genéricos:</label>
                <select 
                  value={selectedGenericLinkToAdd} 
                  onChange={e => handleAddGenericLink(e.target.value)} 
                  className="w-full px-4 py-3 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public text-fava-darkgray bg-fava-white"
                >
                  <option value="">Seleccioná para agregar...</option>
                  {dbLinks.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {linkEntries.length > 0 && (
              <div className="mt-4 border border-fava-lightgray rounded-lg overflow-hidden">
                {linkEntries.map(link => (
                  <div key={link.id} className="flex items-center gap-4 p-3 border-b border-fava-lightgray bg-fava-white last:border-0 hover:bg-fava-lightgray/10">
                    <input 
                      type="text" 
                      value={link.name} 
                      onChange={e => setLinkEntries(prev => prev.map(l => l.id === link.id ? {...l, name: e.target.value} : l))}
                      className="flex-1 px-3 py-1.5 border border-transparent hover:border-fava-lightgray focus:border-fava-red rounded font-public font-bold text-fava-darkgray outline-none transition-colors"
                    />
                    <span className="flex-[2] text-sm font-public text-fava-mediumgray truncate" title={link.url}>{link.url}</span>
                    <div className="flex items-center gap-1">
                      {!link.isGeneric && (link.name === link.url || link.url.includes(link.name)) && (
                        <button 
                          onClick={() => retryFetchTitle(link.id, link.url)} 
                          disabled={link.isRetrying}
                          title="Volver a buscar título"
                          className="p-2 text-fava-mediumgray hover:text-fava-blue hover:bg-fava-blue/10 rounded-md transition-colors disabled:opacity-50"
                        >
                          <RefreshCw size={16} className={link.isRetrying ? "animate-spin" : ""} />
                        </button>
                      )}
                      <button onClick={() => removeLink(link.id)} title="Quitar link" className="p-2 text-fava-mediumgray hover:text-fava-red hover:bg-fava-lightred/20 rounded-md transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Campaigns */}
          <div className="flex flex-col gap-4">
            <h3 className="font-satoshi font-bold text-lg text-fava-darkgray border-b border-fava-lightgray/50 pb-2">2. Seleccionar Campaigns</h3>
            
            <div className="relative">
              <input 
                type="text" 
                placeholder="Buscar o crear nueva campaign..." 
                value={campaignSearch}
                onChange={e => { setCampaignSearch(e.target.value); setShowCampaignDropdown(true); }}
                onFocus={() => setShowCampaignDropdown(true)}
                onKeyDown={e => {
                  if (e.key === "Enter" && campaignSearch.trim() && !exactMatch) {
                    addCampaign({ id: "new-"+Math.random(), name: campaignSearch.trim(), isNew: true });
                  } else if (e.key === "Enter" && exactMatch) {
                    addCampaign({ id: exactMatch.id, name: exactMatch.name, isNew: false });
                  }
                }}
                className="w-full px-4 py-3 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public text-fava-darkgray"
              />
              {showCampaignDropdown && campaignSearch && (
                <div className="absolute top-full left-0 w-full mt-1 bg-fava-white border border-fava-lightgray rounded-lg shadow-fava-elevation z-20 max-h-48 overflow-y-auto">
                  {filteredCampaigns.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => addCampaign({ id: c.id, name: c.name, isNew: false })}
                      className="w-full text-left px-4 py-3 hover:bg-fava-lightgray/30 text-fava-darkgray font-public"
                    >
                      {c.name}
                    </button>
                  ))}
                  {!exactMatch && campaignSearch.trim() && (
                    <button 
                      onClick={() => addCampaign({ id: "new-"+Math.random(), name: campaignSearch.trim(), isNew: true })}
                      className="w-full text-left px-4 py-3 hover:bg-fava-lightgray/30 text-fava-red font-public border-t border-fava-lightgray flex items-center justify-between"
                    >
                      <span>Crear nueva: <strong>{campaignSearch.trim()}</strong></span>
                      <span className="text-xs bg-fava-lightred/20 px-2 py-1 rounded text-fava-red">Toca ENTER para agregar la campaign</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedCampaigns.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedCampaigns.map(camp => (
                  <div key={camp.id} className="flex items-center gap-2 bg-fava-red text-fava-white px-3 py-1.5 rounded-full font-satoshi font-bold shadow-sm">
                    {camp.name}
                    <button onClick={() => removeCampaign(camp.name)} className="text-fava-white/80 hover:text-fava-white hover:bg-fava-darkred rounded-full p-0.5">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Sources & Mediums */}
          <div className="flex flex-col gap-4">
            <h3 className="font-satoshi font-bold text-lg text-fava-darkgray border-b border-fava-lightgray/50 pb-2">3. Seleccionar Sources y sus Mediums</h3>
            
            <div className="flex flex-col gap-6">
              {sourceModules.map((mod) => (
                <div key={mod.id} className="p-5 rounded-xl border border-fava-lightgray bg-fava-lightgray/5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                      <select 
                        value={mod.sourceId} 
                        onChange={e => updateModule(mod.id, { sourceId: e.target.value, selectedMediums: [], newMediums: [] })}
                        className="w-full md:w-1/2 px-4 py-3 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public font-bold text-fava-darkgray bg-fava-white"
                      >
                        <option value="" disabled>Seleccioná un Source...</option>
                        {dbSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        <option value="new" className="text-fava-red font-bold">Agregar nueva Source +</option>
                      </select>

                      {mod.sourceId === "new" && (
                        <div className="flex flex-col gap-2 mt-2">
                          <input 
                            type="text" 
                            placeholder="Nombre de la nueva Source" 
                            value={mod.newSourceName}
                            onChange={e => updateModule(mod.id, { newSourceName: e.target.value })}
                            className="w-full md:w-1/2 px-4 py-2 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public"
                          />
                          <label className="flex items-center gap-2 text-sm font-public text-fava-darkgray cursor-pointer">
                            <input type="checkbox" checked={mod.saveNewSource} onChange={e => updateModule(mod.id, { saveNewSource: e.target.checked })} className="accent-fava-red" />
                            Guardar {mod.newSourceName || "la nueva source"} al listado de Source
                          </label>
                        </div>
                      )}
                    </div>
                    {sourceModules.length > 1 && (
                      <button onClick={() => setSourceModules(prev => prev.filter(m => m.id !== mod.id))} className="text-fava-mediumgray hover:text-fava-red p-2">
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>

                  {(mod.sourceId && mod.sourceId !== "new") || (mod.sourceId === "new" && mod.newSourceName.trim()) ? (
                    <div className="pl-6 border-l-2 border-fava-red/30 flex flex-col gap-3">
                      <span className="text-xs font-public font-bold uppercase tracking-wider text-fava-mediumgray">Seleccioná los mediums para este source:</span>
                      <div className="flex flex-wrap gap-2 items-center">
                        {mod.sourceId !== "new" && getSourceMediums(mod.sourceId).map(m => (
                          <label key={m.id} className={`cursor-pointer px-4 py-2 border rounded-full text-sm font-public font-medium transition-all ${mod.selectedMediums.includes(m.id) ? 'bg-fava-darkgray text-fava-white border-fava-darkgray shadow-sm' : 'bg-fava-white border-fava-lightgray text-fava-darkgray hover:border-fava-mediumgray'}`}>
                            <input type="checkbox" className="hidden" checked={mod.selectedMediums.includes(m.id)} onChange={() => {
                              const isChecked = mod.selectedMediums.includes(m.id);
                              updateModule(mod.id, { selectedMediums: isChecked ? mod.selectedMediums.filter(id => id !== m.id) : [...mod.selectedMediums, m.id] });
                            }} />
                            {m.name}
                          </label>
                        ))}

                        {mod.newMediums.map((mName, i) => (
                          <div key={i} className="flex items-center gap-1 bg-fava-darkgray text-fava-white px-4 py-2 rounded-full text-sm font-public font-medium shadow-sm">
                            {mName}
                            <button onClick={() => updateModule(mod.id, { newMediums: mod.newMediums.filter(n => n !== mName) })} className="ml-1 hover:text-fava-red">
                              <X size={14}/>
                            </button>
                          </div>
                        ))}

                        {!mod.isAddingNewMedium ? (
                          <button onClick={() => updateModule(mod.id, { isAddingNewMedium: true })} className="px-4 py-2 border border-dashed border-fava-mediumgray rounded-full text-sm font-public font-medium text-fava-red hover:bg-fava-lightred/10 transition-colors">
                            + Agregar nueva
                          </button>
                        ) : (
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Nombre del medium..."
                            value={mod.newMediumInput}
                            onChange={e => updateModule(mod.id, { newMediumInput: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === "Enter" && mod.newMediumInput.trim()) {
                                updateModule(mod.id, { 
                                  newMediums: [...mod.newMediums, mod.newMediumInput.trim()],
                                  isAddingNewMedium: false,
                                  newMediumInput: ""
                                });
                              } else if (e.key === "Escape") {
                                updateModule(mod.id, { isAddingNewMedium: false, newMediumInput: "" });
                              }
                            }}
                            onBlur={() => updateModule(mod.id, { isAddingNewMedium: false, newMediumInput: "" })}
                            className="px-4 py-2 border border-fava-red rounded-full text-sm font-public text-fava-darkgray focus:outline-none w-48"
                          />
                        )}
                      </div>
                      
                      {mod.newMediums.length > 0 && (
                        <label className="flex items-center gap-2 text-sm font-public text-fava-darkgray cursor-pointer mt-2">
                          <input type="checkbox" checked={mod.saveNewMediums} onChange={e => updateModule(mod.id, { saveNewMediums: e.target.checked })} className="accent-fava-red" />
                          Guardar los Medium nuevos a {mod.sourceId === "new" ? mod.newSourceName || "este source" : dbSources.find(s=>s.id===mod.sourceId)?.name}
                        </label>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <button onClick={() => setSourceModules(prev => [...prev, { id: "mod"+Math.random(), sourceId: "", newSourceName: "", saveNewSource: false, selectedMediums: [], newMediums: [], saveNewMediums: false, isAddingNewMedium: false, newMediumInput: "" }])} className="self-start text-fava-red font-satoshi font-bold flex items-center gap-2 hover:underline">
              <Plus size={18} /> Agregar otra source
            </button>
          </div>

          {/* 4. Etiquetas */}
          <div className="flex flex-col gap-4">
            <h3 className="font-satoshi font-bold text-lg text-fava-darkgray border-b border-fava-lightgray/50 pb-2">4. Etiquetas (Opcional)</h3>
            <div className="flex flex-wrap gap-2 items-center">
              {dbTags.map((t: any) => {
                const isSelected = selectedTags.includes(t.id);
                const tagColor = t.color || "#382d2d"; // Default to dark gray
                return (
                  <label 
                    key={t.id} 
                    className="cursor-pointer px-3 py-1 border rounded-full text-sm font-public font-medium transition-all shadow-sm"
                    style={{
                      backgroundColor: isSelected ? tagColor : "transparent",
                      borderColor: isSelected ? tagColor : "#e5e7eb", // fallback light gray border if not selected
                      color: isSelected ? "#fff" : "#382d2d" // white if selected, dark gray if not
                    }}
                  >
                    <input type="checkbox" className="hidden" checked={isSelected} onChange={() => setSelectedTags(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                    {t.name}
                  </label>
                );
              })}

              {newTags.map((tName, i) => {
                // Determine color based on total tags count to maintain the sequence
                const colorIndex = (dbTags.length + i) % COMPLEMENTARY_COLORS.length;
                const tagColor = COMPLEMENTARY_COLORS[colorIndex];
                return (
                  <div 
                    key={i} 
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-public font-medium shadow-sm"
                    style={{ backgroundColor: tagColor, borderColor: tagColor, color: "#fff", borderStyle: "solid", borderWidth: "1px" }}
                  >
                    {tName}
                    <button onClick={() => setNewTags(prev => prev.filter(n => n !== tName))} className="ml-1 hover:text-white/80">
                      <X size={14}/>
                    </button>
                  </div>
                );
              })}

              {!isAddingNewTag ? (
                <button onClick={() => setIsAddingNewTag(true)} className="px-3 py-1 border border-dashed border-fava-mediumgray rounded-full text-sm font-public font-medium text-fava-darkgray hover:bg-fava-lightgray/10 transition-colors">
                  + Agregar nueva
                </button>
              ) : (
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Nombre..."
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newTagInput.trim()) {
                      setNewTags(prev => [...prev, newTagInput.trim()]);
                      setIsAddingNewTag(false);
                      setNewTagInput("");
                    } else if (e.key === "Escape") {
                      setIsAddingNewTag(false);
                      setNewTagInput("");
                    }
                  }}
                  onBlur={() => { setIsAddingNewTag(false); setNewTagInput(""); }}
                  className="px-3 py-1 border border-fava-mediumgray rounded-full text-sm font-public text-fava-darkgray focus:outline-none focus:border-fava-darkgray w-32"
                />
              )}
            </div>
            
            {newTags.length > 0 && (
              <label className="flex items-center gap-2 text-sm font-public text-fava-darkgray cursor-pointer mt-1">
                <input type="checkbox" checked={saveNewTags} onChange={e => setSaveNewTags(e.target.checked)} className="accent-fava-red" />
                Guardar las etiquetas nuevas para futuros usos
              </label>
            )}
            
            {(selectedTags.length > 0 || newTags.length > 0) && linkEntries.length > 1 && (
              <div className="mt-2 p-4 bg-fava-lightgray/10 border border-fava-lightgray rounded-xl">
                <button onClick={() => setAdvancedTagsOpen(!advancedTagsOpen)} className="flex items-center justify-between w-full text-sm font-public font-bold text-fava-darkgray hover:text-fava-red transition-colors">
                  <span>Configuración avanzada de Etiquetas</span>
                  <ChevronDown size={16} className={`transition-transform ${advancedTagsOpen ? 'rotate-180' : ''}`} />
                </button>
                {advancedTagsOpen && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-fava-lightgray pt-4">
                    <div className="flex items-center gap-2">
                       <label className="text-sm font-public text-fava-mediumgray">Configurar etiqueta:</label>
                       <select 
                         value={activeAdvancedTag || ""}
                         onChange={e => setActiveAdvancedTag(e.target.value)}
                         className="px-3 py-1.5 border border-fava-lightgray rounded text-sm outline-none bg-white font-public text-fava-darkgray focus:border-fava-red"
                       >
                         {activeAdvancedTag === null && <option value="" disabled>Elegí una etiqueta...</option>}
                         {[...selectedTags.map(id => ({ id, name: dbTags.find(t=>t.id===id)?.name })), ...newTags.map(name => ({ id: name, name }))].map(t => (
                           <option key={t.id} value={t.id}>{t.name}</option>
                         ))}
                       </select>
                    </div>

                    {activeAdvancedTag && tagLinkSelections[activeAdvancedTag] && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-public text-fava-mediumgray mb-1">Seleccioná a qué links se les aplicará esta etiqueta:</p>
                        {linkEntries.map(l => (
                          <label key={l.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-fava-lightgray/20 rounded-lg">
                            <input 
                              type="checkbox" 
                              checked={tagLinkSelections[activeAdvancedTag][l.id]} 
                              onChange={e => setTagLinkSelections(prev => ({
                                ...prev, 
                                [activeAdvancedTag]: { ...prev[activeAdvancedTag], [l.id]: e.target.checked }
                              }))} 
                              className="w-4 h-4 accent-fava-red" 
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-satoshi font-bold text-fava-darkgray">{l.name}</span>
                              <span className="text-xs font-public text-fava-mediumgray truncate max-w-lg">{l.url}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Opciones Adicionales */}
          <div className="flex flex-col gap-4 mb-4">
            <h3 className="font-satoshi font-bold text-lg text-fava-darkgray border-b border-fava-lightgray/50 pb-2">5. Opciones Extra</h3>
            
            {/* Bitly */}
            <div className="p-4 border border-fava-lightgray rounded-xl bg-fava-white">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={generateBitly} onChange={e => setGenerateBitly(e.target.checked)} className="w-5 h-5 accent-fava-red" />
                <span className="font-satoshi font-bold text-fava-darkgray group-hover:text-fava-red transition-colors">Generar enlaces cortos de Bitly</span>
              </label>
              
              {generateBitly && availableCombinations.length > 0 && (
                <div className="mt-4 pl-8 flex flex-col gap-4 border-l-2 border-fava-lightgray ml-2">
                  <p className="text-sm font-public text-fava-mediumgray">¿En qué sources y mediums querés generar un Bitly?</p>
                  {Object.entries(uniqueCombosMap).map(([source, combos]) => (
                    <div key={source} className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={combos.every(c => bitlySelections[c.key])} 
                          onChange={e => {
                            const val = e.target.checked;
                            setBitlySelections(prev => {
                              const next = { ...prev };
                              combos.forEach(c => next[c.key] = val);
                              return next;
                            });
                          }} 
                          className="accent-fava-red"
                        />
                        <span className="font-satoshi font-bold text-fava-darkgray">{source}</span>
                      </label>
                      <div className="pl-6 flex flex-col gap-1">
                        {combos.map(c => (
                          <label key={c.key} className="flex items-center gap-2 cursor-pointer text-sm font-public text-fava-darkgray hover:text-fava-red">
                            <input 
                              type="checkbox" 
                              checked={bitlySelections[c.key] || false} 
                              onChange={e => setBitlySelections(prev => ({...prev, [c.key]: e.target.checked}))} 
                              className="accent-fava-red"
                            />
                            {c.mediumName}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* QR */}
            <div className="p-4 border border-fava-lightgray rounded-xl bg-fava-white">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={generateQR} onChange={e => setGenerateQR(e.target.checked)} className="w-5 h-5 accent-fava-red" />
                <span className="font-satoshi font-bold text-fava-darkgray group-hover:text-fava-red transition-colors">Generar Códigos QR</span>
              </label>
              
              {generateQR && availableCombinations.length > 0 && (
                <div className="mt-4 pl-8 flex flex-col gap-4 border-l-2 border-fava-lightgray ml-2">
                  <div className="flex flex-col gap-1 mb-2">
                    <p className="text-sm font-public font-bold text-fava-darkgray">¿Hacia dónde deben apuntar los QR?</p>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-public">
                        <input type="radio" name="qrTarget" checked={qrTarget === "bitly"} onChange={() => setQrTarget("bitly")} className="accent-fava-red" />
                        <span className="text-fava-darkgray">A los Bitly (si el link no tiene bitly usa UTM)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-public">
                        <input type="radio" name="qrTarget" checked={qrTarget === "utm"} onChange={() => setQrTarget("utm")} className="accent-fava-red" />
                        <span className="text-fava-darkgray">A las UTM largas</span>
                      </label>
                    </div>
                  </div>

                  <p className="text-sm font-public text-fava-mediumgray">¿En qué sources y mediums querés generar QR?</p>
                  {Object.entries(uniqueCombosMap).map(([source, combos]) => (
                    <div key={source} className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={combos.every(c => qrSelections[c.key])} 
                          onChange={e => {
                            const val = e.target.checked;
                            setQrSelections(prev => {
                              const next = { ...prev };
                              combos.forEach(c => next[c.key] = val);
                              return next;
                            });
                          }} 
                          className="accent-fava-red"
                        />
                        <span className="font-satoshi font-bold text-fava-darkgray">{source}</span>
                      </label>
                      <div className="pl-6 flex flex-col gap-1">
                        {combos.map(c => (
                          <label key={c.key} className="flex items-center gap-2 cursor-pointer text-sm font-public text-fava-darkgray hover:text-fava-red">
                            <input 
                              type="checkbox" 
                              checked={qrSelections[c.key] || false} 
                              onChange={e => setQrSelections(prev => ({...prev, [c.key]: e.target.checked}))} 
                              className="accent-fava-red"
                            />
                            {c.mediumName}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-fava-lightgray bg-fava-white sticky bottom-0 z-10 flex justify-end items-center gap-4">
          <button onClick={onClose} className="px-6 py-2.5 font-satoshi font-bold text-fava-mediumgray hover:text-fava-darkgray transition-colors">
            Cancelar
          </button>
          <button 
            onClick={handleGenerate}
            disabled={!canGenerate || loading}
            className="bg-fava-red hover:bg-fava-darkred text-fava-white font-satoshi font-bold px-8 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-[0_4px_14px_0_rgba(229,41,41,0.3)] disabled:opacity-50 disabled:shadow-none"
          >
            <Check size={20} /> Generar UTM
          </button>
        </div>

      </div>
    </div>
  );
}
