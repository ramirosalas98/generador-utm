"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ArrowLeft, Edit2, Check, X } from "lucide-react";
import Link from "next/link";
import { getConfigItems, addConfigItem, deleteConfigItem, updateConfigItem, ConfigItem } from "@/lib/db";
import { COMPLEMENTARY_COLORS } from "@/lib/colors";

const TABS = [
  { id: "campaigns", label: "Campaigns" },
  { id: "sources", label: "Sources" },
  { id: "mediums", label: "Mediums" },
  { id: "tags", label: "Etiquetas" },
  { id: "links", label: "Links Genéricos" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [sources, setSources] = useState<ConfigItem[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemUrl, setNewItemUrl] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    if (activeTab === "mediums") {
      loadSources();
    } else {
      setSelectedSourceId("");
      loadItems();
    }
    // reset form
    setNewItemName("");
    setNewItemUrl("");
    setEditingId(null);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "mediums" && selectedSourceId) {
      loadItems();
    } else if (activeTab === "mediums" && !selectedSourceId) {
      setItems([]);
    }
  }, [selectedSourceId]);

  const loadSources = async () => {
    try {
      const data = await getConfigItems("sources");
      setSources(data);
      if (data.length > 0) {
        setSelectedSourceId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading sources:", error);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getConfigItems(activeTab, activeTab === "mediums" ? selectedSourceId : undefined);
      
      // Auto-assign colors to tags if they don't have one
      if (activeTab === "tags") {
        let hasChanges = false;
        const updatedData = [...data];
        for (let i = 0; i < updatedData.length; i++) {
          if (!updatedData[i].color) {
            const assignedColor = COMPLEMENTARY_COLORS[i % COMPLEMENTARY_COLORS.length];
            await updateConfigItem("tags", updatedData[i].id, { color: assignedColor });
            updatedData[i].color = assignedColor;
            hasChanges = true;
          }
        }
        setItems(updatedData);
      } else {
        setItems(data);
      }
    } catch (error) {
      console.error("Error loading items:", error);
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    if (activeTab === "mediums" && !selectedSourceId) return;
    
    try {
      const parentId = activeTab === "mediums" ? selectedSourceId : undefined;
      const url = activeTab === "links" ? newItemUrl.trim() : undefined;
      const color = activeTab === "tags" ? COMPLEMENTARY_COLORS[items.length % COMPLEMENTARY_COLORS.length] : undefined;
      const id = await addConfigItem(activeTab, newItemName.trim(), parentId, url, color);
      
      setItems(prev => [...prev, { id, name: newItemName.trim(), parentId, url, color }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewItemName("");
      setNewItemUrl("");
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const dataToUpdate: any = { name: editName.trim() };
      if (activeTab === "links") dataToUpdate.url = editUrl.trim();
      if (activeTab === "tags") dataToUpdate.color = editColor;
      
      await updateConfigItem(activeTab, id, dataToUpdate);
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...dataToUpdate } : item).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este elemento?")) return;
    
    try {
      await deleteConfigItem(activeTab, id);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const startEditing = (item: ConfigItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditUrl(item.url || "");
    setEditColor(item.color || COMPLEMENTARY_COLORS[0]);
  };

  return (
    <div className="flex flex-col h-full bg-fava-white rounded-xl shadow-sm border border-fava-lightgray overflow-hidden">
      <div className="p-6 border-b border-fava-lightgray flex items-center gap-4">
        <Link href="/" className="text-fava-mediumgray hover:text-fava-red transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-satoshi font-bold text-fava-darkgray">Ajustes del Generador</h1>
      </div>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-[500px]">
        {/* Menú Lateral */}
        <div className="w-full md:w-64 border-r border-fava-lightgray bg-fava-lightgray/10 p-4 flex flex-col gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left px-4 py-3 rounded-lg font-satoshi font-bold transition-all ${
                activeTab === tab.id 
                  ? "bg-fava-lightred/20 text-fava-red border-l-4 border-fava-red" 
                  : "text-fava-mediumgray hover:bg-fava-lightgray/40 hover:text-fava-darkgray"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-satoshi font-bold text-fava-darkgray">
              Administrar {TABS.find(t => t.id === activeTab)?.label}
            </h2>
          </div>

          {activeTab === "mediums" && (
            <div className="flex flex-col gap-2 bg-fava-lightgray/20 p-4 rounded-lg border border-fava-lightgray">
              <label className="text-sm font-public font-bold text-fava-darkgray">Seleccioná un Source para ver sus Mediums:</label>
              {sources.length === 0 ? (
                <span className="text-sm text-fava-red">⚠️ No hay Sources creados. Creá uno primero.</span>
              ) : (
                <select 
                  value={selectedSourceId} 
                  onChange={e => setSelectedSourceId(e.target.value)}
                  className="px-4 py-2 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public text-fava-darkgray bg-fava-white"
                >
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 bg-fava-lightgray/10 p-4 rounded-xl border border-fava-lightgray">
            <input
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder={activeTab === "links" ? "Nombre del link..." : "Escribí un nuevo valor..."}
              disabled={activeTab === "mediums" && !selectedSourceId}
              className="flex-1 px-4 py-2 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public text-fava-darkgray disabled:opacity-50 disabled:bg-fava-lightgray/30"
            />
            {activeTab === "links" && (
              <input
                type="url"
                value={newItemUrl}
                onChange={e => setNewItemUrl(e.target.value)}
                placeholder="URL completa (ej: https://...)"
                className="flex-[2] px-4 py-2 border border-fava-lightgray rounded-lg focus:outline-none focus:border-fava-red font-public text-fava-darkgray"
              />
            )}
            <button 
              type="submit" 
              disabled={!newItemName.trim() || (activeTab === "mediums" && !selectedSourceId) || (activeTab === "links" && !newItemUrl.trim())}
              className="bg-fava-red hover:bg-fava-darkred text-fava-white font-satoshi font-bold px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Plus size={18} /> Agregar
            </button>
          </form>

          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="text-fava-mediumgray flex items-center gap-2 font-public">
                <div className="w-4 h-4 border-2 border-fava-mediumgray border-t-transparent rounded-full animate-spin"></div>
                Cargando...
              </div>
            ) : items.length === 0 ? (
              <div className="text-fava-mediumgray font-public p-8 text-center border border-dashed border-fava-lightgray rounded-xl">
                No hay elementos guardados. Agregá el primero arriba.
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-fava-lightgray rounded-xl hover:border-fava-mediumgray transition-colors gap-4">
                  {editingId === item.id ? (
                    <div className="flex-1 flex flex-col md:flex-row gap-3 w-full">
                      <input 
                        autoFocus
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        className="flex-1 px-3 py-1.5 border border-fava-red rounded outline-none font-public font-bold text-fava-darkgray"
                      />
                      {activeTab === "links" && (
                        <input 
                          value={editUrl} 
                          onChange={e => setEditUrl(e.target.value)} 
                          className="flex-[2] px-3 py-1.5 border border-fava-red rounded outline-none font-public text-fava-darkgray"
                        />
                      )}
                      {activeTab === "tags" && (
                        <div className="flex items-center gap-2 px-2 border border-fava-lightgray rounded">
                          <span className="text-sm font-public text-fava-mediumgray">Color:</span>
                          <div className="flex gap-1">
                            {COMPLEMENTARY_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setEditColor(color)}
                                className={`w-6 h-6 rounded-full border-2 transition-transform ${editColor === color ? 'border-fava-darkgray scale-110' : 'border-transparent hover:scale-110'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleUpdate(item.id)} className="p-2 bg-fava-red text-fava-white rounded hover:bg-fava-darkred"><Check size={16}/></button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-fava-lightgray text-fava-darkgray rounded hover:bg-fava-mediumgray"><X size={16}/></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-satoshi font-bold text-fava-darkgray text-lg">{item.name}</span>
                          {activeTab === "tags" && item.color && (
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} title={item.color}></span>
                          )}
                        </div>
                        {item.url && <span className="font-public text-sm text-fava-mediumgray truncate max-w-xl">{item.url}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditing(item)} className="p-2 text-fava-mediumgray hover:text-fava-darkgray bg-fava-lightgray/30 hover:bg-fava-lightgray/60 rounded-lg transition-colors">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-fava-mediumgray hover:text-fava-red bg-fava-lightgray/30 hover:bg-fava-lightred/20 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
