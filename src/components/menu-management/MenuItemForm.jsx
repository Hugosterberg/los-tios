
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MenuItemForm({ item, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    description: "",
    description_en: "",
    category: "mains",
    price: 0,
    image_url: "",
    ingredients: [],
    available_extras: [], // Added
    is_vegetarian: false,
    is_available: true,
    preparation_time: 15,
  });

  const [ingredientInput, setIngredientInput] = useState("");
  const [extraInput, setExtraInput] = useState({ name: "", price: 0 }); // Added

  useEffect(() => {
    if (item) {
      setFormData(item);
    }
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addIngredient = () => {
    if (ingredientInput.trim()) {
      setFormData({
        ...formData,
        ingredients: [...(formData.ingredients || []), ingredientInput.trim()]
      });
      setIngredientInput("");
    }
  };

  const removeIngredient = (index) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index)
    });
  };

  // Added extra functions
  const addExtra = () => {
    if (extraInput.name.trim() && extraInput.price > 0) {
      setFormData({
        ...formData,
        available_extras: [...(formData.available_extras || []), { ...extraInput }]
      });
      setExtraInput({ name: "", price: 0 });
    }
  };

  const removeExtra = (index) => {
    setFormData({
      ...formData,
      available_extras: formData.available_extras.filter((_, i) => i !== index)
    });
  };

  return (
    <Card className="mb-8 border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">
          {item ? 'Edit Menu Item' : 'Add New Menu Item'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name (Español) *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Truffle Risotto"
              />
            </div>

            {/* Added English Name field */}
            <div className="space-y-2">
              <Label htmlFor="name_en">Item Name (English)</Label>
              <Input
                id="name_en"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                placeholder="e.g., Truffle Risotto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price ($) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specials">Today's Specials</SelectItem>
                  <SelectItem value="appetizers">Appetizers</SelectItem>
                  <SelectItem value="mains">Main Courses</SelectItem>
                  <SelectItem value="desserts">Desserts</SelectItem>
                  <SelectItem value="beverages">Beverages</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prep_time">Preparation Time (minutes)</Label>
              <Input
                id="prep_time"
                type="number"
                min="0"
                value={formData.preparation_time}
                onChange={(e) => setFormData({ ...formData, preparation_time: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image URL</Label>
              <Input
                id="image"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Español)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the dish in Spanish..."
              rows={3}
            />
          </div>

          {/* Added English Description field */}
          <div className="space-y-2">
            <Label htmlFor="description_en">Description (English)</Label>
            <Textarea
              id="description_en"
              value={formData.description_en}
              onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
              placeholder="Describe the dish in English..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingredients</Label>
            <div className="flex gap-2">
              <Input
                id="ingredients"
                value={ingredientInput}
                onChange={(e) => setIngredientInput(e.target.value)}
                placeholder="Add an ingredient..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addIngredient();
                  }
                }}
              />
              <Button type="button" onClick={addIngredient} variant="outline">
                Add
              </Button>
            </div>
            {formData.ingredients && formData.ingredients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.ingredients.map((ingredient, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {ingredient}
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Added Available Extras section */}
          <div className="space-y-2">
            <Label>Available Extras (Add-ons)</Label>
            <div className="flex gap-2">
              <Input
                value={extraInput.name}
                onChange={(e) => setExtraInput({ ...extraInput, name: e.target.value })}
                placeholder="Extra name (e.g., Extra Cheese)"
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={extraInput.price}
                onChange={(e) => setExtraInput({ ...extraInput, price: parseFloat(e.target.value) || 0 })}
                placeholder="Price"
                className="w-24"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addExtra();
                  }
                }}
              />
              <Button type="button" onClick={addExtra} variant="outline">
                Add Extra
              </Button>
            </div>
            {formData.available_extras && formData.available_extras.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.available_extras.map((extra, index) => (
                  <Badge key={index} className="gap-1 bg-green-100 text-green-800">
                    {extra.name} (+${extra.price?.toFixed(2)})
                    <button
                      type="button"
                      onClick={() => removeExtra(index)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_vegetarian}
                onCheckedChange={(checked) => setFormData({ ...formData, is_vegetarian: checked })}
              />
              <Label>Vegetarian</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
              <Label>Available</Label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700">
              {isLoading ? "Saving..." : item ? "Update Item" : "Add Item"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
