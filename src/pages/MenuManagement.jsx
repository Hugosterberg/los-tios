import React, { useState } from "react";
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
    { id: "all", name: "All Items" },
    { id: "specials", name: "Specials" },
    { id: "appetizers", name: "Appetizers" },
    { id: "mains", name: "Main Courses" },
    { id: "desserts", name: "Desserts" },
    { id: "beverages", name: "Beverages" },
  ];

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleSubmit = (data) => {
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, data });
    } else {
      createItem.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
              <p className="text-gray-600 mt-1">Manage your restaurant's menu items and pricing</p>
            </div>
            <Button
              onClick={() => {
                setEditingItem(null);
                setShowForm(true);
              }}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Item
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search menu items..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={selectedCategory === category.id ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <MenuItemForm
            item={editingItem}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingItem(null);
            }}
            isLoading={createItem.isPending || updateItem.isPending}
          />
        )}

        {/* Menu Items Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-96 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
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