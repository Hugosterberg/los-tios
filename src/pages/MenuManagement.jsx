import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { motion } from "framer-motion";

import MenuItemCard from "../components/menu-management/MenuItemCard";
import MenuItemForm from "../components/menu-management/MenuItemForm";

export default function MenuManagement() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const formRef = React.useRef(null);

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menuItems'],
    queryFn: () => base44.entities.MenuItem.list(),
  });

  const createItem = useMutation({
    mutationFn: (data) => base44.entities.MenuItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      setShowForm(false);
      setEditingItem(null);
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MenuItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      setShowForm(false);
      setEditingItem(null);
    },
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.MenuItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
  });

  const categories = [
    { id: "all", name: "Todos" },
    { id: "appetizers", name: "Entradas" },
    { id: "pizzas", name: "Pizzas" },
    { id: "paninis", name: "Paninis" },
    { id: "desserts", name: "Postres" },
    { id: "beverages", name: "Bebidas" },
    { id: "salsas", name: "Salsas" },
  ];

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleSubmit = (data) => {
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, data });
    } else {
      createItem.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="border-b border-yellow-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-yellow-400">Gestión de Menú</h1>
              <p className="text-gray-500 text-xs">Administrar productos y precios</p>
            </div>
            <Button
              onClick={() => {
                setEditingItem(null);
                setShowForm(true);
              }}
              className="bg-yellow-400 hover:bg-yellow-300 text-black text-sm gap-2 h-8 px-3"
            >
              <Plus className="w-3 h-3" />
              Agregar Producto
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Filters */}
        <div className="mb-6 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Buscar productos..."
              className="pl-9 bg-[#242424] border-yellow-500/20 text-gray-300 placeholder:text-gray-600 h-8 text-sm focus:border-yellow-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <Button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`h-7 text-xs px-3 flex-shrink-0 ${
                  selectedCategory === category.id
                    ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                    : 'bg-transparent border border-yellow-500/20 text-gray-400 hover:border-yellow-400 hover:text-yellow-400'
                }`}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div ref={formRef}>
          <MenuItemForm
            item={editingItem}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingItem(null);
            }}
            isLoading={createItem.isPending || updateItem.isPending}
          />
          </div>
        )}

        {/* Menu Items Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-[#242424] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1 }
              }
            }}
          >
            {filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                onEdit={handleEdit}
                onDelete={(id) => {
                  if (confirm('Are you sure you want to delete this item?')) {
                    deleteItem.mutate(id);
                  }
                }}
                onToggleAvailability={(id, is_available) => {
                  updateItem.mutate({ id, data: { is_available } });
                }}
              />
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No menu items found</p>
          </div>
        )}
      </div>
    </div>
  );
}